# Absensi PJLP

Aplikasi absensi **PJLP** berbasis web untuk **GitHub Pages** dengan backend
**Google Apps Script + Google Sheets**. Login memakai **Email + Password**
(tanpa Google Cloud/OAuth).

Fitur:

- 🔐 **Login Email + Password** (dibuat sendiri di aplikasi).
- 👤 **Daftar mandiri → disetujui admin** sebelum bisa absen.
- ✅ **Jenis (Masuk/Pulang) & status keterlambatan OTOMATIS** sesuai jam kerja.
- ⏱️ **Buffer/toleransi** masuk & pulang (diatur admin).
- 📍 **Geofence** radius kampus (divalidasi server). Bisa dimatikan via **Mode Uji Coba**.
- 📓 **Jurnal Kegiatan** wajib **foto** (disimpan ke Google Drive).
- 🔔 **Pengingat jurnal tiap 2 jam** (notifikasi + bunyi saat aplikasi terbuka).
- 📋 **Rekap per-pengguna**: tiap orang hanya melihat datanya; **admin melihat semua**. Ekspor CSV.
- 🛡️ **Panel admin**: setujui/blokir/hapus pegawai, reset password, atur lokasi, jam kerja, buffer, mode uji coba, daftar email admin.

```
Browser (login email+password) ─→ GitHub Pages (statis)
       │  kirim token sesi + data
       ▼
 Google Apps Script  ← verifikasi token, validasi lokasi/izin, filter rekap
       │
   ┌───┴────┐
   ▼        ▼
 Sheets   Drive (foto)
```

> **Keamanan.** Password disimpan ter-*hash* (SHA-256) di Sheet, dan setiap
> permintaan diverifikasi token di server. Validasi lokasi & izin dilakukan di
> server sehingga tidak mudah dimanipulasi. Memadai untuk kebutuhan instansi;
> bukan anti-bobol mutlak.

---

## Bagian 1 — Pasang Backend (Apps Script)

1. Buka Google Sheet baru (<https://sheet.new>) → **Ekstensi → Apps Script**.
2. Hapus kode contoh, tempel **seluruh** isi [`google-apps-script/Code.gs`](google-apps-script/Code.gs). **Simpan**.
3. Jalankan fungsi **`setup`** sekali (izinkan akses saat diminta). Membuat tab
   **Absensi**, **Jurnal**, **Pegawai** dan kunci keamanan internal.
4. **Deploy → New deployment → Web app** (Execute as: **Me**, Who has access:
   **Anyone**) → **Deploy** → salin URL `/exec`.

> Mengubah kode? **Deploy → Manage deployments → Edit → Version: New version → Deploy.**

Admin default sudah `dausdaba@polikpsorong.ac.id` (atas nama Firdaus Dabamona);
bisa diubah/ditambah lewat panel admin.

---

## Bagian 2 — Konfigurasi Frontend

Isi [`js/config.js`](js/config.js):

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXX/exec",
  OFFSET_JAM: 9, LABEL_ZONA: "WIT",
  INTERVAL_JURNAL_MENIT: 120   // pengingat jurnal tiap 2 jam
};
```

---

## Bagian 3 — Publikasikan ke GitHub Pages

Repo → **Settings → Pages** → *Deploy from a branch* → branch + folder **`/ (root)`** → **Save**.
Situs: `https://<username>.github.io/<repo>/`.

---

## Bagian 4 — Pengaturan Awal Admin

1. Buka situs → tab **Daftar** → daftar dengan email admin
   `dausdaba@polikpsorong.ac.id` + password (akun admin **langsung aktif**).
2. Buka **`admin.html`** → login dengan akun admin tersebut.
3. **🧪 Mode Uji Coba** default **AKTIF** (absen dari mana saja). Matikan saat produksi.
4. Isi **lokasi kampus** (tombol *Gunakan Lokasi Saya* saat di kampus) + **radius**.
5. Atur **Jam Kerja** (07:30 / 16:00) & **toleransi** (60 / 240 menit). **Simpan**.

---

## Alur Penggunaan

1. **Pegawai**: buka situs → tab **Daftar** (nama, email, password) → status *pending*.
2. **Admin**: `admin.html` → tab **Pending** → **Setujui** (atau **Reset Pw**/**Blokir**/**Hapus**).
3. **Pegawai** (disetujui): **Login** → tab **Absen** (Ambil Lokasi → Kirim) atau
   tab **Jurnal** (deskripsi + foto). Jenis & status absen otomatis.
4. **Rekap**: `rekap.html` → login → lihat data sendiri (admin: semua) → ekspor CSV.

### Status absen (dengan buffer)
- Masuk: *Tepat Waktu* bila ≤ (jam masuk + toleransi), selebihnya *Terlambat X menit*.
- Pulang: *Tepat Waktu* bila ≥ (jam pulang − toleransi), selebihnya *Pulang Cepat X menit*.

---

## Catatan Pengingat Jurnal

Pengingat (notifikasi + bunyi) muncul tiap `INTERVAL_JURNAL_MENIT` **selama
halaman/tab aplikasi terbuka**. Browser tidak mengizinkan situs statis
memunculkan alarm saat tab tertutup penuh — untuk notifikasi latar belakang
penuh diperlukan PWA + push notification / aplikasi native. Izinkan
**Notifikasi** saat diminta agar tampil sebagai notifikasi sistem.

## Catatan Lain

- **HTTPS wajib** (GitHub Pages otomatis) untuk GPS & kamera.
- Lupa password? Admin bisa **Reset Pw** pegawai dari panel.
- Foto jurnal tersimpan di folder **Foto Jurnal PJLP** pada Google Drive admin.

## Struktur Berkas

```
index.html / admin.html / rekap.html   Halaman
css/style.css                          Tampilan
js/config.js                           Konfigurasi + sesi + API
js/app.js / js/admin.js / js/rekap.js  Logika tiap halaman
google-apps-script/Code.gs             Backend (disalin ke Apps Script)
```
