/* ============================================================
   Surat Izin / Sakit / Cuti (surat.html)
   Pratinjau langsung dari input, lalu cetak / simpan PDF.
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmtTanggal(ymd) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ""); return p ? (parseInt(p[3], 10) + " " + BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : "-"; }
  function jumlahHari(a, b) { if (!a) return 0; var d1 = new Date(a), d2 = new Date(b || a); if (isNaN(d1.getTime())) return 0; if (isNaN(d2.getTime()) || d2 < d1) d2 = d1; return Math.round((d2 - d1) / 86400000) + 1; }
  function hariIni() { var n = new Date(); var l = new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); return l.getFullYear() + "-" + pad(l.getMonth() + 1) + "-" + pad(l.getDate()); }

  function render() {
    var jenis = $("s-jenis").value;
    $("p-instansi").textContent = $("s-instansi").value || "";
    $("p-alamat").textContent = $("s-alamat").value || "";
    $("p-judul").textContent = jenis === "Sakit" ? "SURAT KETERANGAN SAKIT" : jenis === "Cuti" ? "SURAT PERMOHONAN CUTI" : "SURAT PERMOHONAN IZIN";
    var nomor = $("s-nomor").value.trim();
    $("p-nomor").textContent = nomor ? "Nomor: " + nomor : "";
    var kepada = $("s-kepada").value.trim();
    $("p-kepada").innerHTML = kepada ? ("Kepada Yth.<br>" + esc(kepada) + "<br>di Tempat") : "";

    $("p-nama").textContent = $("s-nama").value || "-";
    $("p-nip").textContent = $("s-nip").value || "-";
    $("p-jabatan").textContent = $("s-jabatan").value || "-";

    var mulai = $("s-mulai").value, selesai = $("s-selesai").value;
    var n = jumlahHari(mulai, selesai);
    var rentang = fmtTanggal(mulai) + (selesai && selesai !== mulai ? " sampai dengan " + fmtTanggal(selesai) : "");
    var hariTxt = n > 0 ? " (" + n + " hari)" : "";
    var alasan = $("s-alasan").value.trim() || "-";
    var isi;
    if (jenis === "Sakit") isi = "Dengan ini memberitahukan bahwa saya tidak dapat melaksanakan tugas/masuk kerja terhitung mulai tanggal " + rentang + hariTxt + " dikarenakan sakit. Keterangan: " + alasan + ".";
    else if (jenis === "Cuti") isi = "Dengan ini mengajukan permohonan cuti terhitung mulai tanggal " + rentang + hariTxt + ", dengan alasan/keperluan: " + alasan + ".";
    else isi = "Dengan ini mengajukan permohonan izin untuk tidak masuk kerja terhitung mulai tanggal " + rentang + hariTxt + ", dikarenakan " + alasan + ".";
    $("p-isi").textContent = isi;

    var kota = $("s-kota").value.trim();
    $("p-kotatgl").textContent = (kota ? kota : "") + ", " + fmtTanggal($("s-tglsurat").value || hariIni());
    $("p-ttd-nama").textContent = $("s-nama").value || "(.................)";
    $("p-ttd-nip").textContent = $("s-nip").value ? "NIP. " + $("s-nip").value : "";

    var atasan = $("s-atasan").value.trim();
    if (atasan) {
      $("p-blok-atasan").style.display = "";
      $("p-atasan-nama").textContent = atasan;
      $("p-atasan-nip").textContent = $("s-atasannip").value ? "NIP. " + $("s-atasannip").value : "";
      $("p-blok-pemohon").classList.remove("ttd-kanan-only");
    } else {
      $("p-blok-atasan").style.display = "none";
      $("p-blok-pemohon").classList.add("ttd-kanan-only");
    }
  }

  document.querySelectorAll("#form-surat input, #form-surat select, #form-surat textarea").forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("btn-cetak").addEventListener("click", function () { render(); window.print(); });

  if (!$("s-tglsurat").value) $("s-tglsurat").value = hariIni();

  // Prefill nama/NIP dari perangkat (bila backend terkonfigurasi)
  if (typeof API !== "undefined" && !API.belumDikonfigurasi()) {
    API.post({ action: "cekPerangkat" })
      .then(function (res) {
        if (res && res.status === "success" && res.terdaftar) {
          if (res.nama && !$("s-nama").value) $("s-nama").value = res.nama;
          if (res.nip && !$("s-nip").value) $("s-nip").value = res.nip;
          render();
        }
      })
      .catch(function () { });
  }

  render();
})();
