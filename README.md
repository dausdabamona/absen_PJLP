# Absensi PJLP

Aplikasi absensi **PJLP** berbasis web untuk **GitHub Pages** dengan backend
**Google Apps Script + Google Sheets**. Login memakai **akun Google**.

Fitur:

- 🔐 **Login Google** (Google Sign-In). Identitas = email akun Google.
- 👤 **Daftar mandiri → disetujui admin** sebelum bisa absen.
- ✅ **Jenis (Masuk/Pulang) & status keterlambatan OTOMATIS** sesuai jam kerja.
- ⏱️ **Buffer/toleransi** masuk & pulang (diatur admin).
- 📍 **Geofence** radius kampus (divalidasi server). Bisa dimatikan via **Mode Uji Coba**.
- 📓 **Jurnal Kegiatan** wajib **foto** (disimpan ke Google Drive).
- 🔔 **Pengingat jurnal tiap 2 jam** (notifikasi + bunyi saat aplikasi terbuka).
- 📋 **Rekap per-pengguna**: tiap orang hanya melihat datanya; **admin melihat semua**. Ekspor CSV.
- 🛡️ **Panel admin** (akun admin): setujui/blokir/hapus pegawai, atur lokasi, jam kerja, buffer, mode uji coba, daftar email admin.

```
Browser (login Google) ─→ GitHub Pages (statis)
       │  kirim ID token + data
       ▼
 Google Apps Script  ← verifikasi token, validasi lokasi/izin, filter rekap
       │
   ┌───┴────┐
   ▼        ▼
 Sheets   Drive (foto)
```

---

## Bagian 1 — Buat OAuth Client ID (Google Sign-In)

1. Buka <https://console.cloud.google.com/apis/credentials> (akun admin).
2. (Jika diminta) atur **OAuth consent screen**: User type **External**, isi nama
   aplikasi & email, **Save**. Tambahkan diri Anda sebagai *test user* bila perlu.
3. **Create Credentials → OAuth client ID** → Application type **Web application**.
4. **Authorized JavaScript origins** → tambahkan origin GitHub Pages Anda:
   `https://dausdabamona.github.io`
5. **Create** → salin **Client ID** (`xxxx.apps.googleusercontent.com`).

---

## Bagian 2 — Pasang Backend (Apps Script)

1. Buka Google Sheet → **Ekstensi → Apps Script**.
2. Tempel **seluruh** isi [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. Di baris atas, isi:
   ```js
   const GOOGLE_CLIENT_ID = "xxxx.apps.googleusercontent.com"; // dari Bagian 1
   ```
   Email admin default sudah `dausdaba@polikpsorong.ac.id` (bisa diubah via panel admin).
4. **Simpan** → jalankan fungsi **`setup`** sekali (izinkan akses). Membuat tab
   **Absensi**, **Jurnal**, **Pegawai**.
5. **Deploy → New deployment → Web app** (Execute as: **Me**, Who has access: **Anyone**) → **Deploy** → salin URL `/exec`.

> Mengubah kode? **Deploy → Manage deployments → Edit → Version: New version → Deploy.**

---

## Bagian 3 — Konfigurasi Frontend

Isi [`js/config.js`](js/config.js):

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXX/exec",
  GOOGLE_CLIENT_ID: "xxxx.apps.googleusercontent.com",
  OFFSET_JAM: 9, LABEL_ZONA: "WIT",
  INTERVAL_JURNAL_MENIT: 120   // pengingat jurnal tiap 2 jam
};
```

> `GOOGLE_CLIENT_ID` di `config.js` **harus sama** dengan yang di `Code.gs`.

---

## Bagian 4 — Publikasikan ke GitHub Pages

Repo → **Settings → Pages** → *Deploy from a branch* → branch + folder **`/ (root)`** → **Save**.
Situs: `https://<username>.github.io/<repo>/`. Pastikan origin ini sama dengan
Authorized JavaScript origins di Bagian 1.

---

## Bagian 5 — Pengaturan Awal Admin

1. Buka **`admin.html`** → **Masuk dengan Google** memakai akun admin.
2. **🧪 Mode Uji Coba** default **AKTIF** (absen dari mana saja). Matikan saat produksi.
3. Isi **lokasi kampus** (tombol *Gunakan Lokasi Saya* saat di kampus) + **radius**.
4. Atur **Jam Kerja** (07:30 / 16:00) & **toleransi** (60 / 240 menit).
5. **Simpan Pengaturan**.

---

## Alur Penggunaan

1. **Pegawai**: buka situs → **Masuk dengan Google** → lengkapi **Daftar** (nama
   otomatis, NIP opsional) → status *pending*.
2. **Admin**: `admin.html` → tab **Pending** → **Setujui**.
3. **Pegawai** (disetujui): tab **Absen** (Ambil Lokasi → Kirim) atau tab **Jurnal**
   (deskripsi + foto). Jenis & status absen otomatis.
4. **Rekap**: `rekap.html` → login → lihat data sendiri (admin: semua) → ekspor CSV.

### Status absen (dengan buffer)
- Masuk: *Tepat Waktu* bila ≤ (jam masuk + toleransi), selebihnya *Terlambat X menit*.
- Pulang: *Tepat Waktu* bila ≥ (jam pulang − toleransi), selebihnya *Pulang Cepat X menit*.

---

## Catatan Pengingat Jurnal

Pengingat (notifikasi + bunyi) muncul tiap `INTERVAL_JURNAL_MENIT` **selama
halaman/tab aplikasi terbuka** (atau di-*install* sebagai PWA). Browser tidak
mengizinkan situs statis memunculkan alarm saat tab tertutup sepenuhnya — untuk
notifikasi latar belakang penuh diperlukan aplikasi native / push notification.
Izinkan **Notifikasi** saat diminta agar pengingat tampil sebagai notifikasi sistem.

## Catatan Lain

- **HTTPS wajib** (GitHub Pages otomatis) untuk login Google, GPS, & kamera.
- Foto jurnal tersimpan di folder **Foto Jurnal PJLP** pada Google Drive admin.
- Verifikasi token Google dilakukan di server tiap permintaan — aman.

## Struktur Berkas

```
index.html / admin.html / rekap.html   Halaman
css/style.css                          Tampilan
js/config.js                           Konfigurasi + Auth (Google) + API
js/app.js / js/admin.js / js/rekap.js  Logika tiap halaman
google-apps-script/Code.gs             Backend (disalin ke Apps Script)
```
