# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Tahap 6: Dokumen dan Validasi Data Siswa

Wali dapat menyimpan draf validasi dan melengkapi data yang wajib sebelum menyelesaikan pendaftaran. Untuk alumni, data yang tersedia di Amanah mengisi kolom kosong otomatis saat formulir dibuka, menggunakan NISN yang tersimpan di tahap 3. Isian yang sudah ada tidak ditimpa. Jika NISN tidak ditemukan atau ada beberapa data alumni, lengkapi manual atau hubungi TU. Data validasi disimpan di database SPMB, bukan otomatis ditulis kembali ke Amanah.

Backend membuat tabel `student_validations` saat dimulai melalui `db.sync()`. Mulai ulang backend setelah memperbarui aplikasi dan pastikan akun database memiliki izin membuat tabel. Validasi data berlaku untuk semua pendaftar, termasuk pendaftar yang sebelumnya sudah mengunggah dokumen.

NISN bukan bukti kepemilikan akun. Pengambilan data tanpa autentikasi Amanah berisiko membuka data pribadi kepada pihak yang mengetahui NISN; gunakan verifikasi pemilik akun sebelum menerapkan alur ini di lingkungan publik.

## Pengumuman hasil tes

Guru atau TU menyimpan hasil tes sebagai draf. TU memilih tanggal dan gelombang lalu menekan tombol untuk mengumumkan draf pada gelombang tersebut di lembaganya. Gelombang yang masih dipakai draf tidak dapat dihapus. Tanggal hanya informasi: hasil langsung terlihat ketika tombol ditekan, bukan pada jadwal otomatis. Draf berikutnya perlu diumumkan lagi; hasil yang sudah diumumkan sebelum fitur ini tetap terlihat. Hasil selain lulus tetap tampil di tahap 4.

Backend membuat tabel `exam_announcements` saat dimulai melalui `db.sync()`. Mulai ulang backend setelah memperbarui aplikasi dan pastikan akun database memiliki izin membuat tabel.
