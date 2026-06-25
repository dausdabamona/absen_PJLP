/* ============================================================
   Panel admin (admin.html) — login password
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  let password = sessionStorage.getItem("pjlp_admin_pw") || "";
  let email = sessionStorage.getItem("pjlp_admin_email") || "";
  let semuaPerangkat = [];
  let filterAktif = "semua";

  /* ---------- Login ---------- */
  $("form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (API.belumDikonfigurasi()) { $("login-pesan").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL)."; return; }
    const pw = $("password").value;
    const em = $("l-email").value.trim();
    const btn = $("btn-login"); btn.disabled = true; btn.textContent = "Memeriksa...";
    $("login-pesan").textContent = "";
    API.post({ action: "adminLogin", email: em, password: pw, deviceId: "" })
      .then(function (res) {
        if (res.status === "success") {
          password = pw; email = em;
          sessionStorage.setItem("pjlp_admin_pw", pw); sessionStorage.setItem("pjlp_admin_email", em);
          masukDashboard();
        } else $("login-pesan").textContent = res.message || "Login gagal.";
      })
      .catch(function (err) { $("login-pesan").textContent = "Gagal: " + err.message; })
      .finally(function () { btn.disabled = false; btn.textContent = "Masuk"; });
  });

  function masukDashboard() {
    // Tandai HP ini sebagai perangkat admin: berikutnya situs langsung buka panel admin.
    localStorage.setItem("pjlp_admin_device", "1");
    $("seksi-login").classList.add("hidden"); $("seksi-dashboard").classList.remove("hidden"); muatData();
  }
  function keluar() {
    sessionStorage.removeItem("pjlp_admin_pw"); sessionStorage.removeItem("pjlp_admin_email"); password = ""; email = "";
    $("seksi-dashboard").classList.add("hidden"); $("seksi-login").classList.remove("hidden");
    $("login-pesan").textContent = "Sesi berakhir, masuk lagi.";
  }

  function muatData() {
    $("perangkat-info").textContent = "Memuat...";
    API.post({ action: "adminData", email: email, password: password, deviceId: "" })
      .then(function (res) {
        if (res.status !== "success") { if (/password/i.test(res.message || "")) keluar(); $("perangkat-info").textContent = res.message || "Gagal."; return; }
        const s = res.pengaturan || {};
        $("s-instansi").value = s.namaInstansi || "";
        $("s-lat").value = s.lat || ""; $("s-lng").value = s.lng || ""; $("s-radius").value = s.radius || "";
        $("s-abaikan").checked = !!s.abaikanLokasi;
        $("s-jumat").checked = !!s.bebasJumat;
        $("s-jam-masuk").value = s.jamMasuk || ""; $("s-jam-pulang").value = s.jamPulang || "";
        $("s-buffer-masuk").value = (s.bufferMasuk !== undefined && s.bufferMasuk !== "") ? s.bufferMasuk : "";
        $("s-buffer-pulang").value = (s.bufferPulang !== undefined && s.bufferPulang !== "") ? s.bufferPulang : "";
        $("s-email").value = s.adminEmail || "";
        semuaPerangkat = res.perangkat || [];
        render();
      })
      .catch(function (err) { $("perangkat-info").textContent = "Gagal: " + err.message; });
  }

  /* ---------- Tabel ---------- */
  function badge(status) { const m = { disetujui: "masuk", pending: "pulang", diblokir: "blok" }; return '<span class="badge ' + (m[status] || "") + '">' + status + "</span>"; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function render() {
    const data = filterAktif === "semua" ? semuaPerangkat : semuaPerangkat.filter(function (d) { return d.status === filterAktif; });
    const tbody = $("perangkat-body");
    if (!data.length) { tbody.innerHTML = ""; $("perangkat-info").textContent = "Tidak ada perangkat untuk filter ini."; return; }
    $("perangkat-info").textContent = "Total " + data.length + " perangkat.";
    tbody.innerHTML = data.map(function (d) {
      let aksi = "";
      if (d.status !== "disetujui") aksi += '<button class="mini primary aksi" data-id="' + esc(d.deviceId) + '" data-act="disetujui">Setujui</button> ';
      if (d.status !== "diblokir") aksi += '<button class="mini aksi" data-id="' + esc(d.deviceId) + '" data-act="diblokir">Blokir</button> ';
      aksi += '<button class="mini danger aksi" data-id="' + esc(d.deviceId) + '" data-act="hapus">Hapus</button>';
      return "<tr><td>" + esc(d.nama) + "</td><td>" + esc(d.nip || "-") + "</td><td>" + badge(d.status) +
        "</td><td>" + esc(d.didaftarkan || "") + "</td><td class=\"mono small\">" + esc(d.deviceId) + "</td><td class=\"aksi-sel\">" + aksi + "</td></tr>";
    }).join("");
  }

  $("perangkat-body").addEventListener("click", function (ev) {
    const btn = ev.target.closest(".aksi"); if (!btn) return;
    const id = btn.getAttribute("data-id"), act = btn.getAttribute("data-act");
    if (act === "hapus") { if (!confirm("Hapus perangkat ini? Tidak bisa dibatalkan.")) return; kirim({ action: "hapusPerangkat", deviceId: id }); }
    else kirim({ action: "setStatusPerangkat", deviceId: id, statusBaru: act });
  });
  function kirim(payload) {
    payload.email = email; payload.password = password;
    $("perangkat-info").textContent = "Memproses...";
    API.post(payload).then(function (res) {
      if (res.status === "success") muatData(); else { alert(res.message || "Gagal."); muatData(); }
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
    const pwBaru = $("s-password").value;
    const emailBaru = $("s-email").value.trim();
    btn.disabled = true; btn.textContent = "Menyimpan...";
    API.post({
      action: "simpanPengaturan", email: email, password: password, deviceId: "",
      namaInstansi: $("s-instansi").value.trim(),
      lat: $("s-lat").value.trim(), lng: $("s-lng").value.trim(), radius: $("s-radius").value.trim(),
      abaikanLokasi: $("s-abaikan").checked,
      bebasJumat: $("s-jumat").checked,
      jamMasuk: $("s-jam-masuk").value.trim(), jamPulang: $("s-jam-pulang").value.trim(),
      bufferMasuk: $("s-buffer-masuk").value.trim(), bufferPulang: $("s-buffer-pulang").value.trim(),
      passwordBaru: pwBaru,
      emailAdminBaru: (emailBaru && emailBaru.toLowerCase() !== email.toLowerCase()) ? emailBaru : ""
    }).then(function (res) {
      pesan.className = "pesan " + (res.status === "success" ? "ok" : "err");
      pesan.textContent = res.message || (res.status === "success" ? "Tersimpan." : "Gagal.");
      pesan.classList.remove("hidden");
      if (res.status === "success" && pwBaru) { password = pwBaru; sessionStorage.setItem("pjlp_admin_pw", pwBaru); $("s-password").value = ""; }
      if (res.status === "success" && emailBaru) { email = emailBaru; sessionStorage.setItem("pjlp_admin_email", emailBaru); }
    }).catch(function (err) {
      pesan.className = "pesan err"; pesan.textContent = "Gagal: " + err.message; pesan.classList.remove("hidden");
    }).finally(function () { btn.disabled = false; btn.textContent = "Simpan Pengaturan"; });
  });

  /* ---------- Keluar (batalkan perangkat admin) ---------- */
  const linkKeluar = document.getElementById("link-keluar");
  if (linkKeluar) linkKeluar.addEventListener("click", function (ev) {
    ev.preventDefault();
    if (!confirm("Keluar dan hentikan perangkat ini sebagai admin? Situs akan kembali ke halaman absen.")) return;
    localStorage.removeItem("pjlp_admin_device");
    sessionStorage.removeItem("pjlp_admin_pw");
    location.replace("index.html?absen=1");
  });

  /* ---------- Auto-login ---------- */
  if (password && email && !API.belumDikonfigurasi()) masukDashboard();
})();
