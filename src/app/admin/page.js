'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';

const ALL_ATTENDANCE_OPTIONS = [
  'ayah dan bunda',
  'ayah',
  'bunda',
  'ayah dan ikhwan',
  'bunda dan ikhwan',
  'ayah dan akhwat',
  'bunda dan akhwat',
  'tidak hadir'
];

export default function AdminPage() {
  // Authentication State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dashboard Data State
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [activeOptions, setActiveOptions] = useState([]);
  const [rsvpList, setRsvpList] = useState([]);
  const [classList, setClassList] = useState([]);
  const [isRsvpActive, setIsRsvpActive] = useState(true);
  
  // Archiving States
  const [archivesList, setArchivesList] = useState([]);
  const [archiveNameInput, setArchiveNameInput] = useState('');
  const [selectedArchive, setSelectedArchive] = useState('');
  
  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importAlert, setImportAlert] = useState(null);

  // Check sessionStorage on mount
  useEffect(() => {
    const savedPassword = sessionStorage.getItem('admin_password');
    if (savedPassword) {
      verifyPasswordAndLoad(savedPassword);
    }
  }, []);

  // Verify Admin Password & load dashboard
  const verifyPasswordAndLoad = async (passwordToVerify) => {
    setIsLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`/api/rsvp?password=${encodeURIComponent(passwordToVerify)}`);
      if (res.ok) {
        const data = await res.json();
        setRsvpList(data);
        sessionStorage.setItem('admin_password', passwordToVerify);
        setAdminPassword(passwordToVerify);
        setIsAdmin(true);
        
        // Load configurations
        await loadSettingsAndClasses(passwordToVerify);
        await loadArchivesList(passwordToVerify);
      } else {
        const errData = await res.json();
        setLoginError(errData.error || 'Password admin salah!');
        sessionStorage.removeItem('admin_password');
      }
    } catch (err) {
      console.error(err);
      setLoginError('Koneksi server gagal. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettingsAndClasses = async (password = adminPassword) => {
    try {
      const settingsRes = await fetch('/api/settings');
      const settingsData = await settingsRes.json();
      setEventName(settingsData.event_name);
      setEventDate(settingsData.event_date);
      setActiveOptions(settingsData.active_attendance || []);
      setIsRsvpActive(settingsData.is_rsvp_active !== undefined ? settingsData.is_rsvp_active : true);
      
      // Pre-fill archive name input
      if (settingsData.event_name) {
        const dateStr = settingsData.event_date ? ` (${settingsData.event_date})` : '';
        setArchiveNameInput(`${settingsData.event_name}${dateStr}`);
      }

      const classesRes = await fetch('/api/classes');
      const classesData = await classesRes.json();
      setClassList(classesData);
    } catch (err) {
      console.error('Error loading settings/classes:', err);
    }
  };

  const loadArchivesList = async (password = adminPassword) => {
    try {
      const res = await fetch(`/api/archives?password=${encodeURIComponent(password)}`);
      if (res.ok) {
        const data = await res.json();
        setArchivesList(data);
      }
    } catch (err) {
      console.error('Error loading archives list:', err);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!adminPassword) {
      setLoginError('Kata sandi harus diisi!');
      return;
    }
    verifyPasswordAndLoad(adminPassword);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_password');
    setIsAdmin(false);
    setAdminPassword('');
    setRsvpList([]);
    setArchivesList([]);
    setSelectedArchive('');
  };

  // Toggle active attendance option
  const handleOptionToggle = (option) => {
    if (activeOptions.includes(option)) {
      setActiveOptions(activeOptions.filter(o => o !== option));
    } else {
      setActiveOptions([...activeOptions, option]);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAlert(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          event_name: eventName,
          event_date: eventDate,
          active_attendance: activeOptions,
          is_rsvp_active: isRsvpActive
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan pengaturan.');
      }

      setAlert({ type: 'success', message: 'Pengaturan acara berhasil disimpan!' });
      
      // Update archive name helper
      const dateStr = eventDate ? ` (${eventDate})` : '';
      setArchiveNameInput(`${eventName}${dateStr}`);
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setAlert({ type: 'danger', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Excel File Selection for student import
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setImportAlert(null); // Clear previous file selection error
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rawRows.length < 2) {
          throw new Error('File excel kosong atau tidak memiliki baris header.');
        }

        // Clean headers and find columns
        const headers = rawRows[0].map(h => String(h || '').trim().toLowerCase());
        const classIdx = headers.findIndex(h => h.includes('kelas'));
        const studentIdx = headers.findIndex(h => h.includes('siswa') || h.includes('nama'));
        const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('surel') || h.includes('mail'));

        if (classIdx === -1 || studentIdx === -1 || emailIdx === -1) {
          const detectedHeaders = rawRows[0].filter(h => h !== null && h !== undefined && String(h).trim() !== '').join(', ');
          throw new Error(`Kolom wajib "Kelas", "Nama Siswa" (atau "Siswa"), dan "Email" belum lengkap di baris pertama Excel. Kolom yang terdeteksi: [${detectedHeaders || 'Tidak Ada'}]. Pastikan ada 3 kolom: Kelas, Nama Siswa, dan Email.`);
        }

        const parsedRows = [];
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          const kelas = row[classIdx];
          const siswa = row[studentIdx];
          const email = row[emailIdx];
          
          if (kelas !== undefined && kelas !== null && String(kelas).trim() !== '' &&
              siswa !== undefined && siswa !== null && String(siswa).trim() !== '') {
            parsedRows.push({
              kelas: String(kelas).trim(),
              siswa: String(siswa).trim(),
              email: email !== undefined && email !== null ? String(email).trim() : ''
            });
          }
        }

        if (parsedRows.length === 0) {
          throw new Error('Tidak ada data siswa yang valid ditemukan di bawah baris header.');
        }

        setImportPreview(parsedRows);
        setImportAlert(null);
      } catch (err) {
        setImportAlert({ type: 'danger', message: err.message });
        setImportPreview(null);
        setSelectedFile(null);
      } finally {
        // Reset target value so selecting the same file again triggers onChange
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download Excel Template with 3 columns (Kelas, Nama Siswa, Email)
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'Kelas': 'Kelas 7',
          'Nama Siswa': 'Muhammad Rayhan',
          'Email': 'rayhan@example.com'
        },
        {
          'Kelas': 'Kelas 7',
          'Nama Siswa': 'Aisyah Az Zahra',
          'Email': 'aisyah@example.com'
        },
        {
          'Kelas': 'Kelas 8',
          'Nama Siswa': 'Ahmad Yusuf',
          'Email': 'yusuf@example.com'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      worksheet['!cols'] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 30 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa');

      XLSX.writeFile(workbook, 'Template_Impor_Siswa_3_Kolom.xlsx');
    } catch (err) {
      setImportAlert({ type: 'danger', message: 'Gagal mengunduh template: ' + err.message });
    }
  };

  // Upload Student Data
  const handleImportSubmit = async () => {
    if (!importPreview || importPreview.length === 0) return;

    setIsImporting(true);
    setAlert(null);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          rows: importPreview
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengimpor data.');
      }

      setAlert({
        type: 'success',
        message: `Berhasil mengimpor ${data.count} siswa & kelas ke database!`
      });
      setImportAlert({
        type: 'success',
        message: `Berhasil mengimpor ${data.count} siswa & kelas ke database!`
      });
      setImportPreview(null);
      setSelectedFile(null);
      
      const classesRes = await fetch('/api/classes');
      const classesData = await classesRes.json();
      setClassList(classesData);
    } catch (err) {
      setAlert({ type: 'danger', message: err.message });
      setImportAlert({ type: 'danger', message: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  // Delete attendance record per student
  const handleDeleteAttendance = async (studentName, className) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kehadiran untuk ananda ${studentName} (${className})?`)) {
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const url = `/api/rsvp?password=${encodeURIComponent(adminPassword)}&student_name=${encodeURIComponent(studentName)}&class_name=${encodeURIComponent(className)}&event_name=${encodeURIComponent(eventName)}`;
      
      const res = await fetch(url, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menghapus data kehadiran.');
      }

      // Remove from active state
      setRsvpList(rsvpList.filter(
        item => !(item.student_name === studentName && item.class_name === className && item.event_name === eventName)
      ));

      setAlert({
        type: 'success',
        message: `Kehadiran siswa ${studentName} berhasil dihapus.`
      });
    } catch (err) {
      setAlert({ type: 'danger', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Save current RSVP list to archive
  const handleArchiveSubmit = async (e) => {
    e.preventDefault();
    if (!archiveNameInput.trim()) {
      setAlert({ type: 'danger', message: 'Nama arsip tidak boleh kosong!' });
      return;
    }

    if (rsvpList.length === 0) {
      setAlert({ type: 'danger', message: 'Tidak ada data kehadiran aktif untuk diarsipkan.' });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menyimpan ${rsvpList.length} data kehadiran ke arsip "${archiveNameInput}"? Data aktif akan dikosongkan.`)) {
      return;
    }

    setIsArchiving(true);
    setAlert(null);

    try {
      const res = await fetch('/api/archives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          archive_name: archiveNameInput,
          event_name: eventName
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengarsipkan data.');
      }

      setAlert({
        type: 'success',
        message: `Berhasil mengarsipkan ${data.count} data kehadiran ke "${archiveNameInput}".`
      });

      // Clear active RSVP list
      setRsvpList([]);
      
      // Reload archive names list
      await loadArchivesList();
    } catch (err) {
      setAlert({ type: 'danger', message: err.message });
    } finally {
      setIsArchiving(false);
    }
  };

  // Export Archive Data as Excel
  const handleExportArchive = async () => {
    if (!selectedArchive) {
      setAlert({ type: 'danger', message: 'Silakan pilih arsip terlebih dahulu.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const res = await fetch(`/api/archives?password=${encodeURIComponent(adminPassword)}&archive_name=${encodeURIComponent(selectedArchive)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal mengambil data arsip.');
      }

      const archiveData = await res.json();

      if (archiveData.length === 0) {
        throw new Error('Arsip terpilih tidak memiliki data.');
      }

      // Format for Excel
      const excelData = archiveData.map((item, index) => ({
        'No': index + 1,
        'Nama Siswa': item.student_name,
        'Kelas': item.class_name,
        'Kehadiran': item.attendance_option,
        'Arsip': item.archive_name,
        'Tanggal Konfirmasi': new Date(item.confirmed_at).toLocaleString('id-ID')
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-fit widths
      const maxLens = {};
      excelData.forEach(row => {
        Object.keys(row).forEach(key => {
          const val = String(row[key] || '');
          maxLens[key] = Math.max(maxLens[key] || 0, val.length);
        });
      });
      worksheet['!cols'] = Object.keys(maxLens).map(key => ({
        wch: Math.max(maxLens[key] + 3, 10)
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Arsip');

      XLSX.writeFile(workbook, `Arsip Kehadiran_${selectedArchive.replace(/\s+/g, '_')}.xlsx`);
      setAlert({ type: 'success', message: `Berhasil mengunduh data arsip: ${selectedArchive}` });
    } catch (err) {
      setAlert({ type: 'danger', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Export list of students who have NOT filled/confirmed attendance
  const handleExportUnsubmitted = async () => {
    setIsLoading(true);
    setAlert(null);

    try {
      // 1. Fetch all students
      const studentsRes = await fetch(`/api/students`);
      if (!studentsRes.ok) throw new Error('Gagal mengambil daftar siswa.');
      
      const allStudents = await studentsRes.json();
      
      if (allStudents.length === 0) {
        throw new Error('Tidak ada data siswa terdaftar. Silakan impor data siswa terlebih dahulu.');
      }

      // 2. Identify who is NOT in the active RSVP list
      const rsvpMap = {};
      rsvpList.forEach(item => {
        const key = `${item.student_name.toLowerCase().trim()}_${item.class_name.toLowerCase().trim()}`;
        rsvpMap[key] = true;
      });

      const unsubmittedStudents = [];
      allStudents.forEach(student => {
        const key = `${student.name.toLowerCase().trim()}_${student.class_name.toLowerCase().trim()}`;
        if (!rsvpMap[key]) {
          unsubmittedStudents.push({
            'Nama Siswa': student.name,
            'Kelas': student.class_name,
            'Email': student.email || '-',
            'Keterangan': 'Belum Konfirmasi Kehadiran'
          });
        }
      });

      if (unsubmittedStudents.length === 0) {
        setAlert({ type: 'success', message: 'Semua siswa terdaftar sudah mengonfirmasi kehadiran!' });
        setIsLoading(false);
        return;
      }

      // Sort by class then name
      unsubmittedStudents.sort((a, b) => {
        const classCompare = a['Kelas'].localeCompare(b['Kelas']);
        if (classCompare !== 0) return classCompare;
        return a['Nama Siswa'].localeCompare(b['Nama Siswa']);
      });

      const excelData = unsubmittedStudents.map((item, index) => ({
        'No': index + 1,
        ...item
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const maxLens = {};
      excelData.forEach(row => {
        Object.keys(row).forEach(key => {
          const val = String(row[key] || '');
          maxLens[key] = Math.max(maxLens[key] || 0, val.length);
        });
      });
      worksheet['!cols'] = Object.keys(maxLens).map(key => ({
        wch: Math.max(maxLens[key] + 3, 10)
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Belum Konfirmasi');

      const fileName = `Siswa_Belum_Konfirmasi_${eventName.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      setAlert({
        type: 'success',
        message: `Berhasil mengunduh rekap ${unsubmittedStudents.length} siswa yang belum konfirmasi kehadiran!`
      });
    } catch (err) {
      setAlert({ type: 'danger', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to build attendance sheet structured rows for Excel (New Feature)
  const generateGenderSheetData = (gender) => {
    const classGroups = {};

    rsvpList.forEach(item => {
      const opt = item.attendance_option.toLowerCase();
      const siswa = item.student_name;
      const kelas = item.class_name;

      if (opt === 'tidak hadir') return;

      const attendees = [];

      // Determine participants based on the attendance options and requested gender
      if (gender === 'L') {
        if (opt === 'ayah dan bunda' || opt === 'ayah' || opt === 'ayah dan akhwat') {
          attendees.push(`Ayah (${siswa})`);
        } else if (opt === 'ayah dan ikhwan') {
          attendees.push(`Ayah (${siswa})`, `Ikhwan (${siswa})`);
        } else if (opt === 'bunda dan ikhwan') {
          attendees.push(`Ikhwan (${siswa})`);
        }
      } else { // 'P'
        if (opt === 'ayah dan bunda' || opt === 'bunda' || opt === 'bunda dan ikhwan') {
          attendees.push(`Bunda (${siswa})`);
        } else if (opt === 'bunda dan akhwat') {
          attendees.push(`Bunda (${siswa})`, `Akhwat (${siswa})`);
        } else if (opt === 'ayah dan akhwat') {
          attendees.push(`Akhwat (${siswa})`);
        }
      }

      if (attendees.length > 0) {
        if (!classGroups[kelas]) {
          classGroups[kelas] = [];
        }
        classGroups[kelas].push(...attendees);
      }
    });

    // 1. Initial page header lines
    const rows = [
      ['SEKOLAH ISLAM MUMTAZ'],
      ['ABSENSI KEHADIRAN'],
      [eventName.toUpperCase()],
      [eventDate ? formatDateDisplay(eventDate).toUpperCase() : ''],
      [], // Blank row spacing
    ];

    // 2. Add classes and their attendees
    const sortedClasses = Object.keys(classGroups).sort();

    sortedClasses.forEach(kelasName => {
      const attendees = classGroups[kelasName].sort();

      rows.push([`Kelas: ${kelasName}`]); // Group header
      rows.push(['Nama', 'Tanda Tangan']); // Column headers

      attendees.forEach(name => {
        rows.push([name, '']); // Left column: name, Right column: blank for signature
      });

      rows.push([]); // Blank separator row
    });

    return rows;
  };

  // Export printed attendance sheet with L & P in separate sheets (New Feature)
  const handleExportAbsensi = () => {
    if (rsvpList.length === 0) {
      setAlert({ type: 'danger', message: 'Tidak ada data konfirmasi untuk membuat absensi.' });
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      // 1. Generate Laki-laki sheet
      const maleRows = generateGenderSheetData('L');
      const maleWorksheet = XLSX.utils.aoa_to_sheet(maleRows);
      
      // Auto-fit or fix widths: Nama column is wider (A), Tanda Tangan is narrower (B)
      maleWorksheet['!cols'] = [
        { wch: 35 }, // Column A (Nama)
        { wch: 20 }  // Column B (Tanda Tangan)
      ];
      XLSX.utils.book_append_sheet(workbook, maleWorksheet, 'Absensi Laki-laki');

      // 2. Generate Perempuan sheet
      const femaleRows = generateGenderSheetData('P');
      const femaleWorksheet = XLSX.utils.aoa_to_sheet(femaleRows);
      femaleWorksheet['!cols'] = [
        { wch: 35 }, // Column A (Nama)
        { wch: 20 }  // Column B (Tanda Tangan)
      ];
      XLSX.utils.book_append_sheet(workbook, femaleWorksheet, 'Absensi Perempuan');

      // Write file download
      XLSX.writeFile(workbook, `Daftar_Absensi_Cetak_${eventName.replace(/\s+/g, '_')}.xlsx`);
      setAlert({ type: 'success', message: 'Berhasil mengunduh daftar absensi cetak (Laki-laki & Perempuan)!' });
    } catch (err) {
      setAlert({ type: 'danger', message: 'Gagal mengekspor absensi: ' + err.message });
    }
  };

  // Calculate Gender Statistics based on RSVP Attendance Options
  const calculateStats = () => {
    let maleTotal = 0;
    let femaleTotal = 0;
    let tidakHadirCount = 0;

    rsvpList.forEach(item => {
      const opt = item.attendance_option.toLowerCase();
      
      if (opt === 'tidak hadir') {
        tidakHadirCount += 1;
        return;
      }

      switch (opt) {
        case 'ayah dan bunda':
          maleTotal += 1;
          femaleTotal += 1;
          break;
        case 'ayah':
          maleTotal += 1;
          break;
        case 'bunda':
          femaleTotal += 1;
          break;
        case 'ayah dan ikhwan':
          maleTotal += 2;
          break;
        case 'bunda dan ikhwan':
          femaleTotal += 1;
          maleTotal += 1;
          break;
        case 'ayah dan akhwat':
          maleTotal += 1;
          femaleTotal += 1;
          break;
        case 'bunda dan akhwat':
          femaleTotal += 2;
          break;
        default:
          break;
      }
    });

    return {
      male: maleTotal,
      female: femaleTotal,
      tidakHadir: tidakHadirCount,
      total: rsvpList.length
    };
  };

  const stats = calculateStats();

  // Filter Attendance List
  const filteredRsvpList = rsvpList.filter(item => {
    const matchSearch = item.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.class_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = classFilter === '' || item.class_name === classFilter;
    return matchSearch && matchClass;
  });

  // Export Attendance Recap (All Data)
  const handleExportAll = () => {
    if (rsvpList.length === 0) {
      setAlert({ type: 'danger', message: 'Tidak ada data kehadiran untuk diekspor.' });
      return;
    }

    try {
      const excelData = rsvpList.map((item, index) => ({
        'No': index + 1,
        'Nama Siswa': item.student_name,
        'Kelas': item.class_name,
        'Kehadiran': item.attendance_option,
        'Acara': item.event_name,
        'Tanggal Konfirmasi': new Date(item.confirmed_at).toLocaleString('id-ID')
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      const maxLens = {};
      excelData.forEach(row => {
        Object.keys(row).forEach(key => {
          const val = String(row[key] || '');
          maxLens[key] = Math.max(maxLens[key] || 0, val.length);
        });
      });
      worksheet['!cols'] = Object.keys(maxLens).map(key => ({
        wch: Math.max(maxLens[key] + 3, 10)
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Kehadiran');

      XLSX.writeFile(workbook, `Rekap_Kehadiran_Mumtaz_${eventName.replace(/\s+/g, '_')}.xlsx`);
      setAlert({ type: 'success', message: 'Berhasil mengunduh file rekap kehadiran!' });
    } catch (err) {
      setAlert({ type: 'danger', message: 'Gagal mengekspor file: ' + err.message });
    }
  };

  // Export Attendance Recap Per Class (Sheets per class inside one workbook)
  const handleExportPerClass = () => {
    if (rsvpList.length === 0) {
      setAlert({ type: 'danger', message: 'Tidak ada data kehadiran untuk diekspor.' });
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      const groupedByClass = {};
      rsvpList.forEach(item => {
        if (!groupedByClass[item.class_name]) {
          groupedByClass[item.class_name] = [];
        }
        groupedByClass[item.class_name].push(item);
      });

      Object.keys(groupedByClass).sort().forEach(className => {
        const classRsvps = groupedByClass[className];
        
        const excelData = classRsvps.map((item, index) => ({
          'No': index + 1,
          'Nama Siswa': item.student_name,
          'Kehadiran': item.attendance_option,
          'Acara': item.event_name,
          'Tanggal Konfirmasi': new Date(item.confirmed_at).toLocaleString('id-ID')
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);

        const maxLens = {};
        excelData.forEach(row => {
          Object.keys(row).forEach(key => {
            const val = String(row[key] || '');
            maxLens[key] = Math.max(maxLens[key] || 0, val.length);
          });
        });
        worksheet['!cols'] = Object.keys(maxLens).map(key => ({
          wch: Math.max(maxLens[key] + 3, 10)
        }));

        const sheetName = className.substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      XLSX.writeFile(workbook, `Rekap_Kehadiran_Per_Kelas_${eventName.replace(/\s+/g, '_')}.xlsx`);
      setAlert({ type: 'success', message: 'Berhasil mengunduh file rekap kehadiran per kelas!' });
    } catch (err) {
      setAlert({ type: 'danger', message: 'Gagal mengekspor file: ' + err.message });
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // If NOT Admin, show Login Screen
  if (!isAdmin) {
    return (
      <div className="app-container">
        <div className="card">
          <div className="card-header">
            <div className="logo-wrapper">
              <Image 
                src="/mumtaz.png" 
                alt="Logo Sekolah Islam Mumtaz" 
                width={80} 
                height={80} 
                priority
                className="logo-img"
              />
            </div>
            <div>
              <h1 className="card-title">Dashboard Admin</h1>
              <p className="card-subtitle">MUMTAZ RSVP SYSTEM</p>
            </div>
          </div>
          <div className="card-body">
            {loginError && (
              <div className="alert alert-danger">
                {loginError}
              </div>
            )}
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-pass">
                  Password Admin
                </label>
                <input
                  id="admin-pass"
                  type="password"
                  className="form-input"
                  placeholder="Ketik password default..."
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || !adminPassword}
              >
                {isLoading ? 'Memverifikasi...' : 'Masuk Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard Content
  return (
    <div className="admin-container">
      {/* Navigation Header */}
      <div className="admin-navbar">
        <div className="admin-brand">
          <Image 
            src="/mumtaz.png" 
            alt="Logo" 
            width={35} 
            height={35} 
            style={{ borderRadius: '50%', background: 'white', padding: '2px' }}
          />
          <span>ADMIN SEKOLAH ISLAM MUMTAZ</span>
        </div>
        <button className="admin-logout" onClick={handleLogout}>
          Keluar
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ maxWidth: '100%' }}>
          {alert.message}
        </div>
      )}

      {/* Main Grid Section */}
      <div className="admin-grid">
        {/* Left Side: Configuration, Import & Archive forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section 1: Settings Form */}
          <div className="card">
            <div className="card-header" style={{ padding: '20px 15px', borderBottom: '2px solid var(--accent-gold)' }}>
              <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Pengaturan Kegiatan</h2>
            </div>
            <div className="card-body" style={{ padding: '20px' }}>
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label className="form-label">Nama Kegiatan (Acara)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Contoh: Pertemuan Wali Murid"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Tanggal Acara</label>
                  <input
                    type="date"
                    className="form-input"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status Konfirmasi Kehadiran</label>
                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={isRsvpActive}
                        onChange={(e) => setIsRsvpActive(e.target.checked)}
                      />
                      <span style={{ fontWeight: '500' }}>Buka Konfirmasi Kehadiran (Orang tua dapat mengisi)</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Opsi Kehadiran Aktif</label>
                  <div className="checkbox-group">
                    {ALL_ATTENDANCE_OPTIONS.map(option => (
                      <label key={option} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={activeOptions.includes(option)}
                          onChange={() => handleOptionToggle(option)}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                  style={{ padding: '10px' }}
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </form>
            </div>
          </div>

          {/* Section 2: Archive Manager Form */}
          <div className="card">
            <div className="card-header" style={{ padding: '20px 15px', borderBottom: '2px solid var(--accent-gold)' }}>
              <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Manajemen Arsip Kehadiran</h2>
            </div>
            <div className="card-body" style={{ padding: '20px' }}>
              {/* Archive current RSVPs */}
              <form onSubmit={handleArchiveSubmit} style={{ marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Nama Arsip Baru</label>
                  <input
                    type="text"
                    className="form-input"
                    value={archiveNameInput}
                    onChange={(e) => setArchiveNameInput(e.target.value)}
                    placeholder="Nama Acara (Tanggal)"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={isArchiving || rsvpList.length === 0}
                  style={{ padding: '10px', fontSize: '0.9rem' }}
                >
                  📁 Simpan Data Aktif Ke Arsip
                </button>
              </form>

              {/* View/Export existing archives */}
              <div>
                <div className="form-group">
                  <label className="form-label">Daftar Arsip Tersimpan</label>
                  <select
                    className="form-select"
                    value={selectedArchive}
                    onChange={(e) => setSelectedArchive(e.target.value)}
                    style={{ fontSize: '0.9rem' }}
                  >
                    <option value="">-- Pilih Arsip --</option>
                    {archivesList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExportArchive}
                  disabled={isLoading || !selectedArchive}
                  style={{ padding: '10px', fontSize: '0.9rem' }}
                >
                  📥 Ekspor Arsip Terpilih
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Import Student Excel */}
          <div className="card">
            <div className="card-header" style={{ padding: '20px 15px', borderBottom: '2px solid var(--accent-gold)' }}>
              <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Impor Data Siswa (Excel)</h2>
            </div>
            <div className="card-body" style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--primary-navy)', marginBottom: '10px', lineHeight: '1.4' }}>
                  Unggah file Excel (.xlsx) dengan 3 kolom pada baris pertama: <strong>Kelas</strong>, <strong>Nama Siswa</strong> (atau <strong>Siswa</strong>), dan <strong>Email</strong>.
                </p>
                <div style={{ marginBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn btn-secondary"
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      fontSize: '0.82rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '6px',
                      background: '#F1F5F9',
                      color: 'var(--primary-navy)',
                      border: '1px solid #CBD5E1'
                    }}
                  >
                    📥 Unduh Contoh Template Excel (3 Kolom)
                  </button>
                </div>
                {importAlert && (
                  <div className={`alert alert-${importAlert.type}`} style={{ padding: '10px 15px', fontSize: '0.85rem', marginBottom: '12px' }}>
                    {importAlert.message}
                  </div>
                )}
                <div 
                  className="upload-area" 
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <div className="upload-icon">📂</div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                    {selectedFile ? selectedFile.name : 'Pilih File Excel'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '5px' }}>
                    {selectedFile ? 'Klik untuk mengganti file' : 'Mendukung format .xlsx / .xls'}
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept=".xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {importPreview && (
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Pratinjau Data:</span>
                    <span style={{ color: 'var(--accent-gold-hover)' }}>{importPreview.length} baris terdeteksi</span>
                  </div>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px', fontSize: '0.8rem', background: '#F8FAFC' }}>
                    {importPreview.slice(0, 5).map((row, i) => (
                      <div key={i} style={{ borderBottom: '1px solid #EDF2F7', padding: '4px 0', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <strong>[{row.kelas}]</strong> {row.siswa}
                        </div>
                        <div style={{ color: '#64748B', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.email || '(tanpa email)'}
                        </div>
                      </div>
                    ))}
                    {importPreview.length > 5 && (
                      <div style={{ fontStyle: 'italic', color: '#94A3B8', marginTop: '3px' }}>
                        ... dan {importPreview.length - 5} siswa lainnya.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                disabled={isImporting || !importPreview}
                onClick={handleImportSubmit}
                style={{ padding: '10px' }}
              >
                {isImporting ? 'Mengimpor...' : 'Mulai Impor Data'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Statistics & RSVP List Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Statistics Cards */}
          <div className="stats-panel" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card total" style={{ gridColumn: 'span 2' }}>
              <span className="stat-label">Total Konfirmasi</span>
              <div className="stat-num">{stats.total}</div>
            </div>
            <div className="stat-card" style={{ gridColumn: 'span 2', borderLeft: '5px solid #F1C40F' }}>
              <span className="stat-label">Keterangan Tidak Hadir</span>
              <div className="stat-num">{stats.tidakHadir}</div>
            </div>
            <div className="stat-card laki-laki" style={{ gridColumn: 'span 2' }}>
              <span className="stat-label">Hadir Laki-laki (Ayah & Ikhwan)</span>
              <div className="stat-num">{stats.male}</div>
            </div>
            <div className="stat-card perempuan" style={{ gridColumn: 'span 2' }}>
              <span className="stat-label">Hadir Perempuan (Bunda & Akhwat)</span>
              <div className="stat-num">{stats.female}</div>
            </div>
          </div>

          {/* Recap RSVP Table List */}
          <div className="card">
            <div className="card-header" style={{ padding: '20px 25px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <h2 className="card-title" style={{ fontSize: '1.2rem', margin: 0 }}>Rekap Konfirmasi Kehadiran</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="admin-logout" 
                    onClick={() => verifyPasswordAndLoad(adminPassword)} 
                    style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'transparent' }}
                  >
                    Segarkan
                  </button>
                </div>
              </div>

              {/* Action Buttons for Excel Download */}
              <div className="export-actions" style={{ width: '100%', display: 'flex', gap: '10px', marginTop: '5px' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleExportAll}
                  style={{ padding: '10px 15px', fontSize: '0.85rem' }}
                >
                  📥 Ekspor Rekap Umum
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleExportPerClass}
                  style={{ padding: '10px 15px', fontSize: '0.85rem' }}
                >
                  📂 Ekspor per Kelas (Sheets)
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleExportUnsubmitted}
                  style={{ padding: '10px 15px', fontSize: '0.85rem', background: '#E74C3C', border: '1px solid #C0392B', color: 'white' }}
                >
                  ⚠️ Ekspor Siswa Belum Mengisi
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleExportAbsensi}
                  style={{ padding: '10px 15px', fontSize: '0.85rem', background: '#2ECC71', border: '1px solid #27AE60', color: 'white' }}
                >
                  📝 Ekspor Daftar Absensi (L & P)
                </button>
              </div>

              {/* Filter controls */}
              <div className="search-bar" style={{ width: '100%', margin: 0 }}>
                <input
                  type="text"
                  className="form-input search-input"
                  placeholder="Cari siswa atau kelas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                />
                
                <select
                  className="form-select"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  style={{ width: 'auto', padding: '8px 12px', fontSize: '0.9rem', minWidth: '150px' }}
                >
                  <option value="">-- Semua Kelas --</option>
                  {classList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card-body" style={{ padding: '0px 25px 25px 25px' }}>
              <div className="table-container">
                <table className="recap-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>No</th>
                      <th>Siswa</th>
                      <th>Kelas</th>
                      <th>Pilihan Kehadiran</th>
                      <th>Waktu Konfirmasi</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRsvpList.length > 0 ? (
                      filteredRsvpList.map((item, index) => (
                        <tr key={item.id || index}>
                          <td>{index + 1}</td>
                          <td style={{ fontWeight: '600' }}>{item.student_name}</td>
                          <td>{item.class_name}</td>
                          <td style={{ textTransform: 'capitalize' }}>
                            <span style={{ 
                              background: item.attendance_option.toLowerCase() === 'tidak hadir' ? '#FDEDEC' : '#F0F4F8', 
                              color: item.attendance_option.toLowerCase() === 'tidak hadir' ? '#C0392B' : 'inherit',
                              padding: '4px 8px', 
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              borderLeft: `3px solid ${item.attendance_option.toLowerCase() === 'tidak hadir' ? '#C0392B' : 'var(--accent-gold)'}`
                            }}>
                              {item.attendance_option}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {new Date(item.confirmed_at).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteAttendance(item.student_name, item.class_name)}
                              className="admin-logout"
                              style={{ 
                                padding: '3px 8px', 
                                fontSize: '0.75rem', 
                                border: '1px solid #E74C3C', 
                                color: '#E74C3C',
                                background: 'transparent'
                              }}
                              onMouseOver={(e) => {
                                e.target.style.background = '#E74C3C';
                                e.target.style.color = '#fff';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.background = 'transparent';
                                e.target.style.color = '#E74C3C';
                              }}
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Belum ada data konfirmasi kehadiran yang sesuai filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
