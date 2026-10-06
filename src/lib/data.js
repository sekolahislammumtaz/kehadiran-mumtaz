import { supabase, isDbConfigured } from './supabase';
import fs from 'fs';
import path from 'path';

// Path for local mock database in case Supabase is not configured yet
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
  if (isDbConfigured()) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      if (error) throw error;
      
      const settingsMap = {};
      (data || []).forEach(item => {
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
      throw new Error(`Koneksi Supabase gagal: ${err.message}. Pastikan tabel 'settings' sudah dibuat di Supabase SQL Editor.`);
    }
  }

  const db = getLocalDb();
  if (db.settings.is_rsvp_active === undefined) {
    db.settings.is_rsvp_active = true;
  }
  return db.settings;
}

export async function saveSettings(settings) {
  const { event_name, event_date, active_attendance, is_rsvp_active } = settings;

  if (isDbConfigured()) {
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
      throw new Error(`Gagal menyimpan ke Supabase: ${err.message}`);
    }
  }

  const db = getLocalDb();
  db.settings = { ...db.settings, ...settings };
  saveLocalDb(db);
  return { success: true };
}

// 2. Classes
export async function getClasses() {
  if (isDbConfigured()) {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('name')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(c => c.name);
    } catch (err) {
      console.error("Supabase getClasses error:", err.message);
      throw new Error(`Gagal mengambil data kelas dari Supabase: ${err.message}`);
    }
  }

  const db = getLocalDb();
  const classes = db.classes.map(c => c.name);
  return [...new Set(classes)].sort();
}

// 3. Students (optionally filtered by class)
export async function getStudents(className = null) {
  if (isDbConfigured()) {
    try {
      if (className) {
        const { data, error } = await supabase
          .from('students')
          .select('name, email, classes!inner(name)')
          .eq('classes.name', className)
          .order('name', { ascending: true });
        if (error) throw error;
        return (data || []).map(s => s.name);
      } else {
        const { data, error } = await supabase
          .from('students')
          .select('name, email, classes(name)')
          .order('name', { ascending: true });
        if (error) throw error;
        return (data || []).map(s => ({
          name: s.name,
          email: s.email || '',
          class_name: s.classes?.name
        }));
      }
    } catch (err) {
      console.error("Supabase getStudents error:", err.message);
      throw new Error(`Gagal mengambil data siswa dari Supabase: ${err.message}`);
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
  if (isDbConfigured()) {
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
      (classesData || []).forEach(c => {
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
      throw new Error(`Gagal mengimpor data ke Supabase: ${err.message}`);
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
  if (isDbConfigured()) {
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert(attendance, { onConflict: 'student_name,class_name,event_name' });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("Supabase saveAttendance error:", err.message);
      throw new Error(`Gagal menyimpan kehadiran ke Supabase: ${err.message}`);
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
  if (isDbConfigured()) {
    try {
      let query = supabase.from('attendance').select('*');
      if (eventName) {
        query = query.eq('event_name', eventName);
      }
      const { data, error } = await query.order('confirmed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Supabase getAttendanceRecap error:", err.message);
      throw new Error(`Gagal mengambil data kehadiran dari Supabase: ${err.message}`);
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
  if (isDbConfigured()) {
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
      throw new Error(`Gagal menghapus data di Supabase: ${err.message}`);
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
  if (isDbConfigured()) {
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
      throw new Error(`Gagal mengarsipkan data di Supabase: ${err.message}`);
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
  if (isDbConfigured()) {
    try {
      const { data, error } = await supabase
        .from('archives')
        .select('archive_name')
        .order('confirmed_at', { ascending: false });
      if (error) throw error;
      const uniqueNames = [...new Set((data || []).map(item => item.archive_name))];
      return uniqueNames;
    } catch (err) {
      console.error("Supabase getArchivesList error:", err.message);
      throw new Error(`Gagal mengambil daftar arsip di Supabase: ${err.message}`);
    }
  }

  const db = getLocalDb();
  const uniqueNames = [...new Set(db.archives.map(item => item.archive_name))];
  return uniqueNames.reverse();
}

// 10. Get data for a specific archive
export async function getArchiveData(archiveName) {
  if (isDbConfigured()) {
    try {
      const { data, error } = await supabase
        .from('archives')
        .select('*')
        .eq('archive_name', archiveName)
        .order('confirmed_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Supabase getArchiveData error:", err.message);
      throw new Error(`Gagal mengambil data arsip di Supabase: ${err.message}`);
    }
  }

  const db = getLocalDb();
  return db.archives.filter(item => item.archive_name === archiveName);
}
