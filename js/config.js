/* ============================================================
   KONFIGURASI APLIKASI ABSENSI PJLP
   ------------------------------------------------------------
   URL backend TIDAK disimpan di sini (rahasia). Nilai di bawah
   ("__APPS_SCRIPT_URL__") adalah placeholder yang otomatis
   diganti oleh GitHub Actions saat deploy, diambil dari
   GitHub Secret bernama APPS_SCRIPT_URL.
   Tanpa login: identitas menempel pada perangkat (HP) ini.
   ============================================================ */

const CONFIG = {
  APPS_SCRIPT_URL: "__APPS_SCRIPT_URL__",

  OFFSET_JAM: 9,
  LABEL_ZONA: "WIT",

  // Pengingat jurnal (menit). 120 = setiap 2 jam.
  INTERVAL_JURNAL_MENIT: 120
};

/* ---------- ID Perangkat (dibuat sekali, disimpan lokal) ---------- */
function getDeviceId() {
  let id = localStorage.getItem("pjlp_device_id");
  if (!id) {
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "dev-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem("pjlp_device_id", id);
  }
  return id;
}

/* ---------- API ---------- */
const API = {
  belumDikonfigurasi: function () {
    var u = CONFIG.APPS_SCRIPT_URL;
    return !u || u.indexOf("GANTI") === 0 || u.indexOf("__APPS_SCRIPT_URL__") !== -1;
  },
  post: function (payload) {
    if (payload.deviceId === undefined) payload.deviceId = getDeviceId();
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }
};
