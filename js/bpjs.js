/* ============================================================
   Daftar Rincian Iuran BPJS PJLP — dihitung dari Honorarium
   Bulanan × tarif resmi (sesuai Daftar Kuantitas & Harga SPK).
   Ditanggung pemberi kerja, bukan potongan gaji PJLP.
   Wajib mode admin (PPK/Kepegawaian).
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  var RATE_KESEHATAN = 0.04;         // 4% pemberi kerja (akun 811154)
  var RATE_KESEHATAN_PEKERJA = 0.01; // 1% pekerja (akun 811153)
  var RATE_JHT = 0.037;
  var RATE_JP = 0.02;
  var RATE_JKK = 0.0024;
  var RATE_JKM = 0.003;

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function fmtTanggal(s) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return p ? (+p[3] + " " + BULAN[+p[2] - 1] + " " + p[1]) : (s || "-"); }
  function lokal() { var n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + (CONFIG.OFFSET_JAM || 0) * 3600000); }
  function bulanIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function hariIni() { var d = lokal(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function namaBulan(ym) { var p = /(\d{4})-(\d{2})/.exec(ym || ""); return p ? (BULAN[parseInt(p[2], 10) - 1] + " " + p[1]) : "-"; }
  function rupiah(n) { n = String(Math.round(Math.abs(Number(n) || 0))); return n.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function angka(n) { return Math.round(Number(n) || 0); }

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

  var baris = []; // { nama, nip, jabatan, honorarium, kesehatan, jht, jp, jkk, jkm, total }

  function hitungBaris(m) {
    var honor = angka(m.honorariumBulanan);
    var kesehatan = Math.round(honor * RATE_KESEHATAN);
    var kesehatanPekerja = Math.round(honor * RATE_KESEHATAN_PEKERJA);
    var jht = Math.round(honor * RATE_JHT);
    var jp = Math.round(honor * RATE_JP);
    var jkk = Math.round(honor * RATE_JKK);
    var jkm = Math.round(honor * RATE_JKM);
    var total = kesehatan + jht + jp + jkk + jkm; // total iuran pemberi kerja (10,24%)
    return {
      nama: m.nama || "", nip: m.nip || "", jabatan: m.jabatan2026 || "",
      honorarium: honor, kesehatan: kesehatan, kesehatanPekerja: kesehatanPekerja,
      jht: jht, jp: jp, jkk: jkk, jkm: jkm, total: total
    };
  }

  function render() {
    $("p-instansi").textContent = $("b-instansi").value || "";
    $("p-alamat").textContent = $("b-alamat").value || "";
    var bulanTxt = namaBulan($("b-bulan").value);
    var sub = "Bulan " + bulanTxt;
    if ($("b-nomor").value.trim()) sub = "Nomor: " + $("b-nomor").value.trim() + " — " + sub;
    $("p-sub").textContent = sub;

    if (!baris.length) {
      $("p-body").innerHTML = '<tr><td colspan="12" class="kosong-baris">Tidak ada data pegawai (Data Master PJLP kosong, semua bertanda PPK, atau Honorarium Bulanan belum diisi).</td></tr>';
      ["p-tot-honor", "p-tot-kes", "p-tot-kes-pekerja", "p-tot-jht", "p-tot-jp", "p-tot-jkk", "p-tot-jkm", "p-total",
       "p-spm-kes4", "p-spm-kes1", "p-spm-tk"].forEach(function (id) { $(id).textContent = "0"; });
      $("p-terbilang").textContent = "nol rupiah";
    } else {
      $("p-body").innerHTML = baris.map(function (b, i) {
        return "<tr>" +
          "<td class=\"num\">" + (i + 1) + "</td>" +
          "<td>" + esc(b.nama) + "</td>" +
          "<td>" + esc(b.nip) + "</td>" +
          "<td>" + esc(b.jabatan) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.honorarium) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.kesehatan) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.kesehatanPekerja) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.jht) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.jp) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.jkk) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.jkm) + "</td>" +
          "<td class=\"rp\">" + rupiah(b.total) + "</td>" +
        "</tr>";
      }).join("");
      var sum = function (key) { return baris.reduce(function (s, b) { return s + b[key]; }, 0); };
      var totKes = sum("kesehatan"), totKesPekerja = sum("kesehatanPekerja");
      var totTk = sum("jht") + sum("jp") + sum("jkk") + sum("jkm");
      $("p-tot-honor").textContent = rupiah(sum("honorarium"));
      $("p-tot-kes").textContent = rupiah(totKes);
      $("p-tot-kes-pekerja").textContent = rupiah(totKesPekerja);
      $("p-tot-jht").textContent = rupiah(sum("jht"));
      $("p-tot-jp").textContent = rupiah(sum("jp"));
      $("p-tot-jkk").textContent = rupiah(sum("jkk"));
      $("p-tot-jkm").textContent = rupiah(sum("jkm"));
      var total = sum("total");
      $("p-total").textContent = rupiah(total);
      $("p-terbilang").textContent = terbilang(total) + " rupiah";
      // Ringkasan nilai untuk SPM
      $("p-spm-kes4").textContent = rupiah(totKes);
      $("p-spm-kes1").textContent = rupiah(totKesPekerja);
      $("p-spm-tk").textContent = rupiah(totTk);
    }

    $("p-kotatgl").textContent = ($("b-kota").value.trim() || "") + ", " + fmtTanggal($("b-tgl").value || hariIni());
    $("p-pembuat-nama").textContent = $("b-pembuat").value || "(.................)";
    $("p-ppk-nama").textContent = $("b-ppk-nama").value || "(.................)";
    $("p-ppk-nip").textContent = $("b-ppk-nip").value ? "NIP. " + $("b-ppk-nip").value : "";
  }

  document.querySelectorAll("#form-bp input").forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("btn-cetak").addEventListener("click", function () { window.print(); });

  $("b-bulan").value = bulanIni();
  $("b-tgl").value = hariIni();

  /* ---------- Muat data (wajib mode admin) ---------- */
  var adminPw = sessionStorage.getItem("pjlp_admin_pw") || "";
  var adminEmail = sessionStorage.getItem("pjlp_admin_email") || "";

  if (typeof API === "undefined" || API.belumDikonfigurasi()) {
    $("status-akses").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL).";
    $("status-akses").classList.remove("hidden");
  } else if (!adminPw || !adminEmail) {
    $("status-akses").textContent = "Halaman ini khusus PPK/Kepegawaian — buka lewat tombol \"Buat Daftar Rincian BPJS\" di Panel Admin.";
    $("status-akses").classList.remove("hidden");
  } else {
    $("bp-status").textContent = "Memuat data pegawai...";
    Promise.all([
      API.post({ action: "adminDataMaster", email: adminEmail, password: adminPw, deviceId: "" }),
      API.post({ action: "adminData", email: adminEmail, password: adminPw, deviceId: "" })
    ]).then(function (r) {
      if (!r[0] || r[0].status !== "success" || !r[1] || r[1].status !== "success") {
        $("status-akses").textContent = (r[0] && r[0].message) || (r[1] && r[1].message) || "Gagal memuat data.";
        $("status-akses").classList.remove("hidden");
        return;
      }
      var master = r[0].master || [];
      var perangkat = r[1].perangkat || [];
      var nipPPK = {};
      perangkat.forEach(function (d) { if (d.role === "PPK" && d.nip) nipPPK[String(d.nip).trim()] = true; });

      baris = master.filter(function (m) { return !nipPPK[String(m.nip).trim()]; }).map(hitungBaris);

      $("bp-status").textContent = baris.length ? ("Ditemukan " + baris.length + " pegawai.") : "Belum ada Data Master PJLP.";
      $("konten").classList.remove("hidden");
      render();
    }).catch(function (err) {
      $("status-akses").textContent = "Gagal memuat: " + err.message;
      $("status-akses").classList.remove("hidden");
    });
  }
})();
