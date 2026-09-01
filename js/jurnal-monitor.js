/* ============================================================
   Monitoring Jurnal Harian (jurnal-monitor.html)
   Dashboard khusus pemantauan jurnal untuk PPK, Operator,
   Kepegawaian, Wadir II, BAU, Direktur. Read-only.
   Dibuka lewat Panel Admin (butuh sesi login: pjlp_admin_pw).
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function lokal() { var n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); }
  function bulanIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function hariIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function tgl10(v) { return v ? String(v).substring(0, 10) : ""; }
  function fmtTanggal(ymd) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ""); return p ? (parseInt(p[3], 10) + " " + BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : "-"; }
  function jam5(v) { var p = /(\d{1,2}):(\d{2})/.exec(v || ""); return p ? (pad(parseInt(p[1], 10)) + ":" + p[2]) : (v || ""); }
  function linkFoto(v) {
    if (!v) return "-";
    var urls = String(v).split(/[\n\r]+/).filter(Boolean);
    if (!urls.length) return "-";
    return '<span class="jm-detail-foto">' + urls.map(function (u, i) {
      return '<a href="' + esc(u) + '" target="_blank" rel="noopener">Foto' + (urls.length > 1 ? " " + (i + 1) : "") + "</a>";
    }).join(" ") + "</span>";
  }

  var pegawai = [];   // { nama, nip, jenis }
  var jurnal = [];    // { nama, nip, tanggal, jam, kegiatan, foto, lokasi }
  var pilihNip = "";  // filter detail ke 1 pegawai (klik baris)

  function keyNip(nip, nama) { return nip && String(nip).trim() ? "nip:" + String(nip).trim() : "nama:" + String(nama || "").trim().toLowerCase(); }

  function render() {
    var bln = $("jm-bulan").value || bulanIni();
    var cari = $("jm-cari").value.trim().toLowerCase();
    var hi = hariIni();

    // Entri jurnal bulan terpilih
    var entriBulan = jurnal.filter(function (j) { return tgl10(j.tanggal).indexOf(bln) === 0; });

    // Statistik per pegawai
    var stat = {}; // key -> { entriBulan, terakhir, hariIni }
    jurnal.forEach(function (j) {
      var k = keyNip(j.nip, j.nama);
      if (!stat[k]) stat[k] = { entriBulan: 0, terakhir: "", hariIni: false };
      var t = tgl10(j.tanggal);
      if (t > stat[k].terakhir) stat[k].terakhir = t;
      if (t === hi) stat[k].hariIni = true;
      if (t.indexOf(bln) === 0) stat[k].entriBulan++;
    });

    var daftar = pegawai.filter(function (p) {
      if (!cari) return true;
      return (p.nama || "").toLowerCase().indexOf(cari) !== -1 || String(p.nip || "").toLowerCase().indexOf(cari) !== -1;
    });

    var sudahHariIni = 0;
    var rows = daftar.map(function (p) {
      var k = keyNip(p.nip, p.nama);
      var s = stat[k] || { entriBulan: 0, terakhir: "", hariIni: false };
      if (s.hariIni) sudahHariIni++;
      var jenisBadge = (p.jenis && p.jenis !== "PJLP") ? ' <span class="pill pill-jenis">' + esc(p.jenis) + "</span>" : "";
      var status = s.hariIni ? '<span class="pill pill-ok">✓ Sudah</span>' : '<span class="pill pill-no">Belum</span>';
      var terpilih = pilihNip === k ? ' style="background:#eef2ff;"' : "";
      return '<tr class="klik" data-key="' + esc(k) + '"' + terpilih + '><td>' + esc(p.nama) + jenisBadge +
        '</td><td class="mono small">' + esc(p.nip || "-") + '</td><td style="text-align:center;">' + s.entriBulan +
        '</td><td>' + (s.terakhir ? fmtTanggal(s.terakhir) : "-") + '</td><td style="text-align:center;">' + status + "</td></tr>";
    }).join("");
    $("jm-body-pegawai").innerHTML = rows || '<tr><td colspan="5" class="kosong">Tidak ada pegawai.</td></tr>';

    // KPI
    $("k-total").textContent = daftar.length;
    $("k-hariini").textContent = sudahHariIni;
    $("k-belum").textContent = Math.max(0, daftar.length - sudahHariIni);
    $("k-entri").textContent = entriBulan.length;

    // Detail jurnal (bulan terpilih; bila ada pilihNip, filter ke pegawai itu)
    var det = entriBulan.slice();
    if (pilihNip) det = det.filter(function (j) { return keyNip(j.nip, j.nama) === pilihNip; });
    if (cari && !pilihNip) det = det.filter(function (j) { return (j.nama || "").toLowerCase().indexOf(cari) !== -1 || String(j.nip || "").toLowerCase().indexOf(cari) !== -1; });
    det.sort(function (a, b) { var ta = tgl10(a.tanggal) + (a.jam || ""), tb = tgl10(b.tanggal) + (b.jam || ""); return tb < ta ? -1 : (tb > ta ? 1 : 0); });

    $("jm-detail-info").textContent = pilihNip ? "(difilter 1 pegawai — klik baris lagi untuk semua)" : ("— " + BULAN[parseInt(bln.split("-")[1], 10) - 1] + " " + bln.split("-")[0]);
    $("jm-body-detail").innerHTML = det.length ? det.map(function (j) {
      return "<tr><td>" + fmtTanggal(tgl10(j.tanggal)) + "</td><td>" + esc(jam5(j.jam)) + "</td><td>" + esc(j.nama || "-") +
        "</td><td>" + esc(j.kegiatan || "-") + "</td><td>" + linkFoto(j.foto) + "</td><td>" +
        (j.lokasi ? '<a href="' + esc(j.lokasi) + '" target="_blank" rel="noopener">Peta</a>' : "-") + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="kosong">Belum ada jurnal pada bulan ini.</td></tr>';
  }

  $("jm-body-pegawai").addEventListener("click", function (ev) {
    var tr = ev.target.closest("tr.klik"); if (!tr) return;
    var k = tr.getAttribute("data-key");
    pilihNip = (pilihNip === k) ? "" : k;
    render();
  });
  $("jm-bulan").addEventListener("change", function () { pilihNip = ""; render(); });
  $("jm-cari").addEventListener("input", render);

  function muat() {
    $("jm-status").textContent = "Memuat data...";
    Promise.all([
      API.post({ action: "rekapJurnal", adminPassword: adminPw }),
      API.post({ action: "adminData", email: adminEmail, password: adminPw, deviceId: "" })
    ]).then(function (r) {
      if (!r[0] || r[0].status !== "success" || !r[0].isAdmin) {
        gagal((r[0] && r[0].message) || "Gagal memuat jurnal (akses admin ditolak).");
        return;
      }
      if (!r[1] || r[1].status !== "success") { gagal((r[1] && r[1].message) || "Gagal memuat daftar pegawai."); return; }

      // Daftar pegawai wajib jurnal: perangkat disetujui, bukan PPK (PJLP + PPPK), dedup per NIP.
      var terlihat = {};
      pegawai = [];
      (r[1].perangkat || []).filter(function (d) { return d.status === "disetujui" && d.role !== "PPK"; }).forEach(function (d) {
        var k = keyNip(d.nip, d.nama);
        if (terlihat[k]) return;
        terlihat[k] = true;
        pegawai.push({ nama: d.nama, nip: d.nip, jenis: d.jenis || "PJLP" });
      });

      jurnal = (r[0].data || []).map(function (row) {
        return { nama: row["Nama"], nip: row["NIP/ID"], tanggal: row["Tanggal"], jam: row["Jam"], kegiatan: row["Kegiatan"], foto: row["Foto"], lokasi: row["Link Lokasi"] };
      });

      $("jm-status").textContent = "Data " + jurnal.length + " entri jurnal, " + pegawai.length + " pegawai.";
      $("konten").classList.remove("hidden");
      render();
    }).catch(function (err) { gagal("Gagal memuat: " + err.message); });
  }
  function gagal(msg) { $("status-akses").textContent = msg; $("status-akses").classList.remove("hidden"); }

  /* ---------- Muat data (wajib sesi admin) ---------- */
  var adminPw = sessionStorage.getItem("pjlp_admin_pw") || "";
  var adminEmail = sessionStorage.getItem("pjlp_admin_email") || "";
  $("jm-bulan").value = bulanIni();
  $("jm-refresh").addEventListener("click", muat);

  if (typeof API === "undefined" || API.belumDikonfigurasi()) {
    gagal("Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL).");
  } else if (!adminPw) {
    gagal("Halaman ini khusus admin/pemantau — buka lewat tombol \"Monitoring Jurnal\" di Panel Admin.");
  } else {
    muat();
  }
})();
