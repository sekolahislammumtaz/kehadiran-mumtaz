import { isRailwayConfigured, query as railwayQuery } from './railway';
import { supabase, isDbConfigured as isSupabaseConfigured } from './supabase';
import fs from 'fs';
import path from 'path';

// Path for local mock database in case Railway/Supabase is not configured yet
const MOCK_DB_PATH = path.join(process.cwd(), 'src', 'lib', 'mock_db.json');

// Initialize local mock DB structure
function getLocalDb() {
  try {
    if (!fs.existsSync(MOCK_DB_PATH)) {
      const initialDb = {
        settings: {
          event_name: 'Pertemuan Wali Murid',
          event_date: '2026-08-01',
          active_attendance: [
            'ayah dan bunda',
            'ayah',
            'bunda',
            'tidak hadir'
          ],
          is_rsvp_active: true
        },
        classes: [],
        students: [],
        attendance: [],
        archives: []
      };
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(initialDb, null, 2));
      return initialDb;
    }
    const data = fs.readFileSync(MOCK_DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.archives) {
      parsed.archives = [];
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(parsed, null, 2));
    }
    return parsed;
  } catch (err) {
    console.error("Error reading local mock DB:", err);
    return { settings: {}, classes: [], students: [], attendance: [], archives: [] };
  }
}

function saveLocalDb(data) {
  try {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing local mock DB:", err);
  }
}

// 1. Settings (Event name, Date, Active Options)
export async function getSettings() {
  // Method 1: Supabase Client (HTTPS API, recommended on Vercel)
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      if (error) throw error;
      
      const settingsMap = {};
      data.forEach(item => {
        settingsMap[item.key] = item.value;
      });

      return {
        event_name: settingsMap.event_name || 'Kegiatan Sekolah',
        event_date: settingsMap.event_date || '2026-07-15',
        active_attendance: settingsMap.active_attendance || [],
        is_rsvp_active: settingsMap.is_rsvp_active !== undefined ? settingsMap.is_rsvp_active : true
      };
    } catch (err) {
      console.error("Supabase getSettings error:", err.message);
      throw new Error(`Koneksi Supabase gagal: ${err.message}. Periksa SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY.`);
    }
  }

  // Method 2: PostgreSQL Pool (DATABASE_URL from Railway or Supabase Pooler)
  if (isRailwayConfigured()) {
    try {
      const res = await railwayQuery('SELECT key, value FROM settings');
      const settingsMap = {};
      res.rows.forEach(item => {
        let val = item.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch (e) {}
        }
        settingsMap[item.key] = val;
      });

      return {
        event_name: settingsMap.event_name || 'Kegiatan Sekolah',
        event_date: settingsMap.event_date || '2026-07-15',
        active_attendance: settingsMap.active_attendance || [],
        is_rsvp_active: settingsMap.is_rsvp_active !== undefined ? settingsMap.is_rsvp_active : true
      };
    } catch (err) {
      console.error("PostgreSQL (DATABASE_URL) getSettings error:", err.message);
      throw new Error(`Koneksi database PostgreSQL (DATABASE_URL) gagal: ${err.message}.`);
    }
  }

  // Method 3: Local Mock DB (Offline / Initial setup without cloud DB)
  const db = getLocalDb();
  if (db.settings.is_rsvp_active === undefined) {
    db.settings.is_rsvp_active = true;
  }
  return db.settings;
}

