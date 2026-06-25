/* ============================================================
   KONFIGURASI APLIKASI ABSENSI PJLP
   ------------------------------------------------------------
   Cukup isi APPS_SCRIPT_URL (URL Web App Apps Script, /exec).
   Tanpa login: identitas menempel pada perangkat (HP) ini.
   ============================================================ */

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxMlSeBJ4dhEjP_K5_jrm2qB8clo1EmauZRspVjsBBcQoQYVAwgHmXBYyX5NzUJyIdQ/exec",

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
  belumDikonfigurasi: function () { return CONFIG.APPS_SCRIPT_URL.indexOf("GANTI") === 0; },
  post: function (payload) {
    if (payload.deviceId === undefined) payload.deviceId = getDeviceId();
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }
};
