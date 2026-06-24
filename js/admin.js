/* ============================================================
   Panel admin (admin.html) — login email+password
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  let semuaPegawai = [];
  let filterAktif = "semua";

  /* ---------- Login ---------- */
  $("form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (API.belumDikonfigurasi()) { $("login-pesan").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL)."; return; }
    const btn = $("btn-login"); btn.disabled = true; btn.textContent = "Masuk...";
    $("login-pesan").textContent = "";
    API.post({ action: "login", token: "", email: $("l-email").value.trim(), password: $("l-password").value })
      .then(function (res) {
        if (res.status !== "success") { $("login-pesan").textContent = res.message || "Gagal login."; return; }
        if (!res.isAdmin) { $("login-pesan").textContent = "Akun ini bukan admin."; return; }
        Sesi.set(res.token);
        muatData();
      })
      .catch(function (err) { $("login-pesan").textContent = "Gagal: " + err.message; })
      .finally(function () { btn.disabled = false; btn.textContent = "Masuk"; });
  });

  function muatData() {
    API.post({ action: "adminData" })
      .then(function (res) {
        if (res.status !== "success") {
          $("login-pesan").textContent = res.message || "Gagal.";
          $("seksi-dashboard").classList.add("hidden"); $("seksi-login").classList.remove("hidden");
          return;
        }
        $("seksi-login").classList.add("hidden"); $("seksi-dashboard").classList.remove("hidden");
        const s = res.pengaturan || {};
        $("s-instansi").value = s.namaInstansi || "";
        $("s-lat").value = s.lat || ""; $("s-lng").value = s.lng || ""; $("s-radius").value = s.radius || "";
        $("s-abaikan").checked = !!s.abaikanLokasi;
        $("s-jam-masuk").value = s.jamMasuk || ""; $("s-jam-pulang").value = s.jamPulang || "";
        $("s-buffer-masuk").value = (s.bufferMasuk !== undefined && s.bufferMasuk !== "") ? s.bufferMasuk : "";
        $("s-buffer-pulang").value = (s.bufferPulang !== undefined && s.bufferPulang !== "") ? s.bufferPulang : "";
        $("s-admin-email").value = s.adminEmail || "";
        semuaPegawai = res.pegawai || [];
        render();
      })
      .catch(function (err) { $("login-pesan").textContent = "Gagal: " + err.message; });
  }

  /* ---------- Tabel pegawai ---------- */
  function badge(status) { const m = { disetujui: "masuk", pending: "pulang", diblokir: "blok" }; return '<span class="badge ' + (m[status] || "") + '">' + status + "</span>"; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function render() {
    const data = filterAktif === "semua" ? semuaPegawai : semuaPegawai.filter(function (d) { return d.status === filterAktif; });
    const tbody = $("pegawai-body");
    if (!data.length) { tbody.innerHTML = ""; $("pegawai-info").textContent = "Tidak ada pegawai untuk filter ini."; return; }
    $("pegawai-info").textContent = "Total " + data.length + " pegawai.";
    tbody.innerHTML = data.map(function (d) {
      let aksi = "";
      if (d.status !== "disetujui") aksi += '<button class="mini primary aksi" data-email="' + esc(d.email) + '" data-act="disetujui">Setujui</button> ';
      if (d.status !== "diblokir") aksi += '<button class="mini aksi" data-email="' + esc(d.email) + '" data-act="diblokir">Blokir</button> ';
      aksi += '<button class="mini aksi" data-email="' + esc(d.email) + '" data-act="reset">Reset Pw</button> ';
      aksi += '<button class="mini danger aksi" data-email="' + esc(d.email) + '" data-act="hapus">Hapus</button>';
      return "<tr><td>" + esc(d.nama) + "</td><td class=\"small\">" + esc(d.email) + "</td><td>" + esc(d.nip || "-") +
        "</td><td>" + badge(d.status) + "</td><td>" + esc(d.didaftarkan || "") + "</td><td class=\"aksi-sel\">" + aksi + "</td></tr>";
    }).join("");
  }

  $("pegawai-body").addEventListener("click", function (ev) {
    const btn = ev.target.closest(".aksi"); if (!btn) return;
    const email = btn.getAttribute("data-email"), act = btn.getAttribute("data-act");
    if (act === "hapus") {
      if (!confirm("Hapus pegawai " + email + "? Tidak bisa dibatalkan.")) return;
      kirim({ action: "hapusPegawai", email: email });
    } else if (act === "reset") {
      const pw = prompt("Password baru untuk " + email + " (min. 6 karakter):");
      if (!pw) return;
      kirim({ action: "resetPassword", email: email, passwordBaru: pw });
    } else {
      kirim({ action: "setStatusPegawai", email: email, statusBaru: act });
    }
  });
  function kirim(payload) {
    $("pegawai-info").textContent = "Memproses...";
    API.post(payload).then(function (res) {
      if (res.status === "success") { if (res.message) { /* tampilkan ringkas */ } muatData(); }
      else { alert(res.message || "Gagal."); muatData(); }
    }).catch(function (err) { alert("Gagal: " + err.message); });
  }

  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif"); filterAktif = t.getAttribute("data-filter"); render();
    });
  });
  $("btn-refresh").addEventListener("click", muatData);

  /* ---------- Lokasi saya ---------- */
  $("btn-lokasi-saya").addEventListener("click", function () {
    const info = $("lokasi-saya-info");
    if (!navigator.geolocation) { info.textContent = "Browser tidak mendukung GPS."; return; }
    info.textContent = "Mengambil lokasi...";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        $("s-lat").value = pos.coords.latitude.toFixed(7); $("s-lng").value = pos.coords.longitude.toFixed(7);
        info.textContent = "✔ Koordinat terisi (±" + Math.round(pos.coords.accuracy) + " m)."; info.className = "status ok";
      },
      function (err) { info.textContent = "Gagal: " + err.message; info.className = "status err"; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  /* ---------- Simpan pengaturan ---------- */
  $("form-pengaturan").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const pesan = $("pengaturan-pesan"), btn = $("btn-simpan");
    btn.disabled = true; btn.textContent = "Menyimpan...";
    API.post({
      action: "simpanPengaturan",
      namaInstansi: $("s-instansi").value.trim(),
      lat: $("s-lat").value.trim(), lng: $("s-lng").value.trim(), radius: $("s-radius").value.trim(),
      abaikanLokasi: $("s-abaikan").checked,
      jamMasuk: $("s-jam-masuk").value.trim(), jamPulang: $("s-jam-pulang").value.trim(),
      bufferMasuk: $("s-buffer-masuk").value.trim(), bufferPulang: $("s-buffer-pulang").value.trim(),
      adminEmail: $("s-admin-email").value.trim()
    }).then(function (res) {
      pesan.className = "pesan " + (res.status === "success" ? "ok" : "err");
      pesan.textContent = res.message || (res.status === "success" ? "Tersimpan." : "Gagal.");
      pesan.classList.remove("hidden");
    }).catch(function (err) {
      pesan.className = "pesan err"; pesan.textContent = "Gagal: " + err.message; pesan.classList.remove("hidden");
    }).finally(function () { btn.disabled = false; btn.textContent = "Simpan Pengaturan"; });
  });

  /* ---------- Auto-login bila ada token ---------- */
  if (Sesi.token() && !API.belumDikonfigurasi()) { muatData(); }
})();
