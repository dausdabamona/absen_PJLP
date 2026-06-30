/* ============================================================
   Rekap (rekap.html) — terbuka untuk semua. Tanpa password hanya
   menampilkan absen perangkat ini. Admin isi password untuk semua.

   Catatan: data dinormalisasi berdasarkan ISI tiap sel (bukan label
   header), sehingga kolom tetap benar walau header Sheet bergeser.
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const info = $("info"), theadRow = $("thead-row"), tbody = $("tbody");

  let mode = "ringkasan";
  let absRows = [], izinRows = [], jurnalRows = [];

  /* ---------- util ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function tgl(v) { return v ? String(v).substring(0, 10) : ""; }
  function link(url, teks) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + teks + "</a>" : "-"; }
  function nilaiBaris(row) { var o = []; for (var k in row) { if (Object.prototype.hasOwnProperty.call(row, k)) o.push(row[k]); } return o; }
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

  /* ---------- normalisasi berbasis isi ---------- */
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
        if (tm) { if (!o.jam) o.jam = tm[1]; if (!o.waktu) o.waktu = s; } // timestamp lengkap (ada jam) utk urutkan
        return;
      }
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) { if (!o.jam) o.jam = s; return; }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(s)) { if (!o.deviceId) o.deviceId = s; return; }
      if (/^[-+]?\d{1,3}\.\d+$/.test(s)) return; // koordinat lat/lng
      if (/^\d{4,}$/.test(s)) { if (!o.nip) o.nip = s; return; }      // NIP
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

  /* ---------- kolom tabel detail ---------- */
  const KOLOM = {
    absensi: [
      { judul: "Tanggal", get: function (o) { return o.tanggal; } },
      { judul: "Jam", get: function (o) { return o.jam; } },
      { judul: "Nama", get: function (o) { return o.nama || o.deviceId; } },
      { judul: "Jenis", html: true, get: function (o) { return badge(o.jenis); }, raw: function (o) { return o.jenis; } },
      { judul: "Terlambat (mnt)", html: true, get: function (o) { return angkaWarna(o.terlambat, "mnt-bad"); }, raw: function (o) { return o.terlambat; } },
      { judul: "Pulang Cepat (mnt)", html: true, get: function (o) { return angkaWarna(o.cepat, "mnt-warn"); }, raw: function (o) { return o.cepat; } },
      { judul: "Lokasi", html: true, get: function (o) { return link(o.link, "Peta"); }, raw: function (o) { return o.link; } },
      { judul: "Keterangan", get: function (o) { return o.ket; } }
    ],
    izin: [
      { judul: "Tanggal", get: function (o) { return o.tanggal; } },
      { judul: "Nama", get: function (o) { return o.nama; } },
      { judul: "Jenis", html: true, get: function (o) { return badge(o.jenis); }, raw: function (o) { return o.jenis; } },
      { judul: "Mulai", get: function (o) { return o.mulai; } },
      { judul: "Selesai", get: function (o) { return o.selesai; } },
      { judul: "Alasan", get: function (o) { return o.alasan; } },
      { judul: "Surat", html: true, get: function (o) { return link(o.link, "Lihat"); }, raw: function (o) { return o.link; } }
    ],
    jurnal: [
      { judul: "Tanggal", get: function (r) { return tgl(cari(r, ["Tanggal", "Timestamp"])); } },
      { judul: "Jam", get: function (r) { return cari(r, ["Jam"]); } },
      { judul: "Nama", get: function (r) { return cari(r, ["Nama"]); } },
      { judul: "Kegiatan", get: function (r) { return cari(r, ["Kegiatan"]); } },
      { judul: "Foto", html: true, get: function (r) { return link(cari(r, ["Foto"]), "Lihat"); }, raw: function (r) { return cari(r, ["Foto"]); } },
      { judul: "Lokasi", html: true, get: function (r) { return link(cari(r, ["Link Lokasi"]), "Peta"); }, raw: function (r) { return cari(r, ["Link Lokasi"]); } }
    ]
  };
  function cari(row, kandidat) { for (var i = 0; i < kandidat.length; i++) { var k = kandidat[i]; if (row[k] !== undefined && row[k] !== "") return String(row[k]); } return ""; }

  const RINGKASAN_KOL = [
    { judul: "Nama", get: function (s) { return s.nama; } },
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

  /* ---------- filter bulan ---------- */
  function bulanIni() {
    const n = new Date();
    const lokal = new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000);
    const m = lokal.getMonth() + 1;
    return lokal.getFullYear() + "-" + (m < 10 ? "0" + m : m);
  }
  function dalamBulan(t) { var b = $("f-bulan").value; return !b || (t || "").indexOf(b) === 0; }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function hariIniStr() { var n = new Date(); var l = new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); return l.getFullYear() + "-" + pad(l.getMonth() + 1) + "-" + pad(l.getDate()); }
  function jamMenit(m) { m = parseInt(m, 10) || 0; if (m <= 0) return "0"; var j = Math.floor(m / 60), s = m % 60, o = []; if (j) o.push(j + " jam"); if (s) o.push(s + " mnt"); return o.join(" "); }
  function parseTgl(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)) : null; }

  // Himpunan hari kerja (Sen–Jum, tidak melebihi hari ini) untuk bulan terpilih
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
  // Daftar tanggal hari kerja dalam rentang [mulai..selesai] yang termasuk himpunan hk
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

  /* ---------- data terfilter per mode ---------- */
  function dataDetail() {
    if (mode === "absensi") return absRows.map(normAbsen).filter(function (o) { return dalamBulan(o.tanggal); });
    if (mode === "izin") return izinRows.map(normIzin).filter(function (o) { return dalamBulan(o.tanggal || o.mulai); });
    return jurnalRows.filter(function (r) { return dalamBulan(tgl(cari(r, ["Timestamp", "Tanggal"]))); });
  }

  function ringkasan() {
    var hk = hariKerjaBulan($("f-bulan").value); // null jika "semua bulan"
    var peta = {};
    function ambil(key, nama) {
      if (!peta[key]) peta[key] = { nama: nama || key, hadirSet: {}, tlKali: 0, tlMenit: 0, pcKali: 0, pcMenit: 0, sakitSet: {}, izinSet: {}, cutiSet: {} };
      if (nama && (peta[key].nama === key || !peta[key].nama)) peta[key].nama = nama;
      return peta[key];
    }
    // Kelompokkan per (pegawai, hari): Masuk pertama untuk telat, Pulang terakhir untuk cepat
    var hari = {}; // "key|tanggal" -> { key, nama, tanggal, masuk, pulang }
    absRows.map(normAbsen).forEach(function (o) {
      if (!dalamBulan(o.tanggal) || !o.tanggal) return;
      var key = o.nip || o.nama || o.deviceId; if (!key) return;
      var hk = key + "|" + o.tanggal;
      if (!hari[hk]) hari[hk] = { key: key, nama: o.nama, tanggal: o.tanggal, masuk: null, pulang: null };
      var d = hari[hk];
      if (o.nama && !d.nama) d.nama = o.nama;
      if (/masuk/i.test(o.jenis)) { if (!d.masuk || o.waktu < d.masuk.waktu) d.masuk = o; }       // paling AWAL
      else if (/pulang/i.test(o.jenis)) { if (!d.pulang || o.waktu > d.pulang.waktu) d.pulang = o; } // paling AKHIR
    });
    Object.keys(hari).forEach(function (hk) {
      var d = hari[hk], s = ambil(d.key, d.nama);
      if (d.masuk) {
        s.hadirSet[d.tanggal] = true;
        if (d.masuk.terlambat > 0) { s.tlKali++; s.tlMenit += d.masuk.terlambat; }
      }
      if (d.pulang && d.pulang.cepat > 0) { s.pcKali++; s.pcMenit += d.pulang.cepat; }
    });
    izinRows.map(normIzin).forEach(function (o) {
      var key = o.nip || o.nama; if (!key) return;
      var s = ambil(key, o.nama);
      var target = /sakit/i.test(o.jenis) ? s.sakitSet : /izin/i.test(o.jenis) ? s.izinSet : /cuti/i.test(o.jenis) ? s.cutiSet : null;
      if (!target) return;
      rentangHariKerja(o.mulai || o.tanggal, o.selesai || o.mulai || o.tanggal, hk).forEach(function (d) { target[d] = true; });
    });
    var totalHK = hk ? Object.keys(hk) : null;
    var baris = Object.keys(peta).map(function (k) {
      var s = peta[k];
      var tertutup = {};
      [s.hadirSet, s.sakitSet, s.izinSet, s.cutiSet].forEach(function (set) { Object.keys(set).forEach(function (d) { tertutup[d] = true; }); });
      var mangkir = null;
      if (totalHK) { mangkir = 0; totalHK.forEach(function (d) { if (!tertutup[d]) mangkir++; }); }
      return {
        nama: s.nama, hadir: Object.keys(s.hadirSet).length,
        tlKali: s.tlKali, tlMenit: s.tlMenit, pcKali: s.pcKali, pcMenit: s.pcMenit,
        sakit: Object.keys(s.sakitSet).length, izin: Object.keys(s.izinSet).length, cuti: Object.keys(s.cutiSet).length,
        mangkir: mangkir
      };
    });
    baris.sort(function (a, b) { return (b.tlMenit - a.tlMenit) || ((b.mangkir || 0) - (a.mangkir || 0)) || a.nama.localeCompare(b.nama); });
    return baris;
  }

  /* ---------- render ---------- */
  function renderTabel(kolom, data, kosong) {
    theadRow.innerHTML = kolom.map(function (k) { return "<th>" + k.judul + "</th>"; }).join("");
    if (!data.length) { tbody.innerHTML = ""; info.textContent = kosong; info.className = "status muted"; return; }
    tbody.innerHTML = data.map(function (row) {
      return "<tr>" + kolom.map(function (k) {
        var isi = k.get(row);
        return k.html ? "<td>" + isi + "</td>" : "<td>" + esc(isi) + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }

  function tampilkan() {
    if (mode === "ringkasan") {
      var baris = ringkasan();
      info.textContent = baris.length ? ("Ringkasan " + baris.length + " pegawai." ) : "Tidak ada data untuk bulan ini.";
      info.className = "status muted";
      renderTabel(RINGKASAN_KOL, baris, "Tidak ada data untuk bulan ini.");
      return;
    }
    var data = dataDetail();
    info.textContent = data.length ? ("Menampilkan " + data.length + " baris.") : "Tidak ada data untuk filter ini.";
    info.className = "status muted";
    renderTabel(KOLOM[mode], data, "Tidak ada data untuk filter ini.");
  }

  /* ---------- muat data ---------- */
  function muatData() {
    if (API.belumDikonfigurasi()) { info.textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL)."; info.className = "status err"; return; }
    info.textContent = "Memuat data..."; info.className = "status muted";
    var pw = $("f-admin").value;
    var perlu = (mode === "ringkasan") ? ["rekapAbsensi", "rekapIzin"] : [ACTION_TUNGGAL[mode]];
    Promise.all(perlu.map(function (act) { return API.post({ action: act, adminPassword: pw }); }))
      .then(function (hasil) {
        var adminAda = hasil.some(function (r) { return r && r.isAdmin; });
        $("badge-admin").classList.toggle("hidden", !adminAda);
        hasil.forEach(function (r, i) {
          if (!r || r.status !== "success") return;
          var act = perlu[i];
          if (act === "rekapAbsensi") absRows = r.data || [];
          else if (act === "rekapIzin") izinRows = r.data || [];
          else if (act === "rekapJurnal") jurnalRows = r.data || [];
        });
        tampilkan();
      })
      .catch(function (err) { info.textContent = "Gagal memuat data: " + err.message; info.className = "status err"; });
  }
  const ACTION_TUNGGAL = { absensi: "rekapAbsensi", jurnal: "rekapJurnal", izin: "rekapIzin" };

  /* ---------- ekspor CSV ---------- */
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

  /* ---------- events ---------- */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif"); mode = t.getAttribute("data-mode"); muatData();
    });
  });
  $("btn-refresh").addEventListener("click", muatData);
  $("btn-ekspor").addEventListener("click", eksporCSV);
  $("f-bulan").addEventListener("change", tampilkan);
  $("f-admin").addEventListener("change", muatData);

  $("f-bulan").value = bulanIni();
  muatData();
})();
