/* ============================================================
   Surat Keterangan Tidak Dapat Absen (surat-keterangan.html)
   Untuk halangan tertentu (WFA, berobat di luar waktu, tugas luar,
   kendala jaringan) — menerangkan tetap melaksanakan tugas dari
   jam ... s.d. jam .... Pratinjau langsung, lalu cetak / simpan PDF.
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmtTanggal(ymd) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ""); return p ? (parseInt(p[3], 10) + " " + BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : "-"; }
  function namaHari(ymd) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ""); if (!p) return ""; var d = new Date(parseInt(p[1], 10), parseInt(p[2], 10) - 1, parseInt(p[3], 10)); return HARI[d.getDay()]; }
  function hariIni() { var n = new Date(); var l = new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); return l.getFullYear() + "-" + pad(l.getMonth() + 1) + "-" + pad(l.getDate()); }
  function jamTxt(v) { var p = /^(\d{1,2}):(\d{2})/.exec(v || ""); return p ? (pad(parseInt(p[1], 10)) + "." + p[2]) : ""; }

  function render() {
    $("p-instansi").textContent = $("k-instansi").value || "";
    $("p-alamat").textContent = $("k-alamat").value || "";
    var nomor = $("k-nomor").value.trim();
    $("p-nomor").textContent = nomor ? "Nomor: " + nomor : "";
    var kepada = $("k-kepada").value.trim();
    $("p-kepada").innerHTML = kepada ? ("Kepada Yth.<br>" + esc(kepada) + "<br>di Tempat") : "";

    $("p-nama").textContent = $("k-nama").value || "-";
    $("p-nip").textContent = $("k-nip").value || "-";
    $("p-jabatan").textContent = $("k-jabatan").value || "-";

    var tgl = $("k-tanggal").value;
    var hari = namaHari(tgl);
    var tglTxt = (hari ? "hari " + hari + ", tanggal " : "") + fmtTanggal(tgl);
    var absen = $("k-absen").value;
    var halangan = $("k-jenis").value;
    var ket = $("k-keterangan").value.trim();
    var jm = jamTxt($("k-jam-mulai").value), js = jamTxt($("k-jam-selesai").value);

    var isi = "Dengan ini menerangkan dengan sebenarnya bahwa pada " + tglTxt +
      " saya tidak dapat melakukan absensi " + absen + " melalui aplikasi dikarenakan " + halangan +
      (ket ? " (" + ket + ")" : "") + ". ";
    if (jm || js) {
      isi += "Adapun saya tetap melaksanakan tugas kedinasan dari pukul " +
        (jm || "…") + " s.d. pukul " + (js || "…") + " WIT.";
    } else {
      isi += "Adapun saya tetap melaksanakan tugas kedinasan pada hari tersebut.";
    }
    $("p-isi").textContent = isi;

    var kota = $("k-kota").value.trim();
    $("p-kotatgl").textContent = (kota ? kota : "") + ", " + fmtTanggal($("k-tglsurat").value || hariIni());
    $("p-ttd-nama").textContent = $("k-nama").value || "(.................)";
    $("p-ttd-nip").textContent = $("k-nip").value ? "NIP. " + $("k-nip").value : "";

    var atasan = $("k-atasan").value.trim();
    if (atasan) {
      $("p-blok-atasan").style.display = "";
      $("p-atasan-nama").textContent = atasan;
      $("p-atasan-nip").textContent = $("k-atasannip").value ? "NIP. " + $("k-atasannip").value : "";
      $("p-blok-pemohon").classList.remove("ttd-kanan-only");
    } else {
      $("p-blok-atasan").style.display = "none";
      $("p-blok-pemohon").classList.add("ttd-kanan-only");
    }
  }

  document.querySelectorAll("#form-ket input, #form-ket select, #form-ket textarea").forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("btn-cetak").addEventListener("click", function () { render(); window.print(); });

  if (!$("k-tglsurat").value) $("k-tglsurat").value = hariIni();
  if (!$("k-tanggal").value) $("k-tanggal").value = hariIni();

  // Prefill nama/NIP dari perangkat (bila backend terkonfigurasi)
  if (typeof API !== "undefined" && !API.belumDikonfigurasi()) {
    API.post({ action: "cekPerangkat" })
      .then(function (res) {
        if (res && res.status === "success" && res.terdaftar) {
          if (res.nama && !$("k-nama").value) $("k-nama").value = res.nama;
          if (res.nip && !$("k-nip").value) $("k-nip").value = res.nip;
          render();
        }
      })
      .catch(function () { });
  }

  render();
})();
