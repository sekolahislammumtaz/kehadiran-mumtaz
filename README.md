# Aplikasi Konfirmasi Kehadiran Sekolah Islam Mumtaz

Aplikasi web berbasis Next.js untuk memudahkan orang tua murid mengonfirmasi kehadiran pada kegiatan Sekolah Islam Mumtaz, menyimpan data ke database, dan meneruskan konfirmasi via WhatsApp.

## Fitur Utama

1. **Halaman RSVP Wali Murid**:
   - Pilihan kelas berbasis dropdown dinamis.
   - Pilihan nama siswa otomatis berbasis autocomplete (berdasarkan data siswa per kelas).
   - Pengiriman konfirmasi kehadiran secara instan melalui integrasi redirect WhatsApp dengan format teks dinamis.
   
2. **Halaman Dashboard Admin (`/admin`)**:
   - Dilindungi password keamanan (Default: `SiMumtaz123`).
   - Ubah Nama Kegiatan dan Tanggal Kegiatan.
   - Aktifkan/nonaktifkan 8 opsi variasi kehadiran orang tua (termasuk "Tidak Hadir").
   - Statistik real-time total konfirmasi, keterangan tidak hadir, total Laki-laki hadir (Ayah & Ikhwan), dan total Perempuan hadir (Bunda & Akhwat).
   - Fitur **Hapus Kehadiran** per siswa secara manual langsung dari tabel rekap.
   - Fitur **Arsip Kehadiran**: Simpan data kehadiran aktif ke dalam arsip dengan format penamaan custom `(Acara) (Tanggal)`.
   - Fitur **Ekspor Arsip**: Pilih dan unduh rekap data arsip tertentu kapan saja dalam format Excel.
   - Fitur **Impor Data Siswa (Excel)**: Unggah data siswa & kelas dari file `.xlsx`.
   - Fitur **Ekspor Rekap (Excel)**: Rekap umum dan rekap per kelas (setiap kelas menjadi sheet tersendiri).
   - Fitur **Ekspor Siswa Belum Mengisi (Excel)**: Mengunduh data siswa yang terdaftar di kelas namun belum mengirimkan konfirmasi kehadiran.

---

## Cara Menjalankan Secara Lokal (Instan)

Aplikasi ini dilengkapi fitur **Auto-Fallback**. Jika Anda belum mengonfigurasi database Supabase, aplikasi akan otomatis menggunakan database lokal sederhana (`src/lib/mock_db.json`) agar Anda bisa mengujinya secara instan!

1. Install dependensi:
   ```bash
   npm install
   ```

2. Jalankan development server:
   ```bash
   npm run dev
   ```

3. Buka [http://localhost:3000](http://localhost:3000) untuk halaman RSVP orang tua, dan [http://localhost:3000/admin](http://localhost:3000/admin) untuk halaman admin (Password: `SiMumtaz123`).

---

## Konfigurasi Database Supabase (Untuk Produksi / Deploy Vercel)

Untuk menyimpan data secara permanen di cloud (gratis), buat database PostgreSQL di [Supabase](https://supabase.com/).

### 1. Eksekusi Skrip SQL DDL
Buka menu **SQL Editor** di dashboard Supabase Anda, buat query baru, tempel kode SQL berikut, lalu klik **Run**:

```sql
-- Tabel untuk menyimpan kelas
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk menyimpan siswa
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name, class_id)
);

-- (Catatan: Jika tabel students sudah pernah dibuat sebelumnya, jalankan query migrasi ini:)
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Tabel untuk menyimpan konfirmasi kehadiran
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    attendance_option VARCHAR(100) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_name, class_name, event_name)
);

-- Tabel untuk menyimpan arsip kehadiran
CREATE TABLE archives (
    id SERIAL PRIMARY KEY,
    archive_name VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    attendance_option VARCHAR(100) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel untuk pengaturan (Nama Acara, Tanggal Acara, Pilihan Kehadiran Aktif)
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL
);
```

### 2. Mengisi Data Pengaturan Awal
Eksekusi juga SQL ini untuk memberikan data awal pada konfigurasi kegiatan:

```sql
INSERT INTO settings (key, value) VALUES
('event_name', '"Pertemuan Wali Murid"'),
('event_date', '"2026-08-01"'),
('active_attendance', '["ayah dan bunda", "ayah", "bunda", "tidak hadir"]');
```

---

## Deployment di Vercel

1. Buat repositori baru di GitHub dan hubungkan dengan folder proyek ini.
2. Impor proyek tersebut ke [Vercel](https://vercel.com).
3. Di pengaturan proyek Vercel, tambahkan **Environment Variables** berikut:
   - `SUPABASE_URL` : (Ambil dari Supabase Dashboard -> Settings -> API -> Project URL)
   - `SUPABASE_SERVICE_ROLE_KEY` : (Ambil dari Supabase Dashboard -> Settings -> API -> `service_role` api key)
   - `ADMIN_PASSWORD` : `SiMumtaz123` (atau password lain sesuai keinginan Anda)
4. Klik **Deploy** dan aplikasi Anda sudah online!

---

## Format File Excel Impor Siswa
Untuk mengimpor data siswa di halaman admin, buat berkas Excel `.xlsx` dengan format 3 kolom sebagai berikut (baris pertama harus header):

| Kelas   | Nama Siswa        | Email                 |
|---------|-------------------|-----------------------|
| Kelas 7 | Muhammad Rayhan   | rayhan@example.com    |
| Kelas 7 | Aisyah Az Zahra   | aisyah@example.com    |
| Kelas 8 | Ahmad Yusuf       | yusuf@example.com     |

*Catatan: Nama kolom bersifat case-insensitive. Sistem secara otomatis mendeteksi kolom "Kelas", "Nama Siswa" (atau "Siswa"), dan "Email" (atau "Surel"). Anda juga dapat langsung mengunduh template Excel siap pakai melalui tombol di halaman Admin.*
