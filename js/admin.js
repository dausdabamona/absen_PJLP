/* ============================================================
   Logika panel admin (admin.html)
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };

  let password = sessionStorage.getItem("pjlp_admin_pw") || "";
  let semuaPerangkat = [];
  let filterAktif = "semua";

  const seksiLogin = $("seksi-login");
  const seksiDash = $("seksi-dashboard");

  /* ---------- Login ---------- */
  $("form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (API.belumDikonfigurasi()) {
      $("login-pesan").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL).";
      return;
    }
    const pw = $("password").value;
    const btn = $("btn-login");
    btn.disabled = true; btn.textContent = "Memeriksa...";
    $("login-pesan").textContent = "";

    API.post({ action: "adminLogin", password: pw })
      .then(function (res) {
        if (res.status === "success") {
          password = pw;
          sessionStorage.setItem("pjlp_admin_pw", pw);
          masukDashboard();
        } else {
          $("login-pesan").textContent = res.message || "Login gagal.";
        }
      })
      .catch(function (err) { $("login-pesan").textContent = "Gagal: " + err.message; })
      .finally(function () { btn.disabled = false; btn.textContent = "Masuk"; });
  });

  function masukDashboard() {
    seksiLogin.classList.add("hidden");
    seksiDash.classList.remove("hidden");
    muatData();
  }

  /* ---------- Muat data ---------- */
  function muatData() {
    $("perangkat-info").textContent = "Memuat...";
    API.post({ action: "adminData", password: password })
      .then(function (res) {
        if (res.status !== "success") {
          if (/password/i.test(res.message || "")) { keluar(); }
          $("perangkat-info").textContent = res.message || "Gagal memuat.";
          return;
        }
        // isi pengaturan
        const s = res.pengaturan || {};
        $("s-instansi").value = s.namaInstansi || "";
        $("s-lat").value = s.lat || "";
        $("s-lng").value = s.lng || "";
        $("s-radius").value = s.radius || "";
        // isi perangkat
        semuaPerangkat = res.perangkat || [];
        renderPerangkat();
      })
      .catch(function (err) { $("perangkat-info").textContent = "Gagal: " + err.message; });
  }

  function keluar() {
    sessionStorage.removeItem("pjlp_admin_pw");
    password = "";
    seksiDash.classList.add("hidden");
    seksiLogin.classList.remove("hidden");
    $("login-pesan").textContent = "Sesi berakhir, silakan masuk lagi.";
  }

  /* ---------- Render tabel perangkat ---------- */
  function badge(status) {
    const map = { disetujui: "masuk", pending: "pulang", diblokir: "blok" };
    return '<span class="badge ' + (map[status] || "") + '">' + status + "</span>";
  }

  function renderPerangkat() {
    const data = filterAktif === "semua"
      ? semuaPerangkat
      : semuaPerangkat.filter(function (d) { return d.status === filterAktif; });

    const tbody = $("perangkat-body");
    if (!data.length) {
      tbody.innerHTML = "";
      $("perangkat-info").textContent = "Tidak ada perangkat untuk filter ini.";
      return;
    }
    $("perangkat-info").textContent = "Total " + data.length + " perangkat.";

    tbody.innerHTML = data.map(function (d) {
      let aksi = "";
      if (d.status !== "disetujui") aksi += '<button class="mini primary aksi" data-id="' + d.deviceId + '" data-act="disetujui">Setujui</button> ';
      if (d.status !== "diblokir") aksi += '<button class="mini aksi" data-id="' + d.deviceId + '" data-act="diblokir">Blokir</button> ';
      aksi += '<button class="mini danger aksi" data-id="' + d.deviceId + '" data-act="hapus">Hapus</button>';
      return "<tr>" +
        "<td>" + escapeHtml(d.nama) + "</td>" +
        "<td>" + escapeHtml(d.nip || "-") + "</td>" +
        "<td>" + badge(d.status) + "</td>" +
        "<td>" + escapeHtml(d.didaftarkan || "") + "</td>" +
        '<td class="mono small">' + escapeHtml(d.deviceId) + "</td>" +
        '<td class="aksi-sel">' + aksi + "</td>" +
        "</tr>";
    }).join("");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- Aksi perangkat (delegasi) ---------- */
  $("perangkat-body").addEventListener("click", function (ev) {
    const btn = ev.target.closest(".aksi");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");

    if (act === "hapus") {
      if (!confirm("Hapus perangkat ini? Tindakan tidak bisa dibatalkan.")) return;
      kirimAksi({ action: "hapusPerangkat", password: password, deviceId: id });
    } else {
      kirimAksi({ action: "setStatusPerangkat", password: password, deviceId: id, status: act });
    }
  });

  function kirimAksi(payload) {
    $("perangkat-info").textContent = "Memproses...";
    API.post(payload)
      .then(function (res) {
        if (res.status === "success") { muatData(); }
        else { alert(res.message || "Gagal."); muatData(); }
      })
      .catch(function (err) { alert("Gagal: " + err.message); });
  }

  /* ---------- Tab filter ---------- */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif");
      filterAktif = t.getAttribute("data-filter");
      renderPerangkat();
    });
  });

  $("btn-refresh").addEventListener("click", muatData);

  /* ---------- Gunakan lokasi saya ---------- */
  $("btn-lokasi-saya").addEventListener("click", function () {
    const info = $("lokasi-saya-info");
    if (!navigator.geolocation) { info.textContent = "Browser tidak mendukung GPS."; return; }
    info.textContent = "Mengambil lokasi...";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        $("s-lat").value = pos.coords.latitude.toFixed(7);
        $("s-lng").value = pos.coords.longitude.toFixed(7);
        info.textContent = "✔ Koordinat terisi (akurasi ±" + Math.round(pos.coords.accuracy) + " m).";
        info.className = "status ok";
      },
      function (err) { info.textContent = "Gagal: " + err.message; info.className = "status err"; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  /* ---------- Simpan pengaturan ---------- */
  $("form-pengaturan").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const payload = {
      action: "simpanPengaturan",
      password: password,
      namaInstansi: $("s-instansi").value.trim(),
      lat: $("s-lat").value.trim(),
      lng: $("s-lng").value.trim(),
      radius: $("s-radius").value.trim()
    };
    const pwBaru = $("s-password").value;
    if (pwBaru) payload.passwordBaru = pwBaru;

    const pesan = $("pengaturan-pesan");
    const btn = $("btn-simpan");
    btn.disabled = true; btn.textContent = "Menyimpan...";

    API.post(payload)
      .then(function (res) {
        pesan.className = "pesan " + (res.status === "success" ? "ok" : "err");
        pesan.textContent = res.message || (res.status === "success" ? "Tersimpan." : "Gagal.");
        pesan.classList.remove("hidden");
        if (res.status === "success" && pwBaru) {
          password = pwBaru;
          sessionStorage.setItem("pjlp_admin_pw", pwBaru);
          $("s-password").value = "";
        }
      })
      .catch(function (err) {
        pesan.className = "pesan err";
        pesan.textContent = "Gagal: " + err.message;
        pesan.classList.remove("hidden");
      })
      .finally(function () { btn.disabled = false; btn.textContent = "Simpan Pengaturan"; });
  });

  /* ---------- Auto-login bila ada sesi ---------- */
  if (password && !API.belumDikonfigurasi()) {
    masukDashboard();
  }
})();