export async function saveSettings(settings) {
  const { event_name, event_date, active_attendance, is_rsvp_active } = settings;

  // Method 1: Supabase Client (HTTPS API)
  if (isSupabaseConfigured()) {
    try {
      const updates = [
        { key: 'event_name', value: event_name },
        { key: 'event_date', value: event_date },
        { key: 'active_attendance', value: active_attendance },
        { key: 'is_rsvp_active', value: is_rsvp_active !== undefined ? is_rsvp_active : true }
      ];

      for (const item of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(item, { onConflict: 'key' });
        if (error) throw error;
      }
      return { success: true };
    } catch (err) {
      console.error("Supabase saveSettings error:", err.message);
      throw new Error(`Gagal menyimpan ke Supabase: ${err.message}.`);
    }
  }

  // Method 2: PostgreSQL Pool (DATABASE_URL)
  if (isRailwayConfigured()) {
    try {
      const updates = [
        { key: 'event_name', value: JSON.stringify(event_name) },
        { key: 'event_date', value: JSON.stringify(event_date) },
        { key: 'active_attendance', value: JSON.stringify(active_attendance) },
        { key: 'is_rsvp_active', value: JSON.stringify(is_rsvp_active !== undefined ? is_rsvp_active : true) }
      ];

      for (const item of updates) {
        await railwayQuery(
          `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [item.key, item.value]
        );
      }
      return { success: true };
    } catch (err) {
      console.error("PostgreSQL (DATABASE_URL) saveSettings error:", err.message);
      throw new Error(`Gagal menyimpan ke database PostgreSQL (DATABASE_URL): ${err.message}.`);
    }
  }

  // Method 3: Local Mock DB
  const db = getLocalDb();
  db.settings = { ...db.settings, ...settings };
  saveLocalDb(db);
  return { success: true };
}

// 2. Classes
export async function getClasses() {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('name')
        .order('name', { ascending: true });
      if (error) throw error;
      return data.map(c => c.name);
    } catch (err) {
      console.error("Supabase getClasses error:", err.message);
      throw new Error(`Gagal mengambil data kelas dari Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      const res = await railwayQuery('SELECT name FROM classes ORDER BY name ASC');
      return res.rows.map(c => c.name);
    } catch (err) {
      console.error("PostgreSQL getClasses error:", err.message);
      throw new Error(`Gagal mengambil data kelas dari PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  const classes = db.classes.map(c => c.name);
  return [...new Set(classes)].sort();
}

// 3. Students (optionally filtered by class)
export async function getStudents(className = null) {
  if (isSupabaseConfigured()) {
    try {
      if (className) {
        const { data, error } = await supabase
          .from('students')
          .select('name, email, classes!inner(name)')
          .eq('classes.name', className)
          .order('name', { ascending: true });
        if (error) throw error;
        return data.map(s => s.name);
      } else {
        const { data, error } = await supabase
          .from('students')
          .select('name, email, classes(name)')
          .order('name', { ascending: true });
        if (error) throw error;
        return data.map(s => ({ name: s.name, email: s.email, class_name: s.classes?.name }));
      }
    } catch (err) {
      console.error("Supabase getStudents error:", err.message);
      throw new Error(`Gagal mengambil data siswa dari Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      if (className) {
        const res = await railwayQuery(
          `SELECT s.name 
           FROM students s 
           JOIN classes c ON s.class_id = c.id 
           WHERE c.name = $1 
           ORDER BY s.name ASC`,
          [className]
        );
        return res.rows.map(s => s.name);
      } else {
        const res = await railwayQuery(
          `SELECT s.name, s.email, c.name AS class_name 
           FROM students s 
           LEFT JOIN classes c ON s.class_id = c.id 
           ORDER BY s.name ASC`
        );
        return res.rows.map(s => ({
          name: s.name,
          email: s.email || '',
          class_name: s.class_name
        }));
      }
    } catch (err) {
      console.error("PostgreSQL getStudents error:", err.message);
      throw new Error(`Gagal mengambil data siswa dari PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  if (className) {
    return db.students
      .filter(s => s.class_name === className)
      .map(s => s.name)
      .sort();
  }
  return db.students.map(s => ({
    name: s.name,
    class_name: s.class_name,
    email: s.email || ''
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// 4. Import student and class data
export async function importData(rows) {
  if (isSupabaseConfigured()) {
    try {
      const uniqueClasses = [...new Set(rows.map(r => r.kelas.trim()))];
      
      for (const className of uniqueClasses) {
        const { error } = await supabase
          .from('classes')
          .upsert({ name: className }, { onConflict: 'name' });
        if (error) throw error;
      }

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name');
      if (classesError) throw classesError;

      const classMap = {};
      classesData.forEach(c => {
        classMap[c.name] = c.id;
      });

      const studentsToInsert = rows.map(r => ({
        name: r.siswa.trim(),
        email: r.email ? r.email.trim() : null,
        class_id: classMap[r.kelas.trim()]
      }));

      const { error: studentsError } = await supabase
        .from('students')
        .upsert(studentsToInsert, { onConflict: 'name,class_id' });
      if (studentsError) throw studentsError;

      return { success: true, count: rows.length };
    } catch (err) {
      console.error("Supabase importData error:", err.message);
      throw new Error(`Gagal mengimpor data ke Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      const uniqueClasses = [...new Set(rows.map(r => r.kelas.trim()))];
      
      for (const className of uniqueClasses) {
        await railwayQuery(
          'INSERT INTO classes (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
          [className]
        );
      }

      const classesRes = await railwayQuery('SELECT id, name FROM classes');
      const classMap = {};
      classesRes.rows.forEach(c => {
        classMap[c.name] = c.id;
      });

      for (const r of rows) {
        const classId = classMap[r.kelas.trim()];
        const emailVal = r.email ? r.email.trim() : null;
        await railwayQuery(
          `INSERT INTO students (name, class_id, email)
           VALUES ($1, $2, $3)
           ON CONFLICT (name, class_id) DO UPDATE SET email = EXCLUDED.email`,
          [r.siswa.trim(), classId, emailVal]
        );
      }

      return { success: true, count: rows.length };
    } catch (err) {
      console.error("PostgreSQL importData error:", err.message);
      throw new Error(`Gagal mengimpor data ke PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  const uniqueClasses = [...new Set(rows.map(r => r.kelas.trim()))];
  db.classes = uniqueClasses.map(name => ({ name }));

  db.students = rows.map((r, index) => ({
    id: index + 1,
    name: r.siswa.trim(),
    email: r.email ? r.email.trim() : '',
    class_name: r.kelas.trim()
  }));

  saveLocalDb(db);
  return { success: true, count: rows.length };
}

// 5. RSVP / Attendance Confirmation
export async function saveAttendance(attendance) {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert(attendance, { onConflict: 'student_name,class_name,event_name' });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("Supabase saveAttendance error:", err.message);
      throw new Error(`Gagal menyimpan kehadiran ke Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      await railwayQuery(
        `INSERT INTO attendance (student_name, class_name, attendance_option, event_name, confirmed_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (student_name, class_name, event_name)
         DO UPDATE SET attendance_option = EXCLUDED.attendance_option, confirmed_at = NOW()`,
        [
          attendance.student_name,
          attendance.class_name,
          attendance.attendance_option,
          attendance.event_name
        ]
      );
      return { success: true };
    } catch (err) {
      console.error("PostgreSQL saveAttendance error:", err.message);
      throw new Error(`Gagal menyimpan kehadiran ke PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  db.attendance = db.attendance.filter(
    a => !(a.student_name === attendance.student_name && 
           a.class_name === attendance.class_name && 
           a.event_name === attendance.event_name)
  );
  db.attendance.push({
    ...attendance,
    confirmed_at: new Date().toISOString()
  });
  saveLocalDb(db);
  return { success: true };
}

// 6. Get Attendance Recap
export async function getAttendanceRecap(eventName = null) {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('attendance').select('*');
      if (eventName) {
        query = query.eq('event_name', eventName);
      }
      const { data, error } = await query.order('confirmed_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase getAttendanceRecap error:", err.message);
      throw new Error(`Gagal mengambil data kehadiran dari Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      if (eventName) {
        const res = await railwayQuery(
          'SELECT * FROM attendance WHERE event_name = $1 ORDER BY confirmed_at DESC',
          [eventName]
        );
        return res.rows;
      } else {
        const res = await railwayQuery(
          'SELECT * FROM attendance ORDER BY confirmed_at DESC'
        );
        return res.rows;
      }
    } catch (err) {
      console.error("PostgreSQL getAttendanceRecap error:", err.message);
      throw new Error(`Gagal mengambil data kehadiran dari PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  if (eventName) {
    return db.attendance.filter(a => a.event_name === eventName).reverse();
  }
  return [...db.attendance].reverse();
}

// 7. Delete Active Attendance
export async function deleteAttendance(studentName, className, eventName) {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('student_name', studentName)
        .eq('class_name', className)
        .eq('event_name', eventName);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("Supabase deleteAttendance error:", err.message);
      throw new Error(`Gagal menghapus data di Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      await railwayQuery(
        'DELETE FROM attendance WHERE student_name = $1 AND class_name = $2 AND event_name = $3',
        [studentName, className, eventName]
      );
      return { success: true };
    } catch (err) {
      console.error("PostgreSQL deleteAttendance error:", err.message);
      throw new Error(`Gagal menghapus data di PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  db.attendance = db.attendance.filter(
    a => !(a.student_name === studentName && 
           a.class_name === className && 
           a.event_name === eventName)
  );
  saveLocalDb(db);
  return { success: true };
}

// 8. Save Current RSVP to Archive
export async function archiveAttendance(archiveName, eventName) {
  if (isSupabaseConfigured()) {
    try {
      const { data, error: fetchError } = await supabase
        .from('attendance')
        .select('*')
        .eq('event_name', eventName);
      
      if (fetchError) throw fetchError;
      if (!data || data.length === 0) {
        return { success: true, count: 0, message: "Tidak ada data untuk diarsipkan." };
      }

      const archivesToInsert = data.map(item => ({
        archive_name: archiveName,
        student_name: item.student_name,
        class_name: item.class_name,
        attendance_option: item.attendance_option,
        confirmed_at: item.confirmed_at
      }));

      const { error: insertError } = await supabase
        .from('archives')
        .insert(archivesToInsert);
      if (insertError) throw insertError;

      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('event_name', eventName);
      if (deleteError) throw deleteError;

      return { success: true, count: data.length };
    } catch (err) {
      console.error("Supabase archiveAttendance error:", err.message);
      throw new Error(`Gagal mengarsipkan data di Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      const insertRes = await railwayQuery(
        `INSERT INTO archives (archive_name, student_name, class_name, attendance_option, confirmed_at)
         SELECT $1, student_name, class_name, attendance_option, confirmed_at
         FROM attendance
         WHERE event_name = $2
         RETURNING id`,
        [archiveName, eventName]
      );

      const count = insertRes.rowCount || 0;
      if (count === 0) {
        return { success: true, count: 0, message: "Tidak ada data untuk diarsipkan." };
      }

      await railwayQuery('DELETE FROM attendance WHERE event_name = $1', [eventName]);
      return { success: true, count };
    } catch (err) {
      console.error("PostgreSQL archiveAttendance error:", err.message);
      throw new Error(`Gagal mengarsipkan data di PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  const toArchive = db.attendance.filter(a => a.event_name === eventName);
  if (toArchive.length === 0) {
    return { success: true, count: 0, message: "Tidak ada data untuk diarsipkan." };
  }
  toArchive.forEach(item => {
    db.archives.push({
      archive_name: archiveName,
      student_name: item.student_name,
      class_name: item.class_name,
      attendance_option: item.attendance_option,
      confirmed_at: item.confirmed_at
    });
  });
  db.attendance = db.attendance.filter(a => a.event_name !== eventName);
  saveLocalDb(db);
  return { success: true, count: toArchive.length };
}

// 9. Get unique archive names list
export async function getArchivesList() {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('archives')
        .select('archive_name')
        .order('confirmed_at', { ascending: false });
      if (error) throw error;
      const uniqueNames = [...new Set(data.map(item => item.archive_name))];
      return uniqueNames;
    } catch (err) {
      console.error("Supabase getArchivesList error:", err.message);
      throw new Error(`Gagal mengambil daftar arsip di Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      const res = await railwayQuery(
        `SELECT archive_name 
         FROM archives 
         GROUP BY archive_name 
         ORDER BY MAX(confirmed_at) DESC NULLS LAST`
      );
      return res.rows.map(r => r.archive_name);
    } catch (err) {
      console.error("PostgreSQL getArchivesList error:", err.message);
      throw new Error(`Gagal mengambil daftar arsip di PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  const uniqueNames = [...new Set(db.archives.map(item => item.archive_name))];
  return uniqueNames.reverse();
}

// 10. Get data for a specific archive
export async function getArchiveData(archiveName) {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('archives')
        .select('*')
        .eq('archive_name', archiveName)
        .order('confirmed_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase getArchiveData error:", err.message);
      throw new Error(`Gagal mengambil data arsip di Supabase: ${err.message}.`);
    }
  }

  if (isRailwayConfigured()) {
    try {
      const res = await railwayQuery(
        'SELECT * FROM archives WHERE archive_name = $1 ORDER BY confirmed_at DESC',
        [archiveName]
      );
      return res.rows;
    } catch (err) {
      console.error("PostgreSQL getArchiveData error:", err.message);
      throw new Error(`Gagal mengambil data arsip di PostgreSQL: ${err.message}.`);
    }
  }

  const db = getLocalDb();
  return db.archives.filter(item => item.archive_name === archiveName);
}
