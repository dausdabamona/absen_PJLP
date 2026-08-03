/* ============================================================
   Laporan Jurnal Bulanan (laporan.html)
   Menampilkan jurnal kegiatan PERANGKAT INI (device-scoped),
   lalu dapat dicetak / disimpan PDF.
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  var jurnalRows = [];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function fmtTanggal(ymd) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ""); return p ? (parseInt(p[3], 10) + " " + BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : (ymd || "-"); }
  function lokal() { var n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); }
  function bulanIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function hariIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function namaBulan(ym) { var p = /(\d{4})-(\d{2})/.exec(ym || ""); return p ? (BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : "-"; }

  function cari(row, kandidat) { for (var i = 0; i < kandidat.length; i++) { var k = kandidat[i]; if (row[k] !== undefined && row[k] !== "") return String(row[k]); } return ""; }
  function tgl10(v) { return v ? String(v).substring(0, 10) : ""; }
  function waktuSort(row) { var t = cari(row, ["Timestamp"]); if (t) return String(t); return (tgl10(cari(row, ["Tanggal"])) + " " + cari(row, ["Jam"])).trim(); }
  function thumbUrl(url) {
    if (!url) return "";
    var m = /[-\w]{25,}/.exec(url); // ID file Google Drive
    return m ? ("https://drive.google.com/thumbnail?id=" + m[0] + "&sz=w320") : "";
  }

  function jurnalBulan() {
    var b = $("l-bulan").value;
    return jurnalRows
      .filter(function (r) { var t = tgl10(cari(r, ["Timestamp", "Tanggal"])); return !b || t.indexOf(b) === 0; })
      .sort(function (a, c) { return waktuSort(a) < waktuSort(c) ? -1 : 1; });
  }

  function render() {
    $("p-instansi").textContent = $("l-instansi").value || "";
    $("p-alamat").textContent = $("l-alamat").value || "";
    $("p-nama").textContent = $("l-nama").value || "-";
    $("p-nip").textContent = $("l-nip").value || "-";
    $("p-jabatan").textContent = $("l-jabatan").value || "-";
    $("p-bulan").textContent = namaBulan($("l-bulan").value);

    var data = jurnalBulan();
    if (!data.length) {
      $("p-body").innerHTML = '<tr><td colspan="4" class="kosong">Tidak ada jurnal kegiatan pada bulan ini.</td></tr>';
    } else {
      $("p-body").innerHTML = data.map(function (r, i) {
        return "<tr><td class=\"no\">" + (i + 1) + "</td><td class=\"tgl\">" + esc(fmtTanggal(tgl10(cari(r, ["Tanggal", "Timestamp"])))) +
          "</td><td class=\"jam\">" + esc(cari(r, ["Jam"])) + "</td><td>" + esc(cari(r, ["Kegiatan"])) + "</td></tr>";
      }).join("");
    }

    // Lampiran foto (opsional). Satu baris jurnal bisa punya beberapa foto
    // (URL dipisah baris baru) -> tiap foto jadi 1 item lampiran.
    if ($("l-foto").checked) {
      var fotos = [];
      data.forEach(function (r) {
        var tgl = fmtTanggal(tgl10(cari(r, ["Tanggal", "Timestamp"])));
        String(cari(r, ["Foto"]) || "").split(/[\n\r]+/).filter(Boolean).forEach(function (u) {
          var t = thumbUrl(u); if (t) fotos.push({ url: t, tgl: tgl });
        });
      });
      if (fotos.length) {
        $("p-foto-grid").innerHTML = fotos.map(function (f) {
          return '<div class="foto-item"><img src="' + esc(f.url) + '" alt="foto"><div>' + esc(f.tgl) + "</div></div>";
        }).join("");
        $("p-lampiran").style.display = "";
      } else { $("p-lampiran").style.display = "none"; }
    } else { $("p-lampiran").style.display = "none"; }

    $("p-kotatgl").textContent = ($("l-kota").value.trim() ? $("l-kota").value.trim() : "") + ", " + fmtTanggal($("l-tgl").value || hariIni());
    $("p-ttd-nama").textContent = $("l-nama").value || "(.................)";
    $("p-ttd-nip").textContent = $("l-nip").value ? "NIP. " + $("l-nip").value : "";

    var atasan = $("l-atasan").value.trim();
    if (atasan) {
      $("p-blok-atasan").style.display = "";
      $("p-atasan-nama").textContent = atasan;
      $("p-atasan-nip").textContent = $("l-atasannip").value ? "NIP. " + $("l-atasannip").value : "";
      $("p-blok-pemohon").classList.remove("ttd-kanan-only");
    } else {
      $("p-blok-atasan").style.display = "none";
      $("p-blok-pemohon").classList.add("ttd-kanan-only");
    }
  }

  document.querySelectorAll("#form-lap input, #form-lap select").forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("btn-cetak").addEventListener("click", function () { render(); window.print(); });

  // Default
  $("l-bulan").value = bulanIni();
  $("l-tgl").value = hariIni();

  /* ---------- Mode Admin: laporan untuk PJLP lain yg dipilih di panel admin ---------- */
  var adminPw = sessionStorage.getItem("pjlp_admin_pw") || "";
  var targetNip = sessionStorage.getItem("pjlp_target_nip") || "";
  var targetNama = sessionStorage.getItem("pjlp_target_nama") || "";
  var targetDeviceId = sessionStorage.getItem("pjlp_target_deviceid") || "";
  var modeAdmin = !!(adminPw && targetNip);

  if (typeof API === "undefined" || API.belumDikonfigurasi()) {
    $("lap-status").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL).";
    $("lap-status").className = "status err";
  } else if (modeAdmin) {
    $("banner-admin").classList.remove("hidden");
    $("banner-admin-nama").textContent = targetNama;
    if (targetNama && !$("l-nama").value) $("l-nama").value = targetNama;
    if (targetNip && !$("l-nip").value) $("l-nip").value = targetNip;

    $("lap-status").textContent = "Memuat jurnal (mode admin)...";
    API.post({ action: "rekapJurnal", adminPassword: adminPw })
      .then(function (res) {
        var semua = (res && res.data) || [];
        jurnalRows = semua.filter(function (r) {
          return (targetDeviceId && String(r["Device ID"]) === targetDeviceId) || String(r["NIP/ID"]) === targetNip;
        });
        $("lap-status").textContent = jurnalRows.length
          ? ("Ditemukan " + jurnalRows.length + " catatan jurnal untuk " + targetNama + ".")
          : ("Belum ada catatan jurnal untuk " + targetNama + ".");
        $("lap-status").className = "status muted";
        render();
      })
      .catch(function (err) { $("lap-status").textContent = "Gagal memuat jurnal: " + err.message; $("lap-status").className = "status err"; });
  } else {
    // Mode mandiri (perilaku asli, tidak berubah): jurnal perangkat ini saja
    API.post({ action: "cekPerangkat" }).then(function (res) {
      if (res && res.status === "success" && res.terdaftar) {
        if (res.nama && !$("l-nama").value) $("l-nama").value = res.nama;
        if (res.nip && !$("l-nip").value) $("l-nip").value = res.nip;
      }
    }).catch(function () {});

    $("lap-status").textContent = "Memuat jurnal perangkat ini...";
    API.post({ action: "rekapJurnal" })
      .then(function (res) {
        jurnalRows = (res && res.data) || [];
        $("lap-status").textContent = jurnalRows.length
          ? ("Ditemukan " + jurnalRows.length + " catatan jurnal (semua bulan).")
          : "Belum ada catatan jurnal untuk perangkat ini.";
        $("lap-status").className = "status muted";
        render();
      })
      .catch(function (err) { $("lap-status").textContent = "Gagal memuat jurnal: " + err.message; $("lap-status").className = "status err"; });
  }

  render();
})();
