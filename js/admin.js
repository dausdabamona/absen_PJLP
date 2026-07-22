/* ============================================================
   Panel admin (admin.html) — login password
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  let password = sessionStorage.getItem("pjlp_admin_pw") || "";
  let email = sessionStorage.getItem("pjlp_admin_email") || "";
  let role = sessionStorage.getItem("pjlp_role") || "ppk";
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
    sessionStorage.removeItem("pjlp_admin_pw"); sessionStorage.removeItem("pjlp_admin_email"); sessionStorage.removeItem("pjlp_role");
    password = ""; email = ""; role = "ppk";
    $("seksi-dashboard").classList.add("hidden"); $("seksi-login").classList.remove("hidden");
    $("login-pesan").textContent = "Sesi berakhir, masuk lagi.";
  }

  function muatData() {
    $("perangkat-info").textContent = "Memuat...";
    API.post({ action: "adminData", email: email, password: password, deviceId: "" })
      .then(function (res) {
        if (res.status !== "success") { if (/password/i.test(res.message || "")) keluar(); $("perangkat-info").textContent = res.message || "Gagal."; return; }
        role = res.role || "ppk";
        sessionStorage.setItem("pjlp_role", role);
        terapkanRoleUI();
        const s = res.pengaturan || {};
        $("s-instansi").value = s.namaInstansi || "";
        $("s-lat").value = s.lat || ""; $("s-lng").value = s.lng || ""; $("s-radius").value = s.radius || "";
        $("s-abaikan").checked = !!s.abaikanLokasi;
        $("s-jumat").checked = !!s.bebasJumat;
        $("s-jam-masuk").value = s.jamMasuk || ""; $("s-jam-pulang").value = s.jamPulang || "";
        $("s-buffer-masuk").value = (s.bufferMasuk !== undefined && s.bufferMasuk !== "") ? s.bufferMasuk : "";
        $("s-buffer-pulang").value = (s.bufferPulang !== undefined && s.bufferPulang !== "") ? s.bufferPulang : "";
        $("s-email").value = s.adminEmail || "";
        $("s-kepegawaian-email").value = s.kepegawaianEmail || "";
        $("s-operator-email").value = s.operatorEmail || "";
        semuaPerangkat = res.perangkat || [];
        render();
        isiDropdownPegawai();
        muatDashboard();
      })
      .catch(function (err) { $("perangkat-info").textContent = "Gagal: " + err.message; });
  }

  function terapkanRoleUI() {
    $("badge-role").textContent = role === "ppk" ? "👑 PPK" : (role === "operator" ? "🛠️ Operator" : "🗂️ Kepegawaian");
    // Tab "Pengaturan & Perangkat" tampil untuk PPK & Operator (keduanya kelola perangkat);
    // disembunyikan untuk Kepegawaian.
    var bolehUtama = (role === "ppk" || role === "operator");
    var tabUtama = document.querySelector('.tab[data-dash="utama"]');
    if (tabUtama) {
      tabUtama.classList.toggle("hidden", !bolehUtama);
      if (!bolehUtama && tabUtama.classList.contains("aktif")) {
        // Kalau sedang di tab yang disembunyikan, pindah ke Dashboard.
        document.querySelector('.tab[data-dash="beranda"]').click();
      }
    }
    // Form Pengaturan (lokasi/jam kerja/akun) hanya untuk PPK; Operator hanya lihat Perangkat.
    var cardPengaturan = $("card-pengaturan");
    if (cardPengaturan) cardPengaturan.classList.toggle("hidden", role !== "ppk");
    // "Ganti Password Saya" untuk Operator & Kepegawaian (PPK ganti lewat Pengaturan).
    var kotakGantiPw = $("kotak-ganti-pw");
    if (kotakGantiPw) kotakGantiPw.classList.toggle("hidden", role === "ppk");
  }

  function pegawaiAktifUnik() {
    // 1 orang bisa punya beberapa perangkat disetujui (NIP sama) - kembalikan 1 baris per NIP unik.
    // Perangkat ber-role PPK (mis. Firdaus) dikecualikan - bukan PJLP.
    var terlihat = {}, unik = [];
    semuaPerangkat.filter(function (d) { return d.status === "disetujui" && d.role !== "PPK"; }).forEach(function (d) {
      var kunci = d.nip ? "nip:" + String(d.nip).trim() : "dev:" + d.deviceId;
      if (terlihat[kunci]) return;
      terlihat[kunci] = true; unik.push(d);
    });
    return unik;
  }

  function isiDropdownPegawai() {
    var opsi = pegawaiAktifUnik()
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

  /* ============== Dashboard (Beranda) ============== */
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function hariIniStr() {
    var n = new Date();
    var offsetJam = (typeof CONFIG !== "undefined" && CONFIG.OFFSET_JAM) ? CONFIG.OFFSET_JAM : 0;
    var l = new Date(n.getTime() + n.getTimezoneOffset() * 60000 + offsetJam * 3600000);
    return l.getFullYear() + "-" + pad2(l.getMonth() + 1) + "-" + pad2(l.getDate());
  }
  function bulanIniStr() { return hariIniStr().substring(0, 7); }
  function jamMenitFmt(m) { m = parseInt(m, 10) || 0; if (m <= 0) return "0 mnt"; var j = Math.floor(m / 60), s = m % 60, o = []; if (j) o.push(j + " jam"); if (s) o.push(s + " mnt"); return o.join(" "); }
  function sisaHariDari(tglYmd) {
    if (!tglYmd) return null;
    var p = /(\d{4})-(\d{2})-(\d{2})/.exec(tglYmd); if (!p) return null;
    var target = new Date(+p[1], +p[2] - 1, +p[3]);
    var hariIni = new Date(); hariIni.setHours(0, 0, 0, 0);
    return Math.round((target - hariIni) / 86400000);
  }
  function badgeJenis(j) {
    var t = String(j || "").toLowerCase(), cls = "pulang";
    if (t.indexOf("sakit") === 0) cls = "sakit"; else if (t.indexOf("izin") === 0) cls = "izin"; else if (t.indexOf("cuti") === 0) cls = "cuti";
    return '<span class="badge ' + cls + '">' + esc(j) + "</span>";
  }
  function daftarKosong(el, teks) { el.innerHTML = '<div class="dash-kosong">' + esc(teks) + "</div>"; }

  function renderKpiHariIni(absRows, totalAktif) {
    var hari = hariIniStr(), perNip = {};
    absRows.forEach(function (r) {
      var tgl = String(r["Tanggal"] || "").substring(0, 10);
      if (tgl !== hari) return;
      if (String(r["Jenis"] || "").toLowerCase() !== "masuk") return;
      var nip = String(r["NIP/ID"] || ""); if (!nip) return;
      var waktu = String(r["Timestamp"] || (tgl + " " + (r["Jam"] || "")));
      if (!perNip[nip] || waktu < perNip[nip].waktu) perNip[nip] = { waktu: waktu, status: String(r["Status Waktu"] || "") };
    });
    var nipList = Object.keys(perNip);
    var hadir = nipList.length;
    var telat = nipList.filter(function (nip) { return /terlambat/i.test(perNip[nip].status); }).length;
    $("kpi-total").textContent = totalAktif;
    $("kpi-hadir").textContent = hadir;
    $("kpi-telat").textContent = telat;
    $("kpi-belum").textContent = Math.max(0, totalAktif - hadir);
  }

  function renderIzinAktif(izinRows) {
    var hari = hariIniStr(), el = $("dash-izin-aktif");
    var aktif = izinRows.filter(function (r) {
      var mulai = String(r["Tanggal Mulai"] || "").substring(0, 10);
      if (!mulai) return false;
      var selesai = String(r["Tanggal Selesai"] || "").substring(0, 10) || mulai;
      return hari >= mulai && hari <= selesai;
    });
    if (!aktif.length) { daftarKosong(el, "Tidak ada yang izin/sakit/cuti hari ini."); return; }
    el.innerHTML = '<ul class="dash-list">' + aktif.map(function (r) {
      return "<li><span>" + esc(r["Nama"] || "-") + "</span>" + badgeJenis(r["Jenis"] || "") + "</li>";
    }).join("") + "</ul>";
  }

  function renderTindakan() {
    var el = $("dash-tindakan");
    var pending = semuaPerangkat.filter(function (d) { return d.status === "pending"; });
    if (!pending.length) { daftarKosong(el, "Tidak ada perangkat menunggu persetujuan."); return; }
    el.innerHTML = '<ul class="dash-list">' + pending.map(function (d) {
      var ket = d.kemungkinanSama ? ' <span class="small muted">(🔗 kemungkinan sama dgn ' + esc(d.kemungkinanSama) + ")</span>" : "";
      return "<li><span>" + esc(d.nama) + ket + '</span><span class="mnt-warn">Pending</span></li>';
    }).join("") + "</ul>";
  }

  function renderKontrak() {
    var el = $("dash-kontrak");
    var upcoming = dataMaster.map(function (m) { return { nama: m.nama, sisa: sisaHariDari(m.kontrakSelesai), selesai: m.kontrakSelesai }; })
      .filter(function (x) { return x.sisa != null && x.sisa <= 60; })
      .sort(function (a, b) { return a.sisa - b.sisa; });
    if (!upcoming.length) { daftarKosong(el, "Tidak ada kontrak yang akan berakhir dalam 60 hari."); return; }
    el.innerHTML = '<ul class="dash-list">' + upcoming.map(function (x) {
      var kelas = x.sisa <= 30 ? "mnt-bad" : "mnt-warn";
      var teks = x.sisa < 0 ? "Sudah berakhir" : x.sisa + " hari lagi";
      return "<li><span>" + esc(x.nama) + "</span><span class=\"" + kelas + "\">" + teks + " (" + esc(x.selesai) + ")</span></li>";
    }).join("") + "</ul>";
  }

  function renderRingkasanBulan(absRows) {
    var bulan = bulanIniStr(), hariMap = {}, el = $("dash-ringkasan");
    absRows.forEach(function (r) {
      var tgl = String(r["Tanggal"] || "").substring(0, 10);
      if (tgl.indexOf(bulan) !== 0) return;
      if (String(r["Jenis"] || "").toLowerCase() !== "masuk") return;
      var nip = String(r["NIP/ID"] || ""); if (!nip) return;
      var key = nip + "|" + tgl;
      var waktu = String(r["Timestamp"] || (tgl + " " + (r["Jam"] || "")));
      var m = /Terlambat\s+(\d+)/i.exec(String(r["Status Waktu"] || ""));
      if (!hariMap[key] || waktu < hariMap[key].waktu) hariMap[key] = { nama: r["Nama"], nip: nip, waktu: waktu, telat: m ? parseInt(m[1], 10) : 0 };
    });
    var perNip = {};
    Object.keys(hariMap).forEach(function (k) {
      var d = hariMap[k]; if (d.telat <= 0) return;
      if (!perNip[d.nip]) perNip[d.nip] = { nama: d.nama, kali: 0, menit: 0 };
      perNip[d.nip].kali++; perNip[d.nip].menit += d.telat;
    });
    var top = Object.keys(perNip).map(function (k) { return perNip[k]; }).sort(function (a, b) { return b.menit - a.menit; }).slice(0, 5);
    if (!top.length) { daftarKosong(el, "Tidak ada keterlambatan bulan ini. 🎉"); return; }
    el.innerHTML = '<ul class="dash-list">' + top.map(function (x) {
      return "<li><span>" + esc(x.nama) + "</span><span class=\"mnt-bad\">" + x.kali + "× — " + jamMenitFmt(x.menit) + "</span></li>";
    }).join("") + "</ul>";
  }

  function muatDashboard() {
    $("dash-tanggal").textContent = "Data per " + hariIniStr();
    ["dash-izin-aktif", "dash-tindakan", "dash-kontrak", "dash-ringkasan"].forEach(function (id) { $(id).innerHTML = "Memuat..."; });
    Promise.all([
      API.post({ action: "rekapAbsensi", adminPassword: password, deviceId: "" }),
      API.post({ action: "rekapIzin", adminPassword: password, deviceId: "" }),
      API.post({ action: "adminDataMaster", email: email, password: password, deviceId: "" })
    ]).then(function (r) {
      var abs = (r[0] && r[0].data) || [];
      var izin = (r[1] && r[1].data) || [];
      if (r[2] && r[2].status === "success") dataMaster = r[2].master || [];
      var totalAktif = pegawaiAktifUnik().length;
      renderKpiHariIni(abs, totalAktif);
      renderIzinAktif(izin);
      renderTindakan();
      renderKontrak();
      renderRingkasanBulan(abs);
    }).catch(function (err) {
      ["dash-izin-aktif", "dash-tindakan", "dash-kontrak", "dash-ringkasan"].forEach(function (id) { daftarKosong($(id), "Gagal memuat: " + err.message); });
    });
  }

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
      // "Jadikan PPK / Jadikan PJLP" = penandaan role sensitif, khusus PPK.
      if (role === "ppk") {
        aksi += '<button class="mini aksi" data-id="' + esc(d.deviceId) + '" data-act="' + (d.role === "PPK" ? "lepasppk" : "jadippk") + '">' + (d.role === "PPK" ? "Jadikan PJLP" : "Jadikan PPK") + '</button> ';
      }
      aksi += '<button class="mini danger aksi" data-id="' + esc(d.deviceId) + '" data-act="hapus">Hapus</button>';
      var labelPPK = d.role === "PPK" ? ' <span class="badge menunggu small">PPK</span>' : "";
      var namaSel = "<td>" + esc(d.nama) + labelPPK + (d.kemungkinanSama ? '<br><span class="small muted">🔗 Kemungkinan sama dengan ' + esc(d.kemungkinanSama) + "</span>" : "") + "</td>";
      return "<tr>" + namaSel + "<td>" + esc(d.nip || "-") + "</td><td>" + badge(d.status) +
        "</td><td>" + esc(d.didaftarkan || "") + "</td><td class=\"mono small\">" + esc(d.deviceId) + "</td><td class=\"aksi-sel\">" + aksi + "</td></tr>";
    }).join("");
  }

  $("perangkat-body").addEventListener("click", function (ev) {
    const btn = ev.target.closest(".aksi"); if (!btn) return;
    const id = btn.getAttribute("data-id"), act = btn.getAttribute("data-act");
    if (act === "hapus") { if (!confirm("Hapus perangkat ini? Tidak bisa dibatalkan.")) return; kirim({ action: "hapusPerangkat", deviceId: id }); }
    else if (act === "jadippk") {
      if (!confirm("Tandai perangkat ini sebagai PPK? Akan dikecualikan dari Data Master PJLP, dropdown pegawai, dan Daftar Nominatif Gaji.")) return;
      kirim({ action: "setRolePerangkat", deviceId: id, roleBaru: "PPK" });
    }
    else if (act === "lepasppk") { kirim({ action: "setRolePerangkat", deviceId: id, roleBaru: "" }); }
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
  var DASH_PANEL = { beranda: $("dash-beranda"), utama: $("dash-utama"), master: $("dash-master"), register: $("dash-register"), dokumen: $("dash-dokumen") };
  document.querySelectorAll(".tab[data-dash]").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab[data-dash]").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif");
      var target = t.getAttribute("data-dash");
      Object.keys(DASH_PANEL).forEach(function (k) { DASH_PANEL[k].classList.toggle("hidden", k !== target); });
      if (target === "beranda") muatDashboard();
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
      emailAdminBaru: (emailBaru && emailBaru.toLowerCase() !== email.toLowerCase()) ? emailBaru : "",
      kepegawaianEmailBaru: $("s-kepegawaian-email").value.trim(),
      kepegawaianPasswordBaru: $("s-kepegawaian-password").value,
      operatorEmailBaru: $("s-operator-email").value.trim(),
      operatorPasswordBaru: $("s-operator-password").value
    }).then(function (res) {
      pesan.className = "pesan " + (res.status === "success" ? "ok" : "err");
      pesan.textContent = res.message || (res.status === "success" ? "Tersimpan." : "Gagal.");
      pesan.classList.remove("hidden");
      if (res.status === "success" && pwBaru) { password = pwBaru; sessionStorage.setItem("pjlp_admin_pw", pwBaru); $("s-password").value = ""; }
      if (res.status === "success" && emailBaru) { email = emailBaru; sessionStorage.setItem("pjlp_admin_email", emailBaru); }
      if (res.status === "success") { $("s-kepegawaian-password").value = ""; $("s-operator-password").value = ""; }
    }).catch(function (err) {
      pesan.className = "pesan err"; pesan.textContent = "Gagal: " + err.message; pesan.classList.remove("hidden");
    }).finally(function () { btn.disabled = false; btn.textContent = "Simpan Pengaturan"; });
  });

  /* ---------- Ganti Password Saya (Operator/Kepegawaian) ---------- */
  var formGantiPw = document.getElementById("form-ganti-pw");
  if (formGantiPw) formGantiPw.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var pesan = $("ganti-pw-pesan"), btn = $("btn-ganti-pw");
    var pw1 = $("gp-password").value, pw2 = $("gp-password2").value;
    pesan.classList.remove("hidden");
    if (pw1.length < 6) { pesan.className = "pesan err"; pesan.textContent = "Password baru minimal 6 karakter."; return; }
    if (pw1 !== pw2) { pesan.className = "pesan err"; pesan.textContent = "Ulangi password tidak sama."; return; }
    btn.disabled = true; btn.textContent = "Menyimpan...";
    API.post({ action: "gantiPasswordSendiri", email: email, password: password, passwordBaru: pw1, deviceId: "" })
      .then(function (res) {
        pesan.className = "pesan " + (res.status === "success" ? "ok" : "err");
        pesan.textContent = res.message || (res.status === "success" ? "Tersimpan." : "Gagal.");
        if (res.status === "success") {
          // Perbarui password sesi supaya request berikutnya tetap terautentikasi.
          password = pw1; sessionStorage.setItem("pjlp_admin_pw", pw1);
          $("gp-password").value = ""; $("gp-password2").value = "";
        }
      })
      .catch(function (err) { pesan.className = "pesan err"; pesan.textContent = "Gagal: " + err.message; })
      .finally(function () { btn.disabled = false; btn.textContent = "Simpan Password Baru"; });
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
  function sisaHari(tglYmd) {
    if (!tglYmd) return null;
    var p = /(\d{4})-(\d{2})-(\d{2})/.exec(tglYmd); if (!p) return null;
    var target = new Date(+p[1], +p[2] - 1, +p[3]);
    var hariIni = new Date(); hariIni.setHours(0, 0, 0, 0);
    return Math.round((target - hariIni) / 86400000);
  }
  function renderMaster() {
    var tbody = $("master-body");
    if (!dataMaster.length) { tbody.innerHTML = ""; $("master-info").textContent = "Belum ada data master tersimpan."; return; }
    $("master-info").textContent = "Total " + dataMaster.length + " data master.";
    tbody.innerHTML = dataMaster.map(function (m) {
      var sisa = sisaHari(m.kontrakSelesai);
      var kontrakTxt = m.kontrakSelesai ? esc(m.kontrakSelesai) : "-";
      if (sisa != null) {
        if (sisa < 0) kontrakTxt = '<span class="mnt-bad">' + kontrakTxt + " (berakhir)</span>";
        else if (sisa <= 30) kontrakTxt = '<span class="mnt-bad">' + kontrakTxt + " (" + sisa + " hari lagi)</span>";
        else if (sisa <= 60) kontrakTxt = '<span class="mnt-warn">' + kontrakTxt + " (" + sisa + " hari lagi)</span>";
      }
      return "<tr><td>" + esc(m.nama) + "</td><td>" + esc(m.jabatan2026 || "-") + "</td><td class=\"mono small\">" + esc(m.nik || "-") +
        "</td><td>Rp " + rupiahFmt(m.honorariumBulanan) + "</td><td>" + kontrakTxt + "</td><td>" + esc(m.diperbarui || "") +
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
    $("m-honorarium").value = m.honorariumBulanan || "";
    $("m-rekening").value = m.rekening || ""; $("m-pendidikan").value = m.pendidikan || "";
    $("m-kontrak-mulai").value = m.kontrakMulai || ""; $("m-kontrak-selesai").value = m.kontrakSelesai || "";
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
      $("m-honorarium").value = existing.honorariumBulanan || "";
      $("m-rekening").value = existing.rekening || ""; $("m-pendidikan").value = existing.pendidikan || "";
      $("m-kontrak-mulai").value = existing.kontrakMulai || ""; $("m-kontrak-selesai").value = existing.kontrakSelesai || "";
    } else {
      ["m-nik", "m-npwp", "m-jabatan", "m-alamat", "m-hps", "m-negosiasi", "m-honorarium", "m-rekening", "m-pendidikan", "m-kontrak-mulai", "m-kontrak-selesai"].forEach(function (id) { $(id).value = ""; });
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
      honorariumBulanan: $("m-honorarium").value.trim(),
      rekening: $("m-rekening").value.trim(), pendidikan: $("m-pendidikan").value.trim(),
      kontrakMulai: $("m-kontrak-mulai").value, kontrakSelesai: $("m-kontrak-selesai").value
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
    ["btn-dok-jurnal", "btn-dok-rekap", "btn-dok-ba", "btn-dok-kuitansi", "btn-dok-slip"].forEach(function (id) { $(id).disabled = !ada; });
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
  $("btn-dok-slip").addEventListener("click", function () { bukaDokumen("slip-gaji.html"); });
  // Nominatif Gaji mencakup SEMUA pegawai sekaligus - tidak perlu pilih 1 pegawai dulu.
  $("btn-dok-nominatif").addEventListener("click", function () { window.open("nominatif-gaji.html", "_blank"); });
  $("btn-dok-bpjs").addEventListener("click", function () { window.open("bpjs.html", "_blank"); });

  /* ---------- Auto-login ---------- */
  if (password && email && !API.belumDikonfigurasi()) masukDashboard();
})();
