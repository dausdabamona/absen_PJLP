/* ============================================================
   KONFIGURASI APLIKASI ABSENSI PJLP
   ------------------------------------------------------------
   Cukup isi APPS_SCRIPT_URL (URL Web App Apps Script, /exec).
   Login memakai Email + Password (tanpa Google/OAuth).
   ============================================================ */

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz5SSkbi0MODJJHpUjbLYa-B-uPOnfGzl5RD0C1i4UP7Pz8nUuFvv0hApT-Q2RHbYHh/exec",

  OFFSET_JAM: 9,
  LABEL_ZONA: "WIT",

  // Pengingat jurnal (menit). 120 = setiap 2 jam.
  INTERVAL_JURNAL_MENIT: 120
};

/* ---------- Sesi (token disimpan di browser) ---------- */
const Sesi = {
  token: function () { return localStorage.getItem("pjlp_token") || ""; },
  set: function (t) { localStorage.setItem("pjlp_token", t); },
  clear: function () { localStorage.removeItem("pjlp_token"); }
};

/* ---------- API ---------- */
const API = {
  belumDikonfigurasi: function () { return CONFIG.APPS_SCRIPT_URL.indexOf("GANTI") === 0; },
  post: function (payload) {
    if (payload.token === undefined) payload.token = Sesi.token();
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }
};
