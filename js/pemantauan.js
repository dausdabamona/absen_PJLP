/* ============================================================
   Pemantauan (pemantauan.html) — read-only untuk Wadir II, BAU,
   Direktur, Kepegawaian. Dua layar: Jurnal Harian & Rekap Bulanan.
   Mencakup PJLP & PPPK (status dari peta NIP -> jenis via adminData).
   Reuse pola & helper dari js/rekap.js. Backend tidak diubah.
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  /* ---------- util (dari rekap.js) ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function tgl(v) { return v ? String(v).substring(0, 10) : ""; }
  function link(url, teks) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + teks + "</a>" : "-"; }
  function nilaiBaris(row) { var o = []; for (var k in row) { if (Object.prototype.hasOwnProperty.call(row, k)) o.push(row[k]); } return o; }
  function cari(row, kandidat) { for (var i = 0; i < kandidat.length; i++) { var k = kandidat[i]; if (row[k] !== undefined && row[k] !== "") return String(row[k]); } return ""; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function badge(j) {
    if (!j) return "";
    var t = j.toLowerCase(), cls = "masuk";
    if (t.indexOf("pulang") === 0) cls = "pulang";
    else if (t.indexOf("sakit") === 0) cls = "sakit";
    else if (t.indexOf("izin") === 0) cls = "izin";
    else if (t.indexOf("cuti") === 0) cls = "cuti";
    return '<span class="badge ' + cls + '">' + esc(j) + "</span>";
  }
  function angkaWarna(n, kelas) { n = parseInt(n, 10) || 0; return n > 0 ? '<span class="' + kelas + '">' + n + "</span>" : '<span class="mnt-ok">0</span>'; }
  function badgeStatus(st) {
    if (st === "PPPK") return '<span class="badge sakit">PPPK</span>';
    return '<span class="badge" style="background:#eef2f7;color:#475569;">PJLP</span>';
  }
  function lokalDate() { var n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); }
  function bulanIni() { var d = lokalDate(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function hariIniStr() { var d = lokalDate(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmtTglPanjang(ymd) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ""); if (!p) return "-"; var d = new Date(+p[1], +p[2] - 1, +p[3]); return HARI[d.getDay()] + ", " + (+p[3]) + " " + BULAN[+p[2] - 1] + " " + p[1]; }
  function jamMenit(m) { m = parseInt(m, 10) || 0; if (m <= 0) return "0"; var j = Math.floor(m / 60), s = m % 60, o = []; if (j) o.push(j + " jam"); if (s) o.push(s + " mnt"); return o.join(" "); }
  function parseTgl(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)) : null; }

  /* ---------- normalisasi (dari rekap.js) ---------- */
  function normAbsen(row) {
    var o = { tanggal: "", jam: "", waktu: "", nama: "", nip: "", deviceId: "", jenis: "", status: "", terlambat: 0, cepat: 0, link: "", ket: "" };
    nilaiBaris(row).forEach(function (v) {
      var s = (v == null ? "" : String(v)).trim();
      if (!s) return;
      if (/^https?:\/\//i.test(s)) { if (!o.link) o.link = s; return; }
      var mTl = /Terlambat\s+(\d+)\s*menit/i.exec(s); if (mTl) { o.status = s; o.terlambat = parseInt(mTl[1], 10); return; }
      var mPc = /Pulang\s*Cepat\s+(\d+)\s*menit/i.exec(s); if (mPc) { o.status = s; o.cepat = parseInt(mPc[1], 10); return; }
      if (/Tepat\s*Waktu/i.test(s)) { o.status = s; return; }
      if (/^(masuk|pulang)$/i.test(s)) { o.jenis = s; return; }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        if (!o.tanggal) o.tanggal = s.substring(0, 10);
        var tm = /(\d{1,2}:\d{2}(:\d{2})?)/.exec(s);
        if (tm) { if (!o.jam) o.jam = tm[1]; if (!o.waktu) o.waktu = s; }
        return;
      }
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) { if (!o.jam) o.jam = s; return; }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(s)) { if (!o.deviceId) o.deviceId = s; return; }
      if (/^[-+]?\d{1,3}\.\d+$/.test(s)) return;
      if (/^\d{4,}$/.test(s)) { if (!o.nip) o.nip = s; return; }
      if (/^\[.*\]$/.test(s)) { o.ket = o.ket ? o.ket + " " + s : s; return; }
      if (/[a-zA-Z]/.test(s)) { if (!o.nama) o.nama = s; else o.ket = o.ket ? o.ket + " " + s : s; }
    });
    if (!o.waktu) o.waktu = (o.tanggal + " " + o.jam).trim();
    return o;
  }
  function normIzin(row) {
    var o = { tanggal: "", nama: "", nip: "", jenis: "", mulai: "", selesai: "", alasan: "", link: "" };
    var tanggal = [];
    nilaiBaris(row).forEach(function (v) {
      var s = (v == null ? "" : String(v)).trim();
      if (!s) return;
      if (/^https?:\/\//i.test(s)) { if (!o.link) o.link = s; return; }
      if (/^(sakit|izin|cuti)$/i.test(s)) { o.jenis = s; return; }
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) { tanggal.push(s.substring(0, 10)); return; }
      if (/^\d{4,}$/.test(s)) { if (!o.nip) o.nip = s; return; }
      if (/[a-zA-Z]/.test(s)) { if (!o.nama) o.nama = s; else if (!o.alasan) o.alasan = s; }
    });
    o.tanggal = tanggal[0] || ""; o.mulai = tanggal[1] || tanggal[0] || ""; o.selesai = tanggal[2] || tanggal[1] || "";
    return o;
  }

  /* ---------- data & status ---------- */
  var absRows = [], jurnalRows = [], izinRows = [], pegawai = [];
  var petaNip = {}, petaNama = {}; // NIP/nama -> "PJLP" | "PPPK"
  var statusFilter = "semua", mode = "ringkasan", jfFilter = "semua";

  function keyOf(nip, nama) { return (nip && String(nip).trim()) ? "nip:" + String(nip).trim() : "nama:" + String(nama || "").trim().toLowerCase(); }
  function statusOf(nip, nama) {
    if (nip && petaNip[String(nip).trim()]) return petaNip[String(nip).trim()];
    if (nama && petaNama[String(nama).trim().toLowerCase()]) return petaNama[String(nama).trim().toLowerCase()];
    return "PJLP";
  }
  function lolosStatus(nip, nama) { return statusFilter === "semua" || statusOf(nip, nama) === statusFilter; }

  /* ---------- LAYAR A: Jurnal Harian ---------- */
  function jurnalHariIniRows() {
    var hi = hariIniStr();
    return jurnalRows.filter(function (r) { return tgl(cari(r, ["Tanggal", "Timestamp"])) === hi; });
  }
  function renderJurnal() {
    $("dash-tanggal").textContent = fmtTglPanjang(hariIniStr());
    var hi = hariIniStr();
    var pegFilter = pegawai.filter(function (p) { return lolosStatus(p.nip, p.nama); });

    // Kunci pegawai yang sudah isi jurnal hari ini
    var isiHariIni = {};
    var barisHari = jurnalHariIniRows().filter(function (r) { return lolosStatus(cari(r, ["NIP/ID"]), cari(r, ["Nama"])); });
    barisHari.forEach(function (r) { isiHariIni[keyOf(cari(r, ["NIP/ID"]), cari(r, ["Nama"]))] = true; });

    var berfoto = barisHari.filter(function (r) { return String(cari(r, ["Foto"]) || "").trim() !== ""; }).length;
    var belum = pegFilter.filter(function (p) { return !isiHariIni[keyOf(p.nip, p.nama)]; });

    $("jk-total").textContent = pegFilter.length;
    $("jk-hariini").textContent = barisHari.length;
    $("jk-foto").textContent = berfoto;
    $("jk-belum").textContent = belum.length;

    // Tabel jurnal hari ini (filter foto)
    var tampil = barisHari.filter(function (r) {
      var adaFoto = String(cari(r, ["Foto"]) || "").trim() !== "";
      return jfFilter === "semua" || (jfFilter === "foto" && adaFoto) || (jfFilter === "tanpa" && !adaFoto);
    });
    tampil.sort(function (a, b) { return String(cari(b, ["Jam"])).localeCompare(String(cari(a, ["Jam"]))); });
    $("j-info").textContent = tampil.length ? ("Menampilkan " + tampil.length + " jurnal.") : "Belum ada jurnal untuk filter ini.";
    $("j-body").innerHTML = tampil.length ? tampil.map(function (r) {
      var v = cari(r, ["Foto"]);
      var foto = v ? String(v).split(/[\n\r]+/).filter(Boolean).map(function (u, i) { return link(u, "Lihat" + (i > 0 ? " " + (i + 1) : "")); }).join(" ") : "-";
      return "<tr><td>" + esc(tgl(cari(r, ["Tanggal", "Timestamp"]))) + "</td><td>" + esc(cari(r, ["Jam"])) +
        "</td><td>" + esc(cari(r, ["Nama"])) + "</td><td>" + badgeStatus(statusOf(cari(r, ["NIP/ID"]), cari(r, ["Nama"]))) +
        "</td><td>" + esc(cari(r, ["Kegiatan"])) + "</td><td>" + foto + "</td><td>" + link(cari(r, ["Link Lokasi"]), "Peta") + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="kosong-baris" style="text-align:center;color:var(--muted);padding:14px;">Tidak ada data.</td></tr>';

    // Panel: Belum mengisi (dengan jam absen masuk bila ada)
    var masukHariIni = {}; // key -> jam masuk paling awal
    absRows.map(normAbsen).forEach(function (o) {
      if (o.tanggal !== hi || !/masuk/i.test(o.jenis)) return;
      var k = keyOf(o.nip, o.nama);
      if (!masukHariIni[k] || o.jam < masukHariIni[k]) masukHariIni[k] = o.jam;
    });
    $("panel-belum").className = "";
    $("panel-belum").innerHTML = belum.length ? '<ul class="dash-list">' + belum.map(function (p) {
      var jm = masukHariIni[keyOf(p.nip, p.nama)];
      var ket = jm ? "absen masuk " + jm : "belum absen";
      return '<li><span>' + esc(p.nama) + " " + badgeStatus(p.status) + '</span><span class="small muted">' + ket + "</span></li>";
    }).join("") + "</ul>" : '<div class="status ok">Semua pegawai sudah mengisi jurnal hari ini. 🎉</div>';

    // Panel: Terkumpul bulan ini (jurnal per pegawai / hari kerja)
    var bln = bulanIni();
    var hk = hariKerjaBulan(bln); var totalHK = hk ? Object.keys(hk).length : 0;
    var hitung = {};
    jurnalRows.forEach(function (r) {
      var t = tgl(cari(r, ["Tanggal", "Timestamp"])); if (t.indexOf(bln) !== 0) return;
      var k = keyOf(cari(r, ["NIP/ID"]), cari(r, ["Nama"]));
      hitung[k] = (hitung[k] || 0) + 1;
    });
    var listT = pegFilter.map(function (p) { return { nama: p.nama, status: p.status, n: hitung[keyOf(p.nip, p.nama)] || 0 }; })
      .sort(function (a, b) { return b.n - a.n; });
    $("panel-terkumpul").className = "";
    $("panel-terkumpul").innerHTML = listT.length ? '<ul class="dash-list">' + listT.map(function (x) {
      var persen = totalHK ? Math.min(100, Math.round(x.n / totalHK * 100)) : 0;
      return '<li style="display:block;">' +
        '<div style="display:flex;justify-content:space-between;"><span>' + esc(x.nama) + " " + badgeStatus(x.status) + '</span><span class="small muted">' + x.n + (totalHK ? " / " + totalHK : "") + '</span></div>' +
        '<div style="height:7px;background:#eef2f7;border-radius:6px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:' + persen + '%;background:var(--primary,#2563eb);"></div></div></li>';
    }).join("") + "</ul>" : '<div class="dash-kosong">Belum ada data.</div>';
  }

  /* ---------- hari kerja (dari rekap.js) ---------- */
  function hariKerjaBulan(bulan) {
    if (!bulan) return null;
    var y = parseInt(bulan.substring(0, 4), 10), m = parseInt(bulan.substring(5, 7), 10);
    var akhir = new Date(y, m, 0).getDate(), hi = hariIniStr(), set = {};
    for (var d = 1; d <= akhir; d++) {
      var dow = new Date(y, m - 1, d).getDay(); if (dow === 0 || dow === 6) continue;
      var s = y + "-" + pad(m) + "-" + pad(d); if (s > hi) continue;
      set[s] = true;
    }
    return set;
  }
  function rentangHariKerja(mulai, selesai, hk) {
    var hasil = [], a = parseTgl(mulai), b = parseTgl(selesai || mulai);
    if (!a) return hasil; if (!b || b < a) b = a;
    for (var t = new Date(a); t <= b; t.setDate(t.getDate() + 1)) {
      var s = t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
      if (hk) { if (hk[s]) hasil.push(s); }
      else { var dow = t.getDay(); if (dow !== 0 && dow !== 6) hasil.push(s); }
    }
    return hasil;
  }
  function dalamBulan(t) { var b = $("f-bulan").value; return !b || (t || "").indexOf(b) === 0; }

  /* ---------- LAYAR B: Rekap Bulanan ---------- */
  var KOLOM = {
    absensi: [
      { judul: "Tanggal", get: function (o) { return o.tanggal; } },
      { judul: "Jam", get: function (o) { return o.jam; } },
      { judul: "Nama", get: function (o) { return o.nama || o.deviceId; } },
      { judul: "Status", html: true, get: function (o) { return badgeStatus(statusOf(o.nip, o.nama)); }, raw: function (o) { return statusOf(o.nip, o.nama); } },
      { judul: "Jenis", html: true, get: function (o) { return badge(o.jenis); }, raw: function (o) { return o.jenis; } },
      { judul: "Terlambat (mnt)", html: true, get: function (o) { return angkaWarna(o.terlambat, "mnt-bad"); }, raw: function (o) { return o.terlambat; } },
      { judul: "Pulang Cepat (mnt)", html: true, get: function (o) { return angkaWarna(o.cepat, "mnt-warn"); }, raw: function (o) { return o.cepat; } },
      { judul: "Lokasi", html: true, get: function (o) { return link(o.link, "Peta"); }, raw: function (o) { return o.link; } },
      { judul: "Keterangan", get: function (o) { return o.ket; } }
    ],
    izin: [
      { judul: "Tanggal", get: function (o) { return o.tanggal; } },
      { judul: "Nama", get: function (o) { return o.nama; } },
      { judul: "Status", html: true, get: function (o) { return badgeStatus(statusOf(o.nip, o.nama)); }, raw: function (o) { return statusOf(o.nip, o.nama); } },
      { judul: "Jenis", html: true, get: function (o) { return badge(o.jenis); }, raw: function (o) { return o.jenis; } },
      { judul: "Mulai", get: function (o) { return o.mulai; } },
      { judul: "Selesai", get: function (o) { return o.selesai; } },
      { judul: "Alasan", get: function (o) { return o.alasan; } },
      { judul: "Surat", html: true, get: function (o) { return link(o.link, "Lihat"); }, raw: function (o) { return o.link; } }
    ]
  };
  var RINGKASAN_KOL = [
    { judul: "Nama", get: function (s) { return s.nama; } },
    { judul: "Status", html: true, get: function (s) { return badgeStatus(s.status); }, raw: function (s) { return s.status; } },
    { judul: "Hadir (hari)", get: function (s) { return s.hadir; } },
    { judul: "Terlambat (×)", get: function (s) { return s.tlKali; } },
    { judul: "Total Terlambat", html: true, get: function (s) { return s.tlMenit > 0 ? '<span class="mnt-bad">' + jamMenit(s.tlMenit) + "</span>" : '<span class="mnt-ok">0</span>'; }, raw: function (s) { return s.tlMenit; } },
    { judul: "Pulang Cepat (×)", get: function (s) { return s.pcKali; } },
    { judul: "Total Pulang Cepat", html: true, get: function (s) { return s.pcMenit > 0 ? '<span class="mnt-warn">' + jamMenit(s.pcMenit) + "</span>" : '<span class="mnt-ok">0</span>'; }, raw: function (s) { return s.pcMenit; } },
    { judul: "Sakit (hari)", get: function (s) { return s.sakit; } },
    { judul: "Izin (hari)", get: function (s) { return s.izin; } },
    { judul: "Cuti (hari)", get: function (s) { return s.cuti; } },
    { judul: "Mangkir/Alpa", html: true, get: function (s) { return s.mangkir == null ? "-" : (s.mangkir > 0 ? '<span class="mnt-bad">' + s.mangkir + "</span>" : '<span class="mnt-ok">0</span>'); }, raw: function (s) { return s.mangkir == null ? "" : s.mangkir; } }
  ];

  function ringkasan() {
    var hkSet = hariKerjaBulan($("f-bulan").value);
    var peta = {};
    function ambil(key, nama, nip) {
      if (!peta[key]) peta[key] = { nama: nama || key, nip: nip || "", status: statusOf(nip, nama), hadirSet: {}, tlKali: 0, tlMenit: 0, pcKali: 0, pcMenit: 0, sakitSet: {}, izinSet: {}, cutiSet: {} };
      if (nama && (peta[key].nama === key || !peta[key].nama)) peta[key].nama = nama;
      return peta[key];
    }
    var hari = {};
    absRows.map(normAbsen).forEach(function (o) {
      if (!dalamBulan(o.tanggal) || !o.tanggal) return;
      if (!lolosStatus(o.nip, o.nama)) return;
      var key = o.nip || o.nama || o.deviceId; if (!key) return;
      var hk = key + "|" + o.tanggal;
      if (!hari[hk]) hari[hk] = { key: key, nama: o.nama, nip: o.nip, tanggal: o.tanggal, masuk: null, pulang: null };
      var d = hari[hk];
      if (o.nama && !d.nama) d.nama = o.nama;
      if (/masuk/i.test(o.jenis)) { if (!d.masuk || o.waktu < d.masuk.waktu) d.masuk = o; }
      else if (/pulang/i.test(o.jenis)) { if (!d.pulang || o.waktu > d.pulang.waktu) d.pulang = o; }
    });
    Object.keys(hari).forEach(function (hk) {
      var d = hari[hk], s = ambil(d.key, d.nama, d.nip);
      if (d.masuk) { s.hadirSet[d.tanggal] = true; if (d.masuk.terlambat > 0) { s.tlKali++; s.tlMenit += d.masuk.terlambat; } }
      if (d.pulang && d.pulang.cepat > 0) { s.pcKali++; s.pcMenit += d.pulang.cepat; }
    });
    izinRows.map(normIzin).forEach(function (o) {
      if (!lolosStatus(o.nip, o.nama)) return;
      var key = o.nip || o.nama; if (!key) return;
      var s = ambil(key, o.nama, o.nip);
      var target = /sakit/i.test(o.jenis) ? s.sakitSet : /izin/i.test(o.jenis) ? s.izinSet : /cuti/i.test(o.jenis) ? s.cutiSet : null;
      if (!target) return;
      rentangHariKerja(o.mulai || o.tanggal, o.selesai || o.mulai || o.tanggal, hkSet).forEach(function (d) { target[d] = true; });
    });
    var totalHK = hkSet ? Object.keys(hkSet) : null;
    var baris = Object.keys(peta).map(function (k) {
      var s = peta[k], tertutup = {};
      [s.hadirSet, s.sakitSet, s.izinSet, s.cutiSet].forEach(function (set) { Object.keys(set).forEach(function (d) { tertutup[d] = true; }); });
      var mangkir = null;
      if (totalHK) { mangkir = 0; totalHK.forEach(function (d) { if (!tertutup[d]) mangkir++; }); }
      return { nama: s.nama, status: s.status, hadir: Object.keys(s.hadirSet).length, tlKali: s.tlKali, tlMenit: s.tlMenit, pcKali: s.pcKali, pcMenit: s.pcMenit, sakit: Object.keys(s.sakitSet).length, izin: Object.keys(s.izinSet).length, cuti: Object.keys(s.cutiSet).length, mangkir: mangkir };
    });
    baris.sort(function (a, b) { return (b.tlMenit - a.tlMenit) || ((b.mangkir || 0) - (a.mangkir || 0)) || a.nama.localeCompare(b.nama); });
    return baris;
  }

  function dataDetail() {
    if (mode === "absensi") return absRows.map(normAbsen).filter(function (o) { return dalamBulan(o.tanggal) && lolosStatus(o.nip, o.nama); });
    return izinRows.map(normIzin).filter(function (o) { return dalamBulan(o.tanggal || o.mulai) && lolosStatus(o.nip, o.nama); });
  }

  function renderTabel(kolom, data, kosong) {
    $("thead-row").innerHTML = kolom.map(function (k) { return "<th>" + k.judul + "</th>"; }).join("");
    if (!data.length) { $("tbody").innerHTML = ""; $("info").textContent = kosong; $("info").className = "status muted"; return; }
    $("tbody").innerHTML = data.map(function (row) {
      return "<tr>" + kolom.map(function (k) { var isi = k.get(row); return k.html ? "<td>" + isi + "</td>" : "<td>" + esc(isi) + "</td>"; }).join("") + "</tr>";
    }).join("");
  }

  function renderRekap() {
    $("rekap-tanggal").textContent = "Bulan: " + (function () { var b = $("f-bulan").value; if (!b) return "semua"; return BULAN[parseInt(b.substring(5, 7), 10) - 1] + " " + b.substring(0, 4); })();
    if (mode === "ringkasan") {
      var baris = ringkasan();
      $("info").textContent = baris.length ? ("Ringkasan " + baris.length + " pegawai.") : "Tidak ada data untuk bulan ini.";
      $("info").className = "status muted";
      renderTabel(RINGKASAN_KOL, baris, "Tidak ada data untuk bulan ini.");
    } else {
      var data = dataDetail();
      $("info").textContent = data.length ? ("Menampilkan " + data.length + " baris.") : "Tidak ada data untuk filter ini.";
      $("info").className = "status muted";
      renderTabel(KOLOM[mode], data, "Tidak ada data untuk filter ini.");
    }
    renderPanelRekap();
  }

  function renderPanelRekap() {
    var bln = $("f-bulan").value;
    // Kepatuhan jurnal per minggu (M1..M5)
    var mingguan = [0, 0, 0, 0, 0];
    jurnalRows.forEach(function (r) {
      var t = tgl(cari(r, ["Tanggal", "Timestamp"]));
      if (bln && t.indexOf(bln) !== 0) return;
      if (!lolosStatus(cari(r, ["NIP/ID"]), cari(r, ["Nama"]))) return;
      var d = parseInt(t.substring(8, 10), 10); if (!d) return;
      var idx = Math.min(4, Math.floor((d - 1) / 7));
      mingguan[idx]++;
    });
    var maks = Math.max.apply(null, mingguan.concat([1]));
    $("panel-minggu").className = "";
    $("panel-minggu").innerHTML = '<ul class="dash-list">' + mingguan.map(function (n, i) {
      var persen = Math.round(n / maks * 100);
      return '<li style="display:block;">' +
        '<div style="display:flex;justify-content:space-between;"><span>Minggu ' + (i + 1) + '</span><span class="small muted">' + n + ' jurnal</span></div>' +
        '<div style="height:7px;background:#eef2f7;border-radius:6px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:' + persen + '%;background:var(--success,#15803d);"></div></div></li>';
    }).join("") + "</ul>";

    // Perlu perhatian: mangkir > 0
    var perhatian = ringkasan().filter(function (s) { return s.mangkir != null && s.mangkir > 0; });
    $("panel-perhatian").className = "";
    $("panel-perhatian").innerHTML = perhatian.length ? '<ul class="dash-list">' + perhatian.map(function (s) {
      return '<li><span>' + esc(s.nama) + " " + badgeStatus(s.status) + '</span><span class="small"><span class="mnt-bad">' + s.mangkir + " mangkir</span>" +
        (s.tlKali ? ' · <span class="mnt-warn">' + s.tlKali + "× telat</span>" : "") + (s.pcKali ? " · " + s.pcKali + "× plg cepat" : "") + "</span></li>";
    }).join("") + "</ul>" : '<div class="status ok">Tidak ada pegawai dengan mangkir/alpa. 👍</div>';
  }

  /* ---------- ekspor CSV (dari rekap.js) ---------- */
  function eksporCSV() {
    var kolom, data, namaFile;
    if (mode === "ringkasan") { kolom = RINGKASAN_KOL; data = ringkasan(); namaFile = "ringkasan"; }
    else { kolom = KOLOM[mode]; data = dataDetail(); namaFile = mode; }
    if (!data.length) { alert("Tidak ada data untuk diekspor."); return; }
    var bulan = $("f-bulan").value || "semua";
    var header = kolom.map(function (k) { return k.judul; });
    var baris = data.map(function (row) { return kolom.map(function (k) { return k.raw ? k.raw(row) : String(k.get(row)).replace(/<[^>]*>/g, ""); }); });
    var csv = [header].concat(baris).map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = "rekap-" + namaFile + "-" + bulan + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- muat semua data ---------- */
  function muatSemua() {
    $("j-info").textContent = "Memuat data..."; $("info").textContent = "Memuat data...";
    var pw = sessionStorage.getItem("pjlp_admin_pw") || "";
    var em = sessionStorage.getItem("pjlp_admin_email") || "";
    Promise.all([
      API.post({ action: "rekapAbsensi", adminPassword: pw }),
      API.post({ action: "rekapJurnal", adminPassword: pw }),
      API.post({ action: "rekapIzin", adminPassword: pw }),
      API.post({ action: "adminData", email: em, password: pw, deviceId: "" })
    ]).then(function (r) {
      absRows = (r[0] && r[0].data) || [];
      jurnalRows = (r[1] && r[1].data) || [];
      izinRows = (r[2] && r[2].data) || [];
      // Peta status dari perangkat (disetujui, bukan PPK); PPPK -> "PPPK", lain -> "PJLP".
      petaNip = {}; petaNama = {}; pegawai = []; var terlihat = {};
      var perangkat = (r[3] && r[3].perangkat) || [];
      perangkat.forEach(function (d) {
        if (d.role === "PPK") return;
        var st = (d.jenis && String(d.jenis).indexOf("PPPK") === 0) ? "PPPK" : "PJLP";
        if (d.nip) petaNip[String(d.nip).trim()] = st;
        if (d.nama) petaNama[String(d.nama).trim().toLowerCase()] = st;
        if (d.status !== "disetujui") return;
        var k = keyOf(d.nip, d.nama); if (terlihat[k]) return; terlihat[k] = true;
        pegawai.push({ nama: d.nama, nip: d.nip, status: st });
      });
      renderJurnal();
      renderRekap();
    }).catch(function (err) { $("j-info").textContent = "Gagal memuat: " + err.message; $("info").textContent = "Gagal memuat: " + err.message; });
  }

  /* ---------- navigasi & events ---------- */
  document.querySelectorAll(".admin-nav .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".admin-nav .tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif");
      var d = t.getAttribute("data-dash");
      $("dash-jurnal").classList.toggle("hidden", d !== "jurnal");
      $("dash-rekap").classList.toggle("hidden", d !== "rekap");
    });
  });
  document.querySelectorAll("#j-foto-tabs .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll("#j-foto-tabs .tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif"); jfFilter = t.getAttribute("data-jf"); renderJurnal();
    });
  });
  document.querySelectorAll("#status-tabs .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll("#status-tabs .tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif"); statusFilter = t.getAttribute("data-status"); renderJurnal(); renderRekap();
    });
  });
  document.querySelectorAll("#mode-tabs .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll("#mode-tabs .tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif"); mode = t.getAttribute("data-mode"); renderRekap();
    });
  });
  $("f-bulan").addEventListener("change", function () { renderRekap(); });
  $("btn-refresh").addEventListener("click", muatSemua);
  $("btn-ekspor").addEventListener("click", eksporCSV);
  $("j-refresh").addEventListener("click", muatSemua);

  /* ---------- login ---------- */
  var LABEL = { ppk: "👑 PPK", operator: "🛠️ Operator", kepegawaian: "🗂️ Kepegawaian", wadir2: "👁️ Wadir II", bau: "👁️ BAU", direktur: "👁️ Direktur" };
  function masuk(role) {
    $("badge-role").textContent = LABEL[role] || ("👁️ " + role);
    $("seksi-login").classList.add("hidden");
    $("seksi-dashboard").classList.remove("hidden");
    $("f-bulan").value = bulanIni();
    muatSemua();
  }
  $("form-login").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var em = $("l-email").value.trim(), pw = $("password").value;
    var btn = $("btn-login"); btn.disabled = true; btn.textContent = "Memeriksa...";
    $("login-pesan").textContent = "";
    API.post({ action: "adminLogin", email: em, password: pw, deviceId: "" }).then(function (res) {
      if (res.status === "success") {
        sessionStorage.setItem("pjlp_admin_pw", pw); sessionStorage.setItem("pjlp_admin_email", em); sessionStorage.setItem("pjlp_role", res.role || "");
        masuk(res.role || "");
      } else { $("login-pesan").textContent = res.message || "Login gagal."; }
    }).catch(function (err) { $("login-pesan").textContent = "Gagal: " + err.message; })
      .finally(function () { btn.disabled = false; btn.textContent = "Masuk"; });
  });
  var linkKeluar = $("link-keluar");
  if (linkKeluar) linkKeluar.addEventListener("click", function (ev) {
    ev.preventDefault();
    sessionStorage.removeItem("pjlp_admin_pw"); sessionStorage.removeItem("pjlp_admin_email"); sessionStorage.removeItem("pjlp_role");
    $("seksi-dashboard").classList.add("hidden"); $("seksi-login").classList.remove("hidden");
    $("login-pesan").textContent = "Sesi berakhir, masuk lagi.";
  });

  /* ---------- init ---------- */
  if (typeof API === "undefined" || API.belumDikonfigurasi()) {
    $("login-pesan").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL).";
  } else if (sessionStorage.getItem("pjlp_admin_pw")) {
    // Sudah login (mis. datang dari Panel Admin) — langsung tampilkan.
    masuk(sessionStorage.getItem("pjlp_role") || "");
  }
})();
