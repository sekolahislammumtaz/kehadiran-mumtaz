import "./globals.css";

export const metadata = {
  title: "Konfirmasi Kehadiran Orang Tua - SEKOLAH ISLAM MUMTAZ",
  description: "Form konfirmasi kehadiran kegiatan orang tua / wali murid Sekolah Islam Mumtaz",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
