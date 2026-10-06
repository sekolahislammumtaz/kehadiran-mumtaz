'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

export default function Home() {
  // Settings & Options States
  const [eventSettings, setEventSettings] = useState({
    event_name: 'Loading...',
    event_date: '',
    active_attendance: [],
    is_rsvp_active: true
  });
  const [classList, setClassList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  
  // Selected fields
  const [selectedClass, setSelectedClass] = useState('');
  const [studentInput, setStudentInput] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedAttendance, setSelectedAttendance] = useState('');

  // UI States
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const autocompleteRef = useRef(null);

  // Fetch settings and classes on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const settingsRes = await fetch('/api/settings');
        const settingsData = await settingsRes.json();
        setEventSettings(settingsData);

        const classesRes = await fetch('/api/classes');
        const classesData = await classesRes.json();
        setClassList(classesData);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setAlert({
          type: 'danger',
          message: 'Gagal memuat data dari server. Silakan coba beberapa saat lagi.'
        });
      }
    }
    loadInitialData();
  }, []);

  // Fetch students when class changes
  useEffect(() => {
    if (!selectedClass) {
      setStudentList([]);
      setStudentInput('');
      setSelectedStudent(null);
      return;
    }

    async function loadStudents() {
      try {
        setStudentInput('');
        setSelectedStudent(null);
        const res = await fetch(`/api/students?class=${encodeURIComponent(selectedClass)}`);
        const data = await res.json();
        setStudentList(data);
      } catch (err) {
        console.error('Error loading students:', err);
      }
    }
    loadStudents();
  }, [selectedClass]);

  // Handle autocomplete input changes
  const handleStudentInputChange = (e) => {
    const val = e.target.value;
    setStudentInput(val);
    setSelectedStudent(null); // Reset selection since they are typing

    if (val.trim() === '') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Filter students matching query
    const filtered = studentList.filter(studentName =>
      studentName.toLowerCase().includes(val.toLowerCase())
    );

    setSuggestions(filtered);
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
  };

  // Select suggestion
  const selectSuggestion = (studentName) => {
    setStudentInput(studentName);
    setSelectedStudent(studentName);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeSuggestionIndex < suggestions.length - 1) {
        setActiveSuggestionIndex(prev => prev + 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeSuggestionIndex > 0) {
        setActiveSuggestionIndex(prev => prev - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        selectSuggestion(suggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close autocomplete on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date helper (Indonesian)
  const formatIndonesianDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Submit RSVP
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
    if (!selectedClass) {
      setAlert({ type: 'danger', message: 'Silakan pilih kelas terlebih dahulu!' });
      return;
    }

    // Must select a student from list
    const finalStudent = selectedStudent || studentList.find(
      s => s.toLowerCase() === studentInput.trim().toLowerCase()
    );

    if (!finalStudent) {
      setAlert({ type: 'danger', message: 'Nama siswa tidak terdaftar di kelas ini. Silakan pilih dari saran autocomplete!' });
      return;
    }

    if (!selectedAttendance) {
      setAlert({ type: 'danger', message: 'Silakan pilih opsi kehadiran!' });
      return;
    }

    setIsLoading(true);
    setAlert(null);

    const rsvpData = {
      student_name: finalStudent,
      class_name: selectedClass,
      attendance_option: selectedAttendance,
      event_name: eventSettings.event_name
    };

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rsvpData)
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Terjadi kesalahan saat menyimpan konfirmasi.');
      }

      setAlert({
        type: 'success',
        message: 'Konfirmasi kehadiran berhasil disimpan! Terima kasih atas konfirmasinya.'
      });

      // Reset form fields
      setSelectedClass('');
      setStudentInput('');
      setSelectedStudent(null);
      setSelectedAttendance('');
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setAlert({
        type: 'danger',
        message: err.message || 'Gagal mengirim konfirmasi. Silakan coba lagi.'
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card">
        {/* Card Header with Logo */}
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
            <h1 className="card-title">Konfirmasi Kehadiran Orang Tua</h1>
            <p className="card-subtitle">Sekolah Islam Mumtaz</p>
          </div>

          {/* Event Details Panel */}
          <div className="event-details-bar">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className="event-label">Kegiatan (Acara)</span>
              <span className="event-val" style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                {eventSettings.event_name}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '6px' }}>
              <span className="event-label">Tanggal</span>
              <span className="event-val">
                {formatIndonesianDate(eventSettings.event_date) || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Card Body with RSVP Form */}
        <div className="card-body">
          {alert && (
            <div className={`alert alert-${alert.type}`}>
              {alert.message}
            </div>
          )}

          {eventSettings.is_rsvp_active === false ? (
            <div className="alert alert-danger" style={{ textAlign: 'center', margin: '10px 0 0 0', padding: '25px 20px', fontWeight: '700', fontSize: '1.1rem', color: '#C0392B', background: '#FDEDEC', border: '1.5px solid #FADBD8', borderRadius: '12px' }}>
              ⚠️ Konfirmasi kehadiran sudah ditutup
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Class Dropdown */}
              <div className="form-group">
                <label className="form-label" htmlFor="class-select">
                  Kelas
                </label>
                <select
                  id="class-select"
                  className="form-select"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classList.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student Autocomplete Input */}
              <div className="form-group" ref={autocompleteRef}>
                <label className="form-label" htmlFor="student-input">
                  Siswa
                </label>
                <div className="autocomplete-container">
                  <input
                    id="student-input"
                    type="text"
                    className="form-input"
                    placeholder={selectedClass ? "Ketik nama siswa..." : "Pilih kelas terlebih dahulu"}
                    value={studentInput}
                    onChange={handleStudentInputChange}
                    onKeyDown={handleKeyDown}
                    disabled={!selectedClass}
                    autoComplete="off"
                    required
                  />
                  
                  {showSuggestions && (
                    <ul className="suggestions-list">
                      {suggestions.length > 0 ? (
                        suggestions.map((studentName, index) => (
                          <li
                            key={studentName}
                            className={`suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                            onClick={() => selectSuggestion(studentName)}
                          >
                            {studentName}
                          </li>
                        ))
                      ) : (
                        <li className="no-suggestions">Siswa tidak ditemukan</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Attendance Dropdown */}
              <div className="form-group">
                <label className="form-label" htmlFor="attendance-select">
                  Kehadiran
                </label>
                <select
                  id="attendance-select"
                  className="form-select"
                  value={selectedAttendance}
                  onChange={(e) => setSelectedAttendance(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Kehadiran --</option>
                  {eventSettings.active_attendance && eventSettings.active_attendance.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Confirm Button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || !selectedClass || !studentInput || !selectedAttendance}
                style={{ marginTop: '10px' }}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Memproses...
                  </>
                ) : (
                  'Konfirmasi'
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="footer-text">
        © 2026 SEKOLAH ISLAM MUMTAZ • BANDAR LAMPUNG
      </div>
    </div>
  );
}
