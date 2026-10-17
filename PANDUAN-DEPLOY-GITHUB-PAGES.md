# Panduan Deploy PASA 17 ke GitHub Pages

Isi ZIP ini adalah **seluruh situs depan** (HTML/CSS/JS). Backend (Google Apps Script) sudah Anda pasang terpisah dan **tidak** ada di ZIP ini.

## Sebelum mulai
1. Punya akun GitHub dan Git terpasang (`git --version` harus keluar versinya).
2. Buka `https://script.google.com/macros/s/ID_DEPLOYMENT_ANDA/exec?action=ping` di browser. Harus tampil `{"success":true,...}`.
3. Buka `js/config.js`, pastikan `GAS_URL` berisi URL `/exec` Anda yang benar (salin langsung dari dialog Deploy, jangan diketik ulang).

## Langkah
1. **Ekstrak ZIP** ke folder baru, misalnya `pasa17-web`. Di dalamnya harus langsung terlihat `index.html`, `css`, `js` (bukan folder lagi di dalam folder).
2. Buka terminal **di dalam folder itu** dan cek: `dir` (Windows) atau `ls` (Mac/Linux). `index.html` harus muncul.
3. Buat repositori kosong di github.com (nama bebas, mis. `pasa17`, Public, tanpa README).
4. Jalankan di folder tadi:
   ```
   git init
   git add .
   git commit -m "PASA 17 pertama"
   ```
5. Hubungkan dan unggah (ganti USERNAME dan NAMA-REPO):
   ```
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
6. Di GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
7. Tunggu 1–2 menit. Situs hidup di `https://USERNAME.github.io/NAMA-REPO/`.

## Memperbarui situs
Ubah berkas, lalu: `git add .` → `git commit -m "ubah"` → `git push`.

## Sebelum membuka pendaftaran
- Isi sheet **Pengaturan** (rekening, atas nama, kontak, link grup WA, tanggal) dan konten.
- Lakukan 1 pendaftaran percobaan di situs asli, cek tiket/email, lalu hapus dari Tempat Sampah admin.
- Periksa teks statis di beranda yang berasal dari desain: 16 Edisi, rasio 1:6, 100%, 24 Jam.
- Nomor rekening di PRD tertulis dua versi (717-002-1717 vs 717 0017 178): pastikan yang benar.

## Portal Admin (tahap 2)
- Buka `https://USERNAME.github.io/NAMA-REPO/admin.html` (atau tombol "Portal Admin" di navbar/footer).
- Masuk dengan akun `panitia` dan password acak yang tercetak SEKALI saat Anda menjalankan `setupAppEnvironment()` di Apps Script (lihat log eksekusi). Segera ganti di menu **Akun & Sistem**.
- Menu: Ringkasan Kuota, Verifikasi Bayar, Data Peserta, Scan QR / Masuk, Konten Situs, Pengaturan, Akun & Sistem.
- Scan QR lewat kamera hanya jalan di HTTPS (GitHub Pages sudah HTTPS) dan butuh izin kamera. Cadangan: ketik kode tiket manual.
- Sebelum membuka pendaftaran: isi **Pengaturan → Infaq & Rekening** (nomor rekening wajib), kontak, dan link grup WA.

## Memperbarui situs yang sudah tayang dengan ZIP baru
1. Ekstrak ZIP baru ke folder repositori Anda yang lama (yang berisi folder `.git`), timpa berkas yang sama.
2. JANGAN menimpa `js/config.js` (isinya alamat server Anda yang sudah benar). Bila terlanjur, isi ulang `GAS_URL`.
3. Di terminal pada folder itu: `git add .` lalu `git commit -m "tambah portal admin"` lalu `git push`.
