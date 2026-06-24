/* ============================================================
   KONFIGURASI APLIKASI ABSENSI PJLP
   ------------------------------------------------------------
   1. Buat Google Apps Script (lihat folder google-apps-script/
      dan baca README.md untuk langkah lengkapnya).
   2. Setelah deploy sebagai "Web app", salin URL-nya
      (berakhiran /exec) dan tempel di APPS_SCRIPT_URL di bawah.
   ============================================================ */

const CONFIG = {
  // Tempel URL Web App Google Apps Script Anda di sini:
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwLoZ2oZHcFjThApk_QcRWiaAaWYDf61IyDaIMcyVuND_oy_-sY6QOfEwoyWk3J--7J/exec",

  // Zona waktu untuk tampilan jam (WIB=7, WITA=8, WIT=9)
  OFFSET_JAM: 9,
  LABEL_ZONA: "WIT",

  // Validasi radius lokasi kantor (opsional).
  // Jika true, absen hanya diterima bila berada dalam radius.
  AKTIFKAN_VALIDASI_RADIUS: false,
  LOKASI_KANTOR: {
    lat: -0.8762,      // ganti dengan latitude kantor
    lng: 131.2558,     // ganti dengan longitude kantor
    radiusMeter: 200   // toleransi jarak (meter)
  }
};
