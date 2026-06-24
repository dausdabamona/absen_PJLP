/* ============================================================
   KONFIGURASI APLIKASI ABSENSI PJLP
   ------------------------------------------------------------
   Isi dua hal:
   1. APPS_SCRIPT_URL  : URL Web App Google Apps Script (/exec).
   2. GOOGLE_CLIENT_ID : Client ID OAuth (xxxx.apps.googleusercontent.com)
      dari Google Cloud Console. Authorized JavaScript origin harus
      berisi origin GitHub Pages Anda (mis. https://dausdabamona.github.io).
   ============================================================ */

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz5SSkbi0MODJJHpUjbLYa-B-uPOnfGzl5RD0C1i4UP7Pz8nUuFvv0hApT-Q2RHbYHh/exec",

  GOOGLE_CLIENT_ID: "GANTI_DENGAN_CLIENT_ID.apps.googleusercontent.com",

  OFFSET_JAM: 9,
  LABEL_ZONA: "WIT",

  // Pengingat jurnal (menit). 120 = setiap 2 jam.
  INTERVAL_JURNAL_MENIT: 120
};

/* ---------- Auth: Google Sign-In (GIS) ---------- */
const Auth = {
  _token: null,
  _profile: null,
  _onLogin: null,

  belumDikonfigurasi: function () {
    return CONFIG.GOOGLE_CLIENT_ID.indexOf("GANTI") === 0;
  },

  init: function (opts) {
    // opts: { buttonEl, onLogin, onReady }
    this._onLogin = opts.onLogin;
    const self = this;
    (function tunggu() {
      if (!window.google || !google.accounts || !google.accounts.id) { setTimeout(tunggu, 200); return; }
      google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: function (resp) { self._handle(resp); },
        auto_select: true
      });
      if (opts.buttonEl) {
        google.accounts.id.renderButton(opts.buttonEl, { theme: "filled_blue", size: "large", text: "signin_with", shape: "pill" });
      }
      google.accounts.id.prompt();
      if (opts.onReady) opts.onReady();
    })();
  },

  _handle: function (resp) {
    this._token = resp.credential;
    this._profile = parseJwt(resp.credential);
    if (this._onLogin) this._onLogin(this._profile);
  },

  token: function () { return this._token; },
  profile: function () { return this._profile; },

  signOut: function () {
    this._token = null; this._profile = null;
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    location.reload();
  }
};

function parseJwt(token) {
  try {
    const base = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base).split("").map(function (c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
    return JSON.parse(json);
  } catch (e) { return {}; }
}

/* ---------- API ---------- */
const API = {
  belumDikonfigurasi: function () {
    return CONFIG.APPS_SCRIPT_URL.indexOf("GANTI") === 0;
  },
  // POST aksi; idToken otomatis disertakan
  post: function (payload) {
    payload.idToken = Auth.token();
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }
};
