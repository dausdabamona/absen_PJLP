# Absensi PJLP

Aplikasi absensi **PJLP (Penyedia Jasa Lainnya Perorangan)** berbasis web yang
dapat dijalankan dari **GitHub Pages** — tanpa server sendiri.

Fitur:

- ✅ Absen **Masuk** & **Pulang** dengan jam otomatis
- 📍 **Geofence**: absen hanya diterima bila berada di **radius lokasi kampus**
  (divalidasi di **server**, bukan browser, sehingga tidak mudah dimanipulasi)
- 📱 **Kontrol perangkat**: tiap HP harus didaftarkan & **disetujui admin** dulu
- 📷 **Foto/selfie** sebagai bukti kehadiran (disimpan ke Google Drive)
- 🛡️ **Panel admin**: setujui/blokir/hapus perangkat, atur titik & radius kampus,
  ganti password — semua dari halaman web
- 📋 Halaman **Rekap** dengan filter & **ekspor CSV**

```
Pengguna (browser)  ─→  GitHub Pages (HTML/CSS/JS statis)
                          │  fetch (JSON)
                          ▼
                    Google Apps Script (Web App)  ← validasi lokasi & izin di sini
                          │
              ┌───────────┴────────────┐
              ▼                         ▼
       Google Sheets (data)     Google Drive (foto)
```

> **Penting soal keamanan.** Validasi lokasi & izin perangkat dilakukan di sisi
> server (Apps Script). Ini menaikkan keamanan secara signifikan, tetapi bukan
> anti-bobol total — GPS palsu tingkat lanjut & penyalinan ID perangkat masih
> mungkin oleh orang yang sangat niat. Untuk kebutuhan instansi umumnya sudah
> memadai; keamanan penuh memerlukan aplikasi native + login SSO.

---

## Bagian 1 — Pasang Backend (Google Sheets + Apps Script)

1. Buka **<https://sheet.new>** untuk membuat Google Sheet baru.
2. Menu **Ekstensi → Apps Script**.
3. Hapus kode contoh, **salin seluruh isi** [`google-apps-script/Code.gs`](google-apps-script/Code.gs), lalu **Simpan**.
4. Di bagian atas editor, pilih fungsi **`setup`** lalu klik **Run** (sekali).
   - Izinkan akses saat diminta (pilih akun → *Advanced* → *Go to project (unsafe)* → *Allow*).
   - Ini membuat tab **Absensi** & **Perangkat** dan **password admin awal**.
   - Buka menu **View → Logs** untuk melihat password admin awal
     (defaultnya `admin123` — **wajib diganti** lewat panel admin nanti).
5. Klik **Deploy → New deployment → Web app**:
   - **Execute as**: *Me*
   - **Who has access**: **Anyone**
6. **Deploy**, lalu salin **URL Web app** (berakhiran `/exec`).

> Jika nanti `Code.gs` diubah: **Deploy → Manage deployments → Edit (pensil) → Version: New version → Deploy** (URL tetap sama).

---

## Bagian 2 — Konfigurasi Aplikasi

Buka [`js/config.js`](js/config.js) dan isi URL tadi:

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXX/exec",
  OFFSET_JAM: 9,        // 7=WIB, 8=WITA, 9=WIT
  LABEL_ZONA: "WIT"
};
```

Hanya itu yang perlu diisi. Lokasi kampus, radius, & password diatur dari **panel admin**.

---

## Bagian 3 — Publikasikan ke GitHub Pages

1. Pastikan semua file ter-*push* ke GitHub.
2. Repo → **Settings → Pages**.
3. **Source**: *Deploy from a branch* → pilih branch & folder **`/ (root)`** → **Save**.
4. Tunggu 1–2 menit. Situs tersedia di
   `https://<username>.github.io/<nama-repo>/`

---

## Bagian 4 — Pengaturan Awal oleh Admin

1. Buka **`.../admin.html`** dan login dengan password awal (`admin123`).
2. Di bagian **Lokasi & Pengaturan**:
   - Isi **Nama Instansi**.
   - **Berada di lokasi kampus**, klik **📡 Gunakan Lokasi Saya Sekarang**
     untuk mengisi Latitude/Longitude otomatis (atau isi manual dari Google Maps:
     klik kanan titik → koordinat).
   - Isi **Radius** (mis. `200` meter).
   - **Ganti Password Admin** (sangat disarankan).
   - **Simpan Pengaturan**.

Sekarang sistem siap menerima absen.

---

## Alur Penggunaan

**Pegawai (pertama kali):**
1. Buka halaman absen → otomatis muncul form **Daftarkan Perangkat**.
2. Isi nama (+ NIP/ID), tekan **Daftarkan Perangkat** → status *menunggu persetujuan*.

**Admin:** buka `admin.html` → tab **Pending** → **Setujui** perangkat tersebut.

**Pegawai (setelah disetujui):**
1. Buka halaman absen → langsung muncul form absen.
2. Pilih **Masuk/Pulang** → **Ambil Lokasi** → **Ambil Foto** → **Kirim Absen**.
3. Jika di luar radius kampus, absen **ditolak server**.

**Admin lain hari:** dari `admin.html` bisa **Blokir** atau **Hapus** perangkat
kapan saja untuk mencabut izin absen seseorang.

**Rekap:** buka `rekap.html` untuk melihat/menyaring data & **ekspor CSV**.

---

## Catatan

- **HTTPS wajib** untuk GPS & kamera. GitHub Pages otomatis HTTPS.
- 1 HP = 1 perangkat. ID perangkat disimpan di browser; jika cache/aplikasi
  browser dibersihkan, perangkat perlu didaftarkan & disetujui ulang.
- Foto tersimpan di folder **Foto Absensi PJLP** pada Google Drive Anda.
- Halaman `admin.html` & `rekap.html` terbuka bagi yang tahu URL-nya, tetapi
  aksi admin tetap butuh password (divalidasi server). Untuk lebih privat,
  jadikan repo **private**.

## Struktur Berkas

```
index.html              Halaman absen (+ pendaftaran perangkat)
admin.html              Panel admin
rekap.html              Halaman rekap & ekspor
css/style.css           Tampilan
js/config.js            Konfigurasi + util API + ID perangkat
js/app.js               Logika absen
js/admin.js             Logika panel admin
js/rekap.js             Logika rekap & ekspor CSV
google-apps-script/
  └─ Code.gs            Backend (disalin ke Google Apps Script)
```
