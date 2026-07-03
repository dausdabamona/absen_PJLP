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
  let dataMaster = [];
  let dataRegister = [];

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
        isiDropdownPegawai();
      })
      .catch(function (err) { $("perangkat-info").textContent = "Gagal: " + err.message; });
  }

  function isiDropdownPegawai() {
    // 1 orang bisa punya beberapa perangkat disetujui (NIP sama) - tampilkan 1 baris per NIP unik.
    var terlihat = {}, unik = [];
    semuaPerangkat.filter(function (d) { return d.status === "disetujui"; }).forEach(function (d) {
      var kunci = d.nip ? "nip:" + String(d.nip).trim() : "dev:" + d.deviceId;
      if (terlihat[kunci]) return;
      terlihat[kunci] = true; unik.push(d);
    });
    var opsi = unik
      .map(function (d) { return '<option value="' + esc(d.nip || "") + '" data-device="' + esc(d.deviceId) + '" data-nama="' + esc(d.nama) + '">' + esc(d.nama) + (d.nip ? " (" + esc(d.nip) + ")" : "") + "</option>"; })
      .join("");
    ["m-pilih", "dok-pilih"].forEach(function (id) {
      var sel = $(id), nilaiLama = sel.value;
      sel.innerHTML = '<option value="">— pilih pegawai terdaftar —</option>' + opsi;
      sel.value = nilaiLama;
    });
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
      aksi += '<button class="mini aksi" data-id="' + esc(d.deviceId) + '" data-act="edit">Edit</button> ';
      aksi += '<button class="mini danger aksi" data-id="' + esc(d.deviceId) + '" data-act="hapus">Hapus</button>';
      var namaSel = "<td>" + esc(d.nama) + (d.kemungkinanSama ? '<br><span class="small muted">🔗 Kemungkinan sama dengan ' + esc(d.kemungkinanSama) + "</span>" : "") + "</td>";
      return "<tr>" + namaSel + "<td>" + esc(d.nip || "-") + "</td><td>" + badge(d.status) +
        "</td><td>" + esc(d.didaftarkan || "") + "</td><td class=\"mono small\">" + esc(d.deviceId) + "</td><td class=\"aksi-sel\">" + aksi + "</td></tr>";
    }).join("");
  }

  $("perangkat-body").addEventListener("click", function (ev) {
    const btn = ev.target.closest(".aksi"); if (!btn) return;
    const id = btn.getAttribute("data-id"), act = btn.getAttribute("data-act");
    if (act === "hapus") { if (!confirm("Hapus perangkat ini? Tidak bisa dibatalkan.")) return; kirim({ action: "hapusPerangkat", deviceId: id }); }
    else if (act === "edit") {
      const d = semuaPerangkat.filter(function (x) { return x.deviceId === id; })[0];
      if (!d) return;
      const namaBaru = prompt("Nama:", d.nama);
      if (namaBaru === null) return;
      const nipBaru = prompt("NIP/ID (harus sama persis dengan perangkat lain orang ini agar laporan tergabung):", d.nip || "");
      if (nipBaru === null) return;
      kirim({ action: "editPerangkat", deviceId: id, namaBaru: namaBaru.trim(), nipBaru: nipBaru.trim() });
    }
    else kirim({ action: "setStatusPerangkat", deviceId: id, statusBaru: act });
  });
  function kirim(payload) {
    payload.email = email; payload.password = password;
    $("perangkat-info").textContent = "Memproses...";
    API.post(payload).then(function (res) {
      if (res.status === "success") muatData(); else { alert(res.message || "Gagal."); muatData(); }
    }).catch(function (err) { alert("Gagal: " + err.message); });
  }

  document.querySelectorAll(".tab[data-filter]").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab[data-filter]").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif"); filterAktif = t.getAttribute("data-filter"); render();
    });
  });
  $("btn-refresh").addEventListener("click", muatData);

  /* ---------- Navigasi dashboard (Pengaturan / Data PJLP / Register / Buat Dokumen) ---------- */
  var DASH_PANEL = { utama: $("dash-utama"), master: $("dash-master"), register: $("dash-register"), dokumen: $("dash-dokumen") };
  document.querySelectorAll(".tab[data-dash]").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab[data-dash]").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif");
      var target = t.getAttribute("data-dash");
      Object.keys(DASH_PANEL).forEach(function (k) { DASH_PANEL[k].classList.toggle("hidden", k !== target); });
      if (target === "master" && !dataMaster.length && semuaPerangkat.length) muatDataMaster();
      if (target === "register" && !dataRegister.length) muatRegisterDokumen();
    });
  });

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

  /* ============== Data Master PJLP ============== */
  function muatDataMaster() {
    $("master-info").textContent = "Memuat...";
    API.post({ action: "adminDataMaster", email: email, password: password, deviceId: "" })
      .then(function (res) {
        if (res.status !== "success") { $("master-info").textContent = res.message || "Gagal."; return; }
        dataMaster = res.master || [];
        renderMaster();
      })
      .catch(function (err) { $("master-info").textContent = "Gagal: " + err.message; });
  }
  function rupiahFmt(n) { n = String(parseInt(n, 10) || 0); return n.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function renderMaster() {
    var tbody = $("master-body");
    if (!dataMaster.length) { tbody.innerHTML = ""; $("master-info").textContent = "Belum ada data master tersimpan."; return; }
    $("master-info").textContent = "Total " + dataMaster.length + " data master.";
    tbody.innerHTML = dataMaster.map(function (m) {
      return "<tr><td>" + esc(m.nama) + "</td><td>" + esc(m.jabatan2026 || "-") + "</td><td class=\"mono small\">" + esc(m.nik || "-") +
        "</td><td>Rp " + rupiahFmt(m.hargaNegosiasi) + "</td><td>" + esc(m.diperbarui || "") +
        '</td><td><button type="button" class="mini aksi-master" data-nip="' + esc(m.nip) + '">Edit</button></td></tr>';
    }).join("");
  }
  $("master-body").addEventListener("click", function (ev) {
    var btn = ev.target.closest(".aksi-master"); if (!btn) return;
    var nip = btn.getAttribute("data-nip");
    var m = dataMaster.filter(function (x) { return x.nip === nip; })[0];
    if (!m) return;
    $("m-pilih").value = nip; isiFormMasterDariPegawai();
    $("m-nik").value = m.nik || ""; $("m-npwp").value = m.npwp || "";
    $("m-jabatan").value = m.jabatan2026 || ""; $("m-alamat").value = m.alamat || "";
    $("m-hps").value = m.nilaiHps || ""; $("m-negosiasi").value = m.hargaNegosiasi || "";
    $("m-rekening").value = m.rekening || ""; $("m-pendidikan").value = m.pendidikan || "";
    window.scrollTo({ top: $("form-master").getBoundingClientRect().top + window.scrollY - 20, behavior: "smooth" });
  });

  function isiFormMasterDariPegawai() {
    var nip = $("m-pilih").value; $("m-nip").value = nip;
    if (!nip) return;
    var existing = dataMaster.filter(function (m) { return m.nip === nip; })[0];
    if (existing) {
      $("m-nik").value = existing.nik || ""; $("m-npwp").value = existing.npwp || "";
      $("m-jabatan").value = existing.jabatan2026 || ""; $("m-alamat").value = existing.alamat || "";
      $("m-hps").value = existing.nilaiHps || ""; $("m-negosiasi").value = existing.hargaNegosiasi || "";
      $("m-rekening").value = existing.rekening || ""; $("m-pendidikan").value = existing.pendidikan || "";
    } else {
      ["m-nik", "m-npwp", "m-jabatan", "m-alamat", "m-hps", "m-negosiasi", "m-rekening", "m-pendidikan"].forEach(function (id) { $(id).value = ""; });
    }
  }
  $("m-pilih").addEventListener("change", isiFormMasterDariPegawai);

  $("form-master").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var pesan = $("master-pesan"), btn = $("btn-master-simpan");
    var nip = $("m-pilih").value;
    if (!nip) { alert("Pilih pegawai terlebih dahulu."); return; }
    var opt = $("m-pilih").selectedOptions[0];
    btn.disabled = true; btn.textContent = "Menyimpan...";
    API.post({
      action: "simpanDataMaster", email: email, password: password, deviceId: "",
      nip: nip, nama: opt ? opt.getAttribute("data-nama") : "",
      nik: $("m-nik").value.trim(), npwp: $("m-npwp").value.trim(),
      jabatan2026: $("m-jabatan").value.trim(), alamat: $("m-alamat").value.trim(),
      nilaiHps: $("m-hps").value.trim(), hargaNegosiasi: $("m-negosiasi").value.trim(),
      rekening: $("m-rekening").value.trim(), pendidikan: $("m-pendidikan").value.trim()
    }).then(function (res) {
      pesan.className = "pesan " + (res.status === "success" ? "ok" : "err");
      pesan.textContent = res.message || (res.status === "success" ? "Tersimpan." : "Gagal.");
      pesan.classList.remove("hidden");
      if (res.status === "success") muatDataMaster();
    }).catch(function (err) {
      pesan.className = "pesan err"; pesan.textContent = "Gagal: " + err.message; pesan.classList.remove("hidden");
    }).finally(function () { btn.disabled = false; btn.textContent = "Simpan Data Master"; });
  });

  /* ============== Register Dokumen (referensi) ============== */
  function muatRegisterDokumen() {
    $("register-info").textContent = "Memuat...";
    API.post({ action: "adminRegisterDokumen", email: email, password: password, deviceId: "" })
      .then(function (res) {
        if (res.status !== "success") { $("register-info").textContent = res.message || "Gagal."; return; }
        dataRegister = res.data || [];
        renderRegister();
      })
      .catch(function (err) { $("register-info").textContent = "Gagal: " + err.message; });
  }
  function renderRegister() {
    var q = $("reg-cari").value.trim().toLowerCase();
    var data = !q ? dataRegister : dataRegister.filter(function (r) {
      return [r["Nama PJLP"], r["Jenis Dokumen"], r["Nomor Surat"], r["Jabatan PJLP"]].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    var tbody = $("register-body");
    if (!data.length) { tbody.innerHTML = ""; $("register-info").textContent = "Tidak ada dokumen untuk pencarian ini."; return; }
    $("register-info").textContent = "Menampilkan " + data.length + " dari " + dataRegister.length + " dokumen.";
    tbody.innerHTML = data.map(function (r) {
      return "<tr><td>" + esc(r["No File"] || "") + "</td><td>" + esc(r["Jenis Dokumen"] || "") + "</td><td>" + esc(r["Nomor Surat"] || "") +
        "</td><td>" + esc(r["Tanggal"] || "") + "</td><td>" + esc(r["Jabatan PJLP"] || "") + "</td><td>" + esc(r["Nama PJLP"] || "") +
        "</td><td>" + esc(r["Keterangan"] || "") + "</td></tr>";
    }).join("");
  }
  $("reg-cari").addEventListener("input", renderRegister);

  /* ============== Buat Dokumen per PJLP ============== */
  $("dok-pilih").addEventListener("change", function () {
    var ada = !!this.value;
    ["btn-dok-jurnal", "btn-dok-rekap", "btn-dok-ba", "btn-dok-kuitansi"].forEach(function (id) { $(id).disabled = !ada; });
  });
  function targetTerpilih() {
    var sel = $("dok-pilih"), opt = sel.selectedOptions[0];
    if (!opt || !sel.value) return null;
    return { nip: sel.value, nama: opt.getAttribute("data-nama") || "", deviceId: opt.getAttribute("data-device") || "" };
  }
  function bukaDokumen(halaman) {
    var t = targetTerpilih(); if (!t) return;
    sessionStorage.setItem("pjlp_target_nip", t.nip);
    sessionStorage.setItem("pjlp_target_nama", t.nama);
    sessionStorage.setItem("pjlp_target_deviceid", t.deviceId);
    window.open(halaman, "_blank");
  }
  $("btn-dok-jurnal").addEventListener("click", function () { bukaDokumen("laporan.html"); });
  $("btn-dok-rekap").addEventListener("click", function () { window.open("rekap.html", "_blank"); });
  $("btn-dok-ba").addEventListener("click", function () { bukaDokumen("berita-acara.html"); });
  $("btn-dok-kuitansi").addEventListener("click", function () { bukaDokumen("kuitansi.html"); });

  /* ---------- Auto-login ---------- */
  if (password && email && !API.belumDikonfigurasi()) masukDashboard();
})();
