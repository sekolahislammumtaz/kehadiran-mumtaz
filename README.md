# Aplikasi Konfirmasi Kehadiran Sekolah Islam Mumtaz

Aplikasi web berbasis Next.js untuk memudahkan orang tua murid mengonfirmasi kehadiran pada kegiatan Sekolah Islam Mumtaz, menyimpan data ke database cloud (**Supabase** / Local Fallback), dan meneruskan konfirmasi via WhatsApp.

## Fitur Utama

1. **Halaman RSVP Wali Murid**:
   - Pilihan kelas berbasis dropdown dinamis.
   - Pilihan nama siswa otomatis berbasis autocomplete (berdasarkan data siswa per kelas).
   - Pengiriman konfirmasi kehadiran secara instan melalui integrasi redirect WhatsApp dengan format teks dinamis.
   
2. **Halaman Dashboard Admin (`/admin`)**:
   - Dilindungi password keamanan (Default: `SiMumtaz123`).
   - Ubah Nama Kegiatan dan Tanggal Kegiatan.
   - Aktifkan/nonaktifkan opsi variasi kehadiran orang tua (termasuk "Tidak Hadir").
   - Statistik real-time total konfirmasi, keterangan tidak hadir, total Laki-laki hadir (Ayah & Ikhwan), dan total Perempuan hadir (Bunda & Akhwat).
   - Fitur **Hapus Kehadiran** per siswa secara manual langsung dari tabel rekap.
   - Fitur **Arsip Kehadiran**: Simpan data kehadiran aktif ke dalam arsip dengan format penamaan custom `(Acara) (Tanggal)`.
   - Fitur **Ekspor Arsip**: Pilih dan unduh rekap data arsip tertentu kapan saja dalam format Excel.
   - Fitur **Impor Data Siswa (Excel 3 Kolom)**: Unggah data siswa, kelas & email dari file `.xlsx`, dilengkapi tombol unduh contoh template.
   - Fitur **Ekspor Rekap (Excel)**: Rekap umum dan rekap per kelas (setiap kelas menjadi sheet tersendiri).
   - Fitur **Ekspor Siswa Belum Mengisi (Excel)**: Mengunduh data siswa yang belum mengirimkan konfirmasi kehadiran beserta emailnya.
   - Fitur **Ekspor Daftar Absensi Cetak (L & P)**: Daftar tanda tangan terpisah untuk jamaah ikhwan/laki-laki dan akhwat/perempuan.

---

## Konfigurasi Database Supabase (Untuk Produksi & Vercel)

Untuk menyimpan data secara permanen di cloud (gratis), gunakan **Supabase** (PostgreSQL berbasis cloud).

### 1. Buat Tabel di SQL Editor Supabase
1. Buka dashboard proyek Anda di [supabase.com](https://supabase.com).
2. Di menu samping kiri, klik **SQL Editor**.
3. Klik **New query**, lalu tempel kode SQL berikut dan klik **Run**:

```sql
-- 1. Tabel untuk menyimpan kelas
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel untuk menyimpan siswa
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    class_id INT REFERENCES classes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name, class_id)
);

-- Pastikan kolom email ada jika tabel sudah pernah dibuat sebelumnya
ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 3. Tabel untuk menyimpan konfirmasi kehadiran
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    attendance_option VARCHAR(100) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_name, class_name, event_name)
);

-- 4. Tabel untuk menyimpan arsip kehadiran
CREATE TABLE IF NOT EXISTS archives (
    id SERIAL PRIMARY KEY,
    archive_name VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    attendance_option VARCHAR(100) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabel untuk pengaturan
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL
);

-- 6. Data awal pengaturan
INSERT INTO settings (key, value) VALUES
('event_name', '"Pertemuan Wali Murid"'),
('event_date', '"2026-08-01"'),
('active_attendance', '["ayah dan bunda", "ayah", "bunda", "tidak hadir"]'),
('is_rsvp_active', 'true')
ON CONFLICT (key) DO NOTHING;
```

---

### 2. Pasang Environment Variables di Vercel

Buka proyek Anda di [vercel.com](https://vercel.com) -> **Settings** -> **Environment Variables**, lalu tambahkan:

| Key | Value | Keterangan |
|---|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Dari Supabase -> Project Settings -> API -> Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Dari Supabase -> Project Settings -> API -> `service_role` (secret) |
| `ADMIN_PASSWORD` | `SiMumtaz123` | Password untuk masuk ke dashboard `/admin` |

> 💡 **Kenapa menggunakan SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY?**  
> Jalur ini menggunakan HTTPS REST API port 443 yang resmi dan sangat cepat di Vercel. Jalur ini **kebal dari kendala IPv6** yang sering terjadi pada direct connection PostgreSQL (`db.xxxx.supabase.co:5432`).

---

## Menjalankan Secara Lokal (Development)

1. Buat file `.env.local` di folder proyek ini:
   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ADMIN_PASSWORD=SiMumtaz123
   ```
   *(Jika `.env.local` belum diisi, aplikasi akan otomatis menggunakan fallback database lokal `src/lib/mock_db.json` agar Anda bisa mengujinya secara instan tanpa internet).*

2. Jalankan aplikasi:
   ```bash
   npm run dev
   ```

3. Buka browser:
   - Halaman Tamu/Wali Murid: `http://localhost:3000`
   - Halaman Admin: `http://localhost:3000/admin` (Password: `SiMumtaz123`)

---

## Format File Excel Impor Siswa
Untuk mengimpor data siswa di halaman admin, buat berkas Excel `.xlsx` dengan format 3 kolom sebagai berikut (baris pertama harus header):

| Kelas   | Nama Siswa        | Email                 |
|---------|-------------------|-----------------------|
| Kelas 7 | Muhammad Rayhan   | rayhan@example.com    |
| Kelas 7 | Aisyah Az Zahra   | aisyah@example.com    |
| Kelas 8 | Ahmad Yusuf       | yusuf@example.com     |

*Catatan: Nama kolom bersifat case-insensitive. Sistem secara otomatis mendeteksi kolom "Kelas", "Nama Siswa" (atau "Siswa"), dan "Email" (atau "Surel"). Anda juga dapat langsung mengunduh template Excel siap pakai melalui tombol di halaman Admin.*
