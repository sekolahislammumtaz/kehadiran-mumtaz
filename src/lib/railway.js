import { Pool } from 'pg';

let initPromise = null;

// Clean connection strings that have accidental bracket placeholders e.g. postgres:[password]@
export function sanitizeConnectionString(rawUrl) {
  if (!rawUrl) return rawUrl;
  let str = rawUrl.trim();

  // 1. Remove surrounding brackets from password e.g. postgres:[password]@ or postgres.xxxx:[password]@
  const bracketMatch = str.match(/^(postgres(?:ql)?:\/\/[^:]+:)(\[[^\]]+\])(@.+)$/);
  if (bracketMatch) {
    const rawPass = bracketMatch[2].slice(1, -1); // strip [ and ]
    str = `${bracketMatch[1]}${encodeURIComponent(rawPass)}${bracketMatch[3]}`;
  }

  return str;
}

// Check if Railway / standard PostgreSQL connection string is provided
export function isRailwayConfigured() {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.RAILWAY_DATABASE_URL
  );
}

// Get or initialize pg Pool (singleton across requests)
export function getPool() {
  const rawString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.RAILWAY_DATABASE_URL;

  if (!rawString) {
    return null;
  }

  const connectionString = sanitizeConnectionString(rawString);

  if (connectionString.includes('.supabase.co:5432') && connectionString.includes('db.')) {
    console.warn(
      `[DATABASE WARNING] Terdeteksi Direct Connection Supabase (db.xxxx.supabase.co:5432) yang merupakan IPv6-only. ` +
      `Platform seperti Vercel tidak mendukung IPv6 ke port 5432. ` +
      `Disarankan menggunakan Supabase Connection Pooler (port 6543 / pooler.supabase.com) atau pasang SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY.`
    );
  }

  if (!global._pgPool) {
    const isLocal =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1');

    global._pgPool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    global._pgPool.on('error', (err) => {
      console.error('[PostgreSQL Pool Background Error]:', err.message);
    });
  }

  return global._pgPool;
}

// Automatically create tables & seed settings if not exists on PostgreSQL
export async function initRailwayTables(p) {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // 1. Classes
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Students
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        class_id INT REFERENCES classes(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (name, class_id)
      );
    `);

    // 3. Ensure email column exists on students if created previously
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    `);

    // 4. Attendance
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        student_name VARCHAR(255) NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        attendance_option VARCHAR(100) NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_name, class_name, event_name)
      );
    `);

    // 5. Archives
    await client.query(`
      CREATE TABLE IF NOT EXISTS archives (
        id SERIAL PRIMARY KEY,
        archive_name VARCHAR(255) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        attendance_option VARCHAR(100) NOT NULL,
        confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL
      );
    `);

    // 7. Seed Settings if not exists
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES 
        ('event_name', '"Pertemuan Wali Murid"'::jsonb),
        ('event_date', '"2026-08-01"'::jsonb),
        ('active_attendance', '["ayah dan bunda", "ayah", "bunda", "tidak hadir"]'::jsonb),
        ('is_rsvp_active', 'true'::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Execute query on PostgreSQL with automatic table initialization
export async function query(text, params) {
  const p = getPool();
  if (!p) {
    throw new Error('Database connection URL (DATABASE_URL) tidak ditemukan di Environment Variables.');
  }

  if (!initPromise) {
    initPromise = initRailwayTables(p).catch((err) => {
      console.error('Error initializing PostgreSQL tables:', err.message);
      initPromise = null; // allow retry on next query
      throw err;
    });
  }
  await initPromise;

  return p.query(text, params);
}
