/* ============================================================
   Berita Acara PJLP — BAPP / BAST / BAP
   Isi form -> pratinjau resmi -> cetak / simpan PDF.
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function parseTgl(s) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return p ? new Date(parseInt(p[1], 10), parseInt(p[2], 10) - 1, parseInt(p[3], 10)) : null; }
  function fmtTanggal(s) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return p ? (parseInt(p[3], 10) + " " + BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : (s || "-"); }
  function lokal() { var n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); }
  function bulanIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function hariIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function namaBulan(ym) { var p = /(\d{4})-(\d{2})/.exec(ym || ""); return p ? (BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : "-"; }
  function rupiah(n) { n = String(Math.floor(Math.abs(Number(n) || 0))); return n.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  function terbilang(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return "nol";
    var sat = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
    function tiga(x) {
      var s = "", ratus = Math.floor(x / 100), sisa = x % 100;
      if (ratus > 0) { s += (ratus === 1 ? "seratus" : sat[ratus] + " ratus"); if (sisa) s += " "; }
      if (sisa > 0) {
        if (sisa < 12) s += sat[sisa];
        else if (sisa < 20) s += sat[sisa - 10] + " belas";
        else { var p = Math.floor(sisa / 10), q = sisa % 10; s += sat[p] + " puluh"; if (q) s += " " + sat[q]; }
      }
      return s;
    }
    var out = "";
    var miliar = Math.floor(n / 1000000000); n %= 1000000000;
    var juta = Math.floor(n / 1000000); n %= 1000000;
    var ribu = Math.floor(n / 1000); n %= 1000;
    if (miliar > 0) out += tiga(miliar) + " miliar ";
    if (juta > 0) out += tiga(juta) + " juta ";
    if (ribu > 0) out += (ribu === 1 ? "seribu" : tiga(ribu) + " ribu") + " ";
    if (n > 0) out += tiga(n);
    return out.trim().replace(/\s+/g, " ");
  }

  function baris(label, val) { return "<tr><td>" + esc(label) + "</td><td>:</td><td>" + esc(val || "-") + "</td></tr>"; }
  function tanggalKalimat(tglStr) {
    var d = parseTgl(tglStr);
    if (!d) return "hari ini ................ tanggal ................";
    return "hari ini <b>" + HARI[d.getDay()] + "</b> tanggal <b>" + terbilang(d.getDate()) + "</b> bulan <b>" + BULAN[d.getMonth()] + "</b> tahun <b>" + terbilang(d.getFullYear()) + "</b>";
  }

  function ttdDua(kiriLabel, kiriSub, kiriNama, kiriNip, kananAtas, kananLabel, kananSub, kananNama, kananNip) {
    return '<div class="ttd-area">' +
      '<div class="ttd-blok"><div>&nbsp;</div><div>' + esc(kiriLabel) + '</div><div>' + esc(kiriSub || "") + '</div><div class="ttd-space"></div><div class="ttd-nama">' + esc(kiriNama || "(.................)") + '</div>' + (kiriNip ? '<div>NIP. ' + esc(kiriNip) + '</div>' : '') + '</div>' +
      '<div class="ttd-blok"><div>' + esc(kananAtas || "") + '</div><div>' + esc(kananLabel) + '</div><div>' + esc(kananSub || "") + '</div><div class="ttd-space"></div><div class="ttd-nama">' + esc(kananNama || "(.................)") + '</div>' + (kananNip ? '<div>NIP. ' + esc(kananNip) + '</div>' : '') + '</div>' +
      '</div>';
  }

  function render() {
    var jenis = $("b-jenis").value;
    $("p-instansi").textContent = $("b-instansi").value || "";
    $("p-alamat").textContent = $("b-alamat").value || "";

    var judul = { BAPP: "BERITA ACARA PEMERIKSAAN PEKERJAAN", BAST: "BERITA ACARA SERAH TERIMA PEKERJAAN", BAP: "BERITA ACARA PEMBAYARAN" }[jenis];
    $("p-judul").innerHTML = esc(judul) + ' <span class="sub">(' + esc(jenis) + ' — Pengadaan Jasa Lainnya Perorangan)</span>';
    $("p-nomor").textContent = $("b-nomor").value.trim() ? "Nomor: " + $("b-nomor").value.trim() : "";

    var nilai = Number(String($("b-nilai").value).replace(/[^\d]/g, "")) || 0;
    $("b-terbilang-info").textContent = nilai > 0 ? ("Terbilang: " + terbilang(nilai) + " rupiah") : "";
    $("wrap-pajak").style.display = (jenis === "BAP") ? "" : "none";

    var pnama = $("b-pnama").value, pnip = $("b-pnip").value, pjab = $("b-pjabatan").value, palamat = $("b-palamat").value;
    var nama = $("b-nama").value, nip = $("b-nip").value, jab = $("b-jabatan").value;
    var dasar = $("b-dasar").value, paket = $("b-paket").value, lingkup = $("b-lingkup").value, jangka = $("b-jangka").value;
    var bulan = namaBulan($("b-bulan").value);
    var kotatgl = ($("b-kota").value.trim() ? $("b-kota").value.trim() : "") + ", " + fmtTanggal($("b-tgl").value || hariIni());

    var html = '<p class="isi">Pada ' + tanggalKalimat($("b-tgl").value || hariIni()) + ', yang bertanda tangan di bawah ini:</p>';

    // PIHAK KESATU (pejabat)
    html += '<table class="rinci">' + baris("Nama", pnama) + baris("NIP", pnip) + baris("Jabatan", pjab) + (palamat ? baris("Alamat", palamat) : "") + '</table>';
    html += '<p class="isi">Yang selanjutnya disebut sebagai <b>PIHAK KESATU</b>.</p>';
    // PIHAK KEDUA (PJLP)
    html += '<table class="rinci">' + baris("Nama", nama) + (nip ? baris("NIP / ID", nip) : "") + baris("Jabatan", jab) + '</table>';
    html += '<p class="isi">Yang selanjutnya disebut sebagai <b>PIHAK KEDUA</b>.</p>';
    if (dasar) html += '<p class="isi">Berdasarkan: ' + esc(dasar) + '.</p>';

    var detail = '<table class="rinci">' +
      (paket ? baris("Paket Pekerjaan", paket) : "") +
      (lingkup ? baris("Lingkup Pekerjaan", lingkup) : "") +
      (nilai > 0 ? "<tr><td>Nilai" + (jenis === "BAP" ? " Honorarium" : " Kontrak") + "</td><td>:</td><td>Rp " + esc(rupiah(nilai)) + " (" + esc(terbilang(nilai)) + " rupiah)</td></tr>" : "") +
      (jangka ? baris("Jangka Waktu Penyelesaian", esc(jangka) + " hari kalender") : "") +
      '</table>';

    if (jenis === "BAST") {
      html += '<p class="isi">PIHAK KESATU telah menerima penyerahan pekerjaan dari PIHAK KEDUA atas pelaksanaan Penyediaan Jasa Lainnya Perorangan, sebagai berikut:</p>';
      html += detail;
      html += '<p class="isi">Dari serah terima pekerjaan tersebut dapat disimpulkan, bahwa pekerjaan yang diserahterimakan oleh PIHAK KEDUA kepada PIHAK KESATU telah sesuai ketentuan dan persyaratan yang diatur dalam Kontrak.</p>';
      html += '<p class="isi">Demikian Berita Acara Serah Terima Pekerjaan ini dibuat dalam rangkap secukupnya untuk dipergunakan sebagaimana mestinya.</p>';
    } else if (jenis === "BAPP") {
      html += '<p class="isi">PIHAK KESATU telah melakukan pemeriksaan atas hasil pekerjaan yang dilaksanakan oleh PIHAK KEDUA' + (dasar ? ' berdasarkan ' + esc(dasar) : '') + ' untuk periode bulan <b>' + esc(bulan) + '</b>, dengan uraian sebagai berikut:</p>';
      html += (paket || lingkup || nilai || jangka) ? detail : '';
      html += '<p class="isi">Berdasarkan hasil pemeriksaan, pekerjaan telah dilaksanakan <b>100% (seratus persen)</b> dan telah sesuai dengan spesifikasi, kuantitas, serta kualitas sebagaimana ketentuan yang berlaku, sehingga hasil pekerjaan dinyatakan <b>DITERIMA</b>.</p>';
      html += '<p class="isi">Berita Acara Pemeriksaan ini menjadi dasar untuk proses serah terima dan pembayaran pekerjaan.</p>';
      html += '<p class="isi">Demikian Berita Acara Pemeriksaan Pekerjaan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>';
    } else { // BAP
      var pajak = Number(String($("b-pajak").value).replace(/[^\d]/g, "")) || 0;
      var bersih = Math.max(0, nilai - pajak);
      html += '<p class="isi">Berdasarkan ' + (dasar ? esc(dasar) + ' serta ' : '') + 'hasil pemeriksaan dan serah terima pekerjaan, PIHAK KESATU membayarkan kepada PIHAK KEDUA atas pelaksanaan pekerjaan untuk periode bulan <b>' + esc(bulan) + '</b>, dengan rincian sebagai berikut:</p>';
      var rinciBayar = '<table class="rinci">' +
        '<tr><td>Nilai Honorarium (Bruto)</td><td>:</td><td>Rp ' + esc(rupiah(nilai)) + ' (' + esc(terbilang(nilai)) + ' rupiah)</td></tr>';
      if (pajak > 0) {
        rinciBayar += '<tr><td>Potongan PPh</td><td>:</td><td>Rp ' + esc(rupiah(pajak)) + ' (' + esc(terbilang(pajak)) + ' rupiah)</td></tr>' +
          '<tr><td><b>Jumlah Diterima (Netto)</b></td><td>:</td><td><b>Rp ' + esc(rupiah(bersih)) + ' (' + esc(terbilang(bersih)) + ' rupiah)</b></td></tr>';
      }
      rinciBayar += '</table>';
      html += rinciBayar;
      html += '<p class="isi">Pembayaran tersebut merupakan hak PIHAK KEDUA atas pelaksanaan pekerjaan yang telah diselesaikan dan diterima sesuai ketentuan Kontrak.</p>';
      html += '<p class="isi">Demikian Berita Acara Pembayaran ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>';
    }

    html += ttdDua("PIHAK KESATU,", pjab, pnama, pnip, kotatgl, "PIHAK KEDUA,", jab, nama, nip);
    $("p-body").innerHTML = html;
  }

  document.querySelectorAll("#form-ba input, #form-ba select, #form-ba textarea").forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("btn-cetak").addEventListener("click", function () { render(); window.print(); });

  $("b-bulan").value = bulanIni();
  $("b-tgl").value = hariIni();

  if (typeof API !== "undefined" && !API.belumDikonfigurasi()) {
    API.post({ action: "cekPerangkat" }).then(function (res) {
      if (res && res.status === "success" && res.terdaftar) {
        if (res.nama && !$("b-nama").value) $("b-nama").value = res.nama;
        if (res.nip && !$("b-nip").value) $("b-nip").value = res.nip;
        render();
      }
    }).catch(function () {});
  }

  render();
})();
