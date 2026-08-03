/* ============================================================
   Halaman absen (index.html) — identitas berbasis perangkat
   Cek perangkat -> (daftar / pending / blokir / absen).
   Absen: jenis & status otomatis di server, tanpa foto.
   Jurnal: wajib foto + deskripsi. Pengingat jurnal tiap N menit.
   ============================================================ */

(function () {
  "use strict";

  // Laptop/desktop -> panel admin otomatis; HP/tablet -> halaman absen PJLP.
  // Perangkat yang pernah login admin (mis. HP Firdaus) juga diarahkan ke admin.
  // Tambah "?absen=1" pada URL untuk membuka halaman absen secara paksa.
  var ua = navigator.userAgent || "";
  var mobile = /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile|Mobile/i.test(ua);
  var adminDevice = localStorage.getItem("pjlp_admin_device") === "1";
  if ((!mobile || adminDevice) && location.search.indexOf("absen") === -1) { location.replace("admin.html"); return; }

  const $ = function (id) { return document.getElementById(id); };
  const deviceId = getDeviceId();

  const elJamTime = document.querySelector(".clock-time");
  const elJamDate = document.querySelector(".clock-date");
  const pesan = $("pesan");

  const seksi = {
    loading: $("seksi-loading"),
    daftar: $("seksi-daftar"),
    pending: $("seksi-pending"),
    blokir: $("seksi-blokir"),
    absen: $("seksi-absen")
  };

  let lokasiAbsen = null, lokasiJurnal = null;
  let lokasiSusulan = null;
  let reminderTimer = null;

  $("device-id-singkat").textContent = deviceId.slice(0, 8) + "…";

  /* ---------- Jam ---------- */
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  function waktuLokal() { const n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + CONFIG.OFFSET_JAM * 3600000); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function hariIni() { const d = waktuLokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function updateJam() {
    const d = waktuLokal();
    elJamTime.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " " + CONFIG.LABEL_ZONA;
    elJamDate.textContent = HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
  }
  updateJam(); setInterval(updateJam, 1000);

  /* ---------- Util ---------- */
  function tampil(nama) { Object.keys(seksi).forEach(function (k) { seksi[k].classList.toggle("hidden", k !== nama); }); }
  function tampilkanPesan(teks, ok) { pesan.textContent = teks; pesan.className = "pesan " + (ok ? "ok" : "err"); pesan.classList.remove("hidden"); }

  function bukaPanduanGps() {
    var g = document.getElementById("panduan-gps");
    if (g) { g.open = true; g.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }
  function ambilLokasi(elStatus, btn, simpan) {
    if (!navigator.geolocation) { elStatus.textContent = "Browser tidak mendukung GPS."; elStatus.className = "status err"; bukaPanduanGps(); return; }
    elStatus.textContent = "Mengambil lokasi GPS..."; elStatus.className = "status muted"; btn.disabled = true;

    // GPS butuh beberapa detik untuk "mengunci" satelit; bacaan pertama sering
    // kasar (±200 m). Kita pantau beberapa bacaan lalu ambil yang PALING akurat,
    // berhenti lebih awal begitu akurasi sudah cukup baik.
    var TARGET_AKURASI = 30;   // meter: kalau sudah <= ini, langsung pakai
    var MAX_WAKTU = 20000;     // ms: batas total menunggu GPS konvergen
    var terbaik = null, watchId = null, selesai = false, timer = null;

    function bersihkan() {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      if (timer !== null) { clearTimeout(timer); timer = null; }
    }
    function tuntas() {
      if (selesai) return;
      selesai = true; bersihkan(); btn.disabled = false;
      if (!terbaik) { elStatus.textContent = "Gagal mengambil lokasi (GPS tidak memberi sinyal)."; elStatus.className = "status err"; return; }
      simpan(terbaik);
      var peringatan = terbaik.akurasi > 100
        ? "<b>Akurasi rendah</b> — coba di luar ruangan / dekat jendela, aktifkan GPS presisi tinggi, lalu ambil ulang. "
        : "";
      elStatus.innerHTML = "✔ Lokasi terekam (±" + terbaik.akurasi + " m). " + peringatan +
        '<a href="https://maps.google.com/?q=' + terbaik.lat + "," + terbaik.lng + '" target="_blank" rel="noopener">Lihat peta</a>';
      elStatus.className = "status " + (terbaik.akurasi > 100 ? "warn" : "ok");
      if (terbaik.akurasi > 100) bukaPanduanGps(); // akurasi rendah -> tampilkan solusi
    }

    timer = setTimeout(tuntas, MAX_WAKTU);
    watchId = navigator.geolocation.watchPosition(
      function (pos) {
        var akr = Math.round(pos.coords.accuracy);
        if (!terbaik || akr < terbaik.akurasi) {
          terbaik = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: akr };
        }
        elStatus.textContent = "Mencari sinyal GPS akurat... terbaik ±" + terbaik.akurasi + " m (tunggu sebentar di tempat terbuka)";
        elStatus.className = "status muted";
        if (terbaik.akurasi <= TARGET_AKURASI) tuntas(); // sudah cukup akurat
      },
      function (err) {
        // Kalau sudah ada bacaan terbaik, biarkan timer/target yang menuntaskan.
        if (!terbaik && !selesai) { selesai = true; bersihkan(); btn.disabled = false; elStatus.textContent = "Gagal mengambil lokasi: " + err.message; elStatus.className = "status err"; bukaPanduanGps(); }
      },
      { enableHighAccuracy: true, timeout: MAX_WAKTU, maximumAge: 0 }
    );
  }
  function kompresGambar(dataUrl, maxLebar, kualitas, cb) {
    const img = new Image();
    img.onload = function () {
      const skala = Math.min(1, maxLebar / img.width), w = Math.round(img.width * skala), h = Math.round(img.height * skala);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(c.toDataURL("image/jpeg", kualitas));
    };
    img.src = dataUrl;
  }

  /* ---------- Ringkasan pribadi (bulan ini) ---------- */
  function nilaiBaris(row) { var o = []; for (var k in row) { if (Object.prototype.hasOwnProperty.call(row, k)) o.push(row[k]); } return o; }
  function jamMenit(m) { m = parseInt(m, 10) || 0; if (m <= 0) return "0"; var j = Math.floor(m / 60), s = m % 60, o = []; if (j) o.push(j + " jam"); if (s) o.push(s + " mnt"); return o.join(" "); }
  function normAbsen(row) {
    var o = { tanggal: "", jam: "", waktu: "", jenis: "", terlambat: 0, cepat: 0 };
    nilaiBaris(row).forEach(function (v) {
      var s = (v == null ? "" : String(v)).trim(); if (!s) return;
      var mt = /Terlambat\s+(\d+)\s*menit/i.exec(s); if (mt) { o.terlambat = parseInt(mt[1], 10); return; }
      var mc = /Pulang\s*Cepat\s+(\d+)\s*menit/i.exec(s); if (mc) { o.cepat = parseInt(mc[1], 10); return; }
      if (/^(masuk|pulang)$/i.test(s)) { o.jenis = s; return; }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        if (!o.tanggal) o.tanggal = s.substring(0, 10);
        var tm = /(\d{1,2}:\d{2}(:\d{2})?)/.exec(s); if (tm) { if (!o.jam) o.jam = tm[1]; if (!o.waktu) o.waktu = s; }
        return;
      }
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) { if (!o.jam) o.jam = s; return; }
    });
    if (!o.waktu) o.waktu = (o.tanggal + " " + o.jam).trim();
    return o;
  }
  function bulanIniStr() { var d = waktuLokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }

  function muatRingkasanSaya() {
    var bulan = bulanIniStr();
    $("rs-bulan").textContent = BULAN[waktuLokal().getMonth()] + " " + waktuLokal().getFullYear();
    Promise.all([API.post({ action: "rekapAbsensi" }), API.post({ action: "rekapIzin" })])
      .then(function (r) {
        var abs = (r[0] && r[0].data) || [], izin = (r[1] && r[1].data) || [];
        var hadir = {}, tlKali = 0, tlMenit = 0, pcKali = 0, sakit = 0, izinN = 0, cuti = 0;
        // Dedup per hari: Masuk pertama (telat) & Pulang terakhir (cepat)
        var hari = {};
        abs.forEach(function (row) {
          var o = normAbsen(row);
          if (o.tanggal.indexOf(bulan) !== 0 || !o.tanggal) return;
          if (!hari[o.tanggal]) hari[o.tanggal] = { masuk: null, pulang: null };
          var d = hari[o.tanggal];
          if (/masuk/i.test(o.jenis)) { if (!d.masuk || o.waktu < d.masuk.waktu) d.masuk = o; }
          else if (/pulang/i.test(o.jenis)) { if (!d.pulang || o.waktu > d.pulang.waktu) d.pulang = o; }
        });
        Object.keys(hari).forEach(function (t) {
          var d = hari[t];
          if (d.masuk) { hadir[t] = true; if (d.masuk.terlambat > 0) { tlKali++; tlMenit += d.masuk.terlambat; } }
          if (d.pulang && d.pulang.cepat > 0) pcKali++;
        });
        izin.forEach(function (row) {
          var vals = nilaiBaris(row).map(function (v) { return v == null ? "" : String(v); });
          var dlmBulan = vals.some(function (s) { return /^\d{4}-\d{2}-\d{2}/.test(s) && s.indexOf(bulan) === 0; });
          if (!dlmBulan) return;
          var jenis = vals.filter(function (s) { return /^(sakit|izin|cuti)$/i.test(s.trim()); })[0] || "";
          if (/sakit/i.test(jenis)) sakit++; else if (/izin/i.test(jenis)) izinN++; else if (/cuti/i.test(jenis)) cuti++;
        });
        $("rs-hadir").textContent = Object.keys(hadir).length;
        $("rs-telat-x").textContent = tlKali;
        $("rs-telat-jam").textContent = jamMenit(tlMenit);
        $("rs-cepat-x").textContent = pcKali;
        $("rs-izin").textContent = "Sakit " + sakit + " • Izin " + izinN + " • Cuti " + cuti;
        $("ringkasan-saya").classList.remove("hidden");
      })
      .catch(function () { /* diam saja bila gagal */ });
  }

  /* ---------- Cek perangkat ---------- */
  function cekStatus() {
    if (API.belumDikonfigurasi()) {
      seksi.loading.textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL di js/config.js).";
      seksi.loading.className = "status err center"; return;
    }
    tampil("loading");
    seksi.loading.textContent = "Memeriksa status perangkat..."; seksi.loading.className = "status muted center";
    API.post({ action: "cekPerangkat" })
      .then(function (res) {
        if (res.status !== "success") throw new Error(res.message || "gagal");
        if (res.jamMasuk && res.jamPulang) {
          $("info-jam-kerja").textContent = "Jam kerja: masuk " + res.jamMasuk + " • pulang " + res.jamPulang + " — sebelum 12.00 = Masuk, 12.00 ke atas = Pulang.";
        }
        const badge = $("badge-wfa");
        if (badge) badge.style.display = (waktuLokal().getDay() === 5) ? "flex" : "none";
        if (!res.terdaftar) { tampil("daftar"); return; }
        if (res.deviceStatus === "disetujui") {
          $("absen-nama").textContent = res.nama || "";
          $("absen-nip").textContent = res.nip ? "• " + res.nip : "";
          tampil("absen"); mulaiReminder(); muatRingkasanSaya();
        } else if (res.deviceStatus === "pending") {
          $("pending-nama").textContent = res.nama || ""; tampil("pending");
        } else { tampil("blokir"); }
      })
      .catch(function (err) {
        seksi.loading.textContent = "Gagal memeriksa status: " + err.message;
        seksi.loading.className = "status err center"; tampil("loading");
      });
  }

  /* ---------- Daftar ---------- */
  $("form-daftar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const nama = $("d-nama").value.trim();
    const nip = $("d-nip").value.trim();
    if (!nama) { tampilkanPesan("Nama wajib diisi.", false); return; }
    if (!nip) { tampilkanPesan("NIP/ID wajib diisi (harus sama dengan pendaftaran HP lain Anda).", false); return; }
    const btn = $("btn-daftar"); btn.disabled = true; btn.textContent = "Mengirim...";
    API.post({ action: "daftarPerangkat", nama: nama, nip: nip })
      .then(function (res) {
        if (res.status === "success") { $("pending-nama").textContent = nama; tampil("pending"); pesan.classList.add("hidden"); }
        else tampilkanPesan("Gagal: " + (res.message || "kesalahan"), false);
      })
      .catch(function (err) { tampilkanPesan("Gagal mendaftar: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Daftarkan Perangkat"; });
  });

  $("btn-cek-ulang").addEventListener("click", cekStatus);
  $("btn-cek-ulang2").addEventListener("click", cekStatus);

  /* ---------- Tab Absen / Jurnal / Izin ---------- */
  const PANES = ["pane-absen", "pane-jurnal", "pane-jurnal-susulan", "pane-izin"];
  document.querySelectorAll("#seksi-absen .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll("#seksi-absen .tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif");
      const pane = t.getAttribute("data-pane");
      PANES.forEach(function (p) { $(p).classList.toggle("hidden", p !== pane); });
      pesan.classList.add("hidden");
    });
  });

  /* ---------- Absen ---------- */
  // Jenis ditentukan otomatis: sebelum 12.00 = Masuk, 12.00 ke atas = Pulang.
  function jenisAbsenSekarang() { return waktuLokal().getHours() < 12 ? "Masuk" : "Pulang"; }
  function tampilkanTombolAbsen() {
    const btn = $("btn-submit"), hint = $("absen-hint");
    if (!lokasiAbsen) { btn.classList.add("hidden"); hint.classList.remove("hidden"); return; }
    btn.textContent = "Kirim Absen " + jenisAbsenSekarang();
    btn.classList.remove("hidden"); hint.classList.add("hidden");
  }
  $("btn-lokasi").addEventListener("click", function () { ambilLokasi($("status-lokasi"), $("btn-lokasi"), function (l) { lokasiAbsen = l; tampilkanTombolAbsen(); }); });
  $("form-absen").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const btn = $("btn-submit"); btn.disabled = true; btn.textContent = "Mengirim..."; pesan.classList.add("hidden");
    API.post({ action: "absen", lat: lokasiAbsen ? lokasiAbsen.lat : "", lng: lokasiAbsen ? lokasiAbsen.lng : "", akurasi: lokasiAbsen ? lokasiAbsen.akurasi : "", keterangan: $("keterangan").value.trim() })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          lokasiAbsen = null; $("keterangan").value = "";
          $("status-lokasi").textContent = "Lokasi belum diambil."; $("status-lokasi").className = "status muted";
        } else { tampilkanPesan(res.message || "Gagal mencatat absen.", false); if (res.code && res.code !== "disetujui") cekStatus(); }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; tampilkanTombolAbsen(); });
  });

  // Pengelola hingga maxN foto: kompres, tampilkan thumbnail, bisa hapus per foto.
  function pengelolaFotoMulti(inputEl, btnEl, wrapEl, maxN, labelDefault) {
    var list = [];
    function render() {
      wrapEl.innerHTML = "";
      list.forEach(function (dataUrl, i) {
        var d = document.createElement("div"); d.className = "thumb";
        var im = document.createElement("img"); im.src = dataUrl; im.alt = "Foto " + (i + 1);
        var x = document.createElement("button"); x.type = "button"; x.className = "thumb-x"; x.setAttribute("aria-label", "Hapus foto"); x.textContent = "×";
        x.addEventListener("click", function () { list.splice(i, 1); render(); });
        d.appendChild(im); d.appendChild(x); wrapEl.appendChild(d);
      });
      wrapEl.classList.toggle("hidden", list.length === 0);
      var sisa = maxN - list.length;
      btnEl.disabled = sisa <= 0;
      btnEl.textContent = list.length === 0 ? labelDefault : (sisa > 0 ? "Tambah Foto (" + list.length + "/" + maxN + ")" : "Maks " + maxN + " foto");
    }
    btnEl.addEventListener("click", function () { if (list.length < maxN) inputEl.click(); });
    inputEl.addEventListener("change", function () {
      var files = Array.prototype.slice.call(inputEl.files || []);
      inputEl.value = ""; // reset agar file yang sama bisa dipilih lagi
      if (!files.length) return;
      var muat = files.slice(0, maxN - list.length);
      if (files.length > muat.length) tampilkanPesan("Maksimal " + maxN + " foto per kegiatan.", false);
      muat.forEach(function (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          kompresGambar(e.target.result, 1000, 0.7, function (dataUrl) {
            if (list.length < maxN) list.push(dataUrl);
            render();
          });
        };
        reader.readAsDataURL(file);
      });
    });
    render();
    return { get: function () { return list; }, reset: function () { list.length = 0; render(); } };
  }

  /* ---------- Jurnal ---------- */
  var fotoJurnalMgr = pengelolaFotoMulti($("j-foto"), $("btn-j-foto"), $("j-preview-wrap"), 3, "Ambil / Pilih Foto");
  $("btn-j-lokasi").addEventListener("click", function () { ambilLokasi($("j-status-lokasi"), $("btn-j-lokasi"), function (l) { lokasiJurnal = l; }); });
  $("form-jurnal").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const kegiatan = $("j-kegiatan").value.trim();
    if (!kegiatan) { tampilkanPesan("Deskripsi kegiatan wajib diisi.", false); return; }
    var fotos = fotoJurnalMgr.get();
    if (!fotos.length) { tampilkanPesan("Foto kegiatan wajib diambil (minimal 1).", false); return; }
    const btn = $("btn-j-submit"); btn.disabled = true; btn.textContent = "Menyimpan..."; pesan.classList.add("hidden");
    API.post({ action: "jurnal", kegiatan: kegiatan, fotoList: fotos, lat: lokasiJurnal ? lokasiJurnal.lat : "", lng: lokasiJurnal ? lokasiJurnal.lng : "" })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          fotoJurnalMgr.reset(); lokasiJurnal = null; $("j-kegiatan").value = "";
          $("j-status-lokasi").textContent = "Lokasi belum diambil."; $("j-status-lokasi").className = "status muted";
          tandaiJurnalTerisi();
        } else { tampilkanPesan(res.message || "Gagal menyimpan jurnal.", false); if (res.code && res.code !== "disetujui") cekStatus(); }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Simpan Jurnal"; });
  });

  /* ---------- Jurnal Susulan (hari yang telah lewat) ---------- */
  $("su-tanggal").max = hariIni();
  var fotoSusulanMgr = pengelolaFotoMulti($("su-foto"), $("btn-su-foto"), $("su-preview-wrap"), 3, "Ambil / Pilih Foto");
  $("btn-su-lokasi").addEventListener("click", function () { ambilLokasi($("su-status-lokasi"), $("btn-su-lokasi"), function (l) { lokasiSusulan = l; }); });
  $("form-jurnal-susulan").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const tanggal = $("su-tanggal").value;
    if (!tanggal) { tampilkanPesan("Tanggal kegiatan wajib diisi.", false); return; }
    if (tanggal > hariIni()) { tampilkanPesan("Tanggal tidak boleh di masa depan.", false); return; }
    const kegiatan = $("su-kegiatan").value.trim();
    if (!kegiatan) { tampilkanPesan("Deskripsi kegiatan wajib diisi.", false); return; }
    var fotos = fotoSusulanMgr.get();
    if (!fotos.length) { tampilkanPesan("Foto kegiatan wajib diambil (minimal 1).", false); return; }
    const btn = $("btn-su-submit"); btn.disabled = true; btn.textContent = "Menyimpan..."; pesan.classList.add("hidden");
    API.post({ action: "jurnal", kegiatan: kegiatan, fotoList: fotos, tanggalKegiatan: tanggal, lat: lokasiSusulan ? lokasiSusulan.lat : "", lng: lokasiSusulan ? lokasiSusulan.lng : "" })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          fotoSusulanMgr.reset(); lokasiSusulan = null; $("su-kegiatan").value = ""; $("su-tanggal").value = "";
          $("su-status-lokasi").textContent = "Lokasi belum diambil."; $("su-status-lokasi").className = "status muted";
        } else { tampilkanPesan(res.message || "Gagal menyimpan jurnal susulan.", false); if (res.code && res.code !== "disetujui") cekStatus(); }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Simpan Jurnal Susulan"; });
  });

  /* ---------- Izin / Tidak Hadir ---------- */
  let fotoIzin = null;
  const inputIFoto = $("i-foto");
  $("btn-i-foto").addEventListener("click", function () { inputIFoto.click(); });
  inputIFoto.addEventListener("change", function () {
    const file = inputIFoto.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      kompresGambar(e.target.result, 1200, 0.7, function (dataUrl) {
        fotoIzin = dataUrl; $("i-preview").src = dataUrl;
        $("i-preview-wrap").classList.remove("hidden"); $("btn-i-foto").textContent = "Ganti Foto Surat";
      });
    };
    reader.readAsDataURL(file);
  });
  $("form-izin").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const alasan = $("i-alasan").value.trim();
    if (!$("i-mulai").value) { tampilkanPesan("Tanggal mulai wajib diisi.", false); return; }
    if (!alasan) { tampilkanPesan("Alasan wajib diisi.", false); return; }
    if (!fotoIzin) { tampilkanPesan("Foto surat wajib dilampirkan.", false); return; }
    const btn = $("btn-i-submit"); btn.disabled = true; btn.textContent = "Mengirim..."; pesan.classList.add("hidden");
    API.post({
      action: "izin", jenis: $("i-jenis").value,
      tglMulai: $("i-mulai").value, tglSelesai: $("i-selesai").value,
      alasan: alasan, foto: fotoIzin
    })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          fotoIzin = null; $("i-alasan").value = ""; $("i-selesai").value = "";
          $("i-preview-wrap").classList.add("hidden"); $("btn-i-foto").textContent = "Ambil / Pilih Foto Surat";
        } else { tampilkanPesan(res.message || "Gagal mengajukan.", false); if (res.code && res.code !== "disetujui") cekStatus(); }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Ajukan"; });
  });

  /* ---------- Pengingat jurnal ---------- */
  const INTERVAL_MS = (CONFIG.INTERVAL_JURNAL_MENIT || 120) * 60000;
  function keyJurnal() { return "pjlp_last_jurnal_" + deviceId; }
  function tandaiJurnalTerisi() { localStorage.setItem(keyJurnal(), String(Date.now())); $("reminder-banner").classList.add("hidden"); updateReminderStatus(); }
  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination); o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.1;
      o.start(); setTimeout(function () { o.stop(); ac.close(); }, 500);
    } catch (e) { /* abaikan */ }
  }
  function notify() {
    const teks = "Saatnya mengisi Jurnal Kegiatan.";
    $("reminder-banner").textContent = "🔔 " + teks; $("reminder-banner").classList.remove("hidden");
    if ("Notification" in window && Notification.permission === "granted") { try { new Notification("Pengingat Jurnal PJLP", { body: teks, tag: "jurnal-pjlp" }); } catch (e) { } }
    beep();
  }
  function updateReminderStatus() {
    const last = parseInt(localStorage.getItem(keyJurnal()) || "0", 10) || Date.now();
    const menit = Math.ceil(Math.max(0, INTERVAL_MS - (Date.now() - last)) / 60000);
    $("reminder-status").textContent = "⏰ Pengingat jurnal tiap " + CONFIG.INTERVAL_JURNAL_MENIT + " menit" + (menit > 0 ? " · berikutnya ±" + menit + " menit lagi" : " · sekarang!");
  }
  function cekReminder() {
    const last = parseInt(localStorage.getItem(keyJurnal()) || "0", 10);
    if (!last) { localStorage.setItem(keyJurnal(), String(Date.now())); updateReminderStatus(); return; }
    if (Date.now() - last >= INTERVAL_MS) notify();
    updateReminderStatus();
  }
  function mulaiReminder() {
    if (reminderTimer) return;
    if (!localStorage.getItem(keyJurnal())) localStorage.setItem(keyJurnal(), String(Date.now()));
    if ("Notification" in window && Notification.permission === "default") { try { Notification.requestPermission(); } catch (e) { } }
    updateReminderStatus(); cekReminder();
    reminderTimer = setInterval(cekReminder, 60000);
  }

  /* ---------- Mulai ---------- */
  cekStatus();
})();
