# Absensi PJLP

Aplikasi absensi **PJLP (Penyedia Jasa Lainnya Perorangan)** berbasis web yang
dapat dijalankan langsung dari **GitHub Pages** — tanpa server sendiri.

Fitur:

- ✅ Absen **Masuk** & **Pulang** dengan jam otomatis
- 📍 Rekam **lokasi GPS** (+ opsi validasi radius kantor)
- 📷 **Foto/selfie** sebagai bukti kehadiran (disimpan ke Google Drive)
- 📋 Halaman **Rekap** dengan filter nama/tanggal & **ekspor CSV**
- 🗄️ Data tersimpan terpusat di **Google Sheets** (gratis)

```
Pengguna (browser)  ─→  GitHub Pages (HTML/CSS/JS statis)
                          │  fetch
                          ▼
                    Google Apps Script (Web App)
                          │
              ┌───────────┴────────────┐
              ▼                         ▼
       Google Sheets (data)     Google Drive (foto)
```

---

## Bagian 1 — Siapkan Backend (Google Sheets + Apps Script)

1. Buka **<https://sheet.new>** untuk membuat Google Sheet baru (beri nama, mis. *Database Absensi PJLP*).
2. Di Sheet tersebut, klik menu **Ekstensi → Apps Script**.
3. Hapus semua kode contoh, lalu **salin seluruh isi** file
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs) ke editor, lalu **Simpan**.
4. Klik **Deploy → New deployment**.
   - Klik ikon gerigi → pilih **Web app**.
   - **Execute as**: *Me* (akun Anda).
   - **Who has access**: **Anyone**.
   - Klik **Deploy**, lalu **Authorize access** dan izinkan (pilih akun → *Advanced* → *Go to project (unsafe)* → *Allow*).
5. Salin **URL Web app** yang muncul (berakhiran `/exec`).

> Jika nanti Anda mengubah `Code.gs`, lakukan **Deploy → Manage deployments → Edit (pensil) → Version: New version → Deploy** agar perubahan aktif. URL tetap sama.

---

## Bagian 2 — Konfigurasi Aplikasi

Buka file [`js/config.js`](js/config.js) dan tempel URL tadi:

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXX/exec",
  OFFSET_JAM: 9,        // 7=WIB, 8=WITA, 9=WIT
  LABEL_ZONA: "WIT",
  AKTIFKAN_VALIDASI_RADIUS: false,  // true untuk batasi lokasi
  LOKASI_KANTOR: { lat: -0.8762, lng: 131.2558, radiusMeter: 200 }
};
```

Untuk membatasi absen hanya di lokasi kantor: set `AKTIFKAN_VALIDASI_RADIUS: true`
dan isi `lat`/`lng` kantor (ambil dari Google Maps: klik kanan titik → koordinat).

---

## Bagian 3 — Publikasikan ke GitHub Pages

1. Pastikan seluruh file repo ini sudah ter-*push* ke GitHub.
2. Di GitHub, buka repo → **Settings → Pages**.
3. Pada **Build and deployment → Source**, pilih **Deploy from a branch**.
4. Pilih branch (mis. `main`) dan folder **`/ (root)`**, lalu **Save**.
5. Tunggu 1–2 menit. Situs akan tersedia di:
   `https://<username>.github.io/<nama-repo>/`

Buka URL tersebut dari HP/komputer untuk mulai absen. Halaman rekap ada di
`.../rekap.html`.

---

## Penggunaan

**Absen** (`index.html`):
1. Isi nama (dan NIP/ID bila ada).
2. Pilih **Masuk** atau **Pulang**.
3. Tekan **Ambil Lokasi** → izinkan akses GPS.
4. Tekan **Ambil / Pilih Foto** → ambil selfie.
5. Tekan **Kirim Absen**.

**Rekap** (`rekap.html`): lihat data, filter berdasarkan nama/rentang tanggal,
dan **Ekspor CSV** (bisa dibuka di Excel).

---

## Catatan & Tips

- **HTTPS wajib** untuk GPS & kamera. GitHub Pages otomatis HTTPS, jadi aman.
- Foto dikompres otomatis di sisi browser sebelum dikirim agar hemat kuota.
- Foto tersimpan di folder **Foto Absensi PJLP** pada Google Drive Anda.
- Halaman rekap bersifat terbuka bagi siapa pun yang tahu URL-nya. Jika perlu
  dibatasi, simpan repo sebagai **private** atau tambahkan proteksi sederhana
  (mis. kata sandi) — minta bantuan untuk menambahkannya.
- Semua gratis selama dalam batas wajar kuota Google (sangat besar untuk
  kebutuhan instansi).

## Struktur Berkas

```
index.html              Halaman absen
rekap.html              Halaman rekap & ekspor
css/style.css           Tampilan
js/config.js            Konfigurasi (URL Apps Script, zona waktu, radius)
js/app.js               Logika absen
js/rekap.js             Logika rekap & ekspor CSV
google-apps-script/
  └─ Code.gs            Backend (disalin ke Google Apps Script)
```
