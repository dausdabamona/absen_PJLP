/* ============================================================
   KONFIGURASI APLIKASI ABSENSI PJLP
   ------------------------------------------------------------
   Hanya satu hal yang perlu Anda isi: URL Web App Apps Script.
   Pengaturan lokasi kampus, radius, & password admin sekarang
   diatur dari PANEL ADMIN (admin.html), bukan di sini.
   ============================================================ */

const CONFIG = {
  // URL Web App Google Apps Script Anda (berakhiran /exec):
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx5mGglLeJyLiGbmnsg1rlbFLJ0UfMVj8VXjwQWeZSSBDJWLZW9aedF_TNcuSGbYhvo/exec",

  // Zona waktu untuk tampilan jam (WIB=7, WITA=8, WIT=9)
  OFFSET_JAM: 9,
  LABEL_ZONA: "WIT"
};

/* ---------- Util bersama (dipakai semua halaman) ---------- */
const API = {
  // Kirim aksi via POST (text/plain agar bebas CORS preflight)
  post: function (payload) {
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  },
  get: function (action) {
    const url = CONFIG.APPS_SCRIPT_URL + (action ? "?action=" + encodeURIComponent(action) : "");
    return fetch(url).then(function (r) { return r.json(); });
  },
  belumDikonfigurasi: function () {
    return CONFIG.APPS_SCRIPT_URL.indexOf("GANTI_DENGAN") === 0;
  }
};

/* ---------- ID Perangkat (dibuat sekali, disimpan lokal) ---------- */
function getDeviceId() {
  let id = localStorage.getItem("pjlp_device_id");
  if (!id) {
    if (window.crypto && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = "dev-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
    localStorage.setItem("pjlp_device_id", id);
  }
  return id;
}
