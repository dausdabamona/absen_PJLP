/* ============================================================
   Slip Gaji PJLP — per pegawai (bandingkan dengan Nominatif Gaji
   yang mencakup SEMUA pegawai). Wajib mode admin (PPK/Kepegawaian),
   dibuka lewat tombol "Buat Slip Gaji" setelah pilih 1 pegawai di
   Panel Admin (sessionStorage: pjlp_target_nip).
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  var RATE_KESEHATAN = 0.04;       // 4% ditanggung pemberi kerja (akun 811154)
  var RATE_KESEHATAN_PEGAWAI = 0.01; // 1% potongan pegawai (akun 811153)
  var RATE_JHT = 0.037;
  var RATE_JP = 0.02;
  var RATE_JKK = 0.0024;
  var RATE_JKM = 0.003;
  var RATE_TK = RATE_JHT + RATE_JP + RATE_JKK + RATE_JKM;

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
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

  var pegawai = null; // { nama, nip, jabatan2026, rekening, honorariumBulanan }

  function render() {
    $("p-instansi").textContent = $("s-instansi").value || "";
    $("p-alamat").textContent = $("s-alamat").value || "";
    var bulanTxt = namaBulan($("s-bulan").value);
    var sub = "Bulan " + bulanTxt;
    if ($("s-nomor").value.trim()) sub = "Nomor: " + $("s-nomor").value.trim() + " — " + sub;
    $("p-sub").textContent = sub;

    var nama = (pegawai && pegawai.nama) || "";
    var nip = (pegawai && pegawai.nip) || "";
    $("p-nama").textContent = nama || "-";
    $("p-nip").textContent = nip || "-";
    $("p-jabatan").textContent = (pegawai && pegawai.jabatan2026) || "-";
    $("p-rekening").textContent = (pegawai && pegawai.rekening) || "-";

    var honor = angka(pegawai && pegawai.honorariumBulanan);
    $("p-honor-label").textContent = "Honorarium bulan " + bulanTxt;
    $("p-honor").textContent = rupiah(honor);

    var pakaiThr = $("s-thr").checked;
    var thr = pakaiThr ? honor : 0;
    $("row-thr").classList.toggle("hidden", !pakaiThr);
    $("p-thr").textContent = rupiah(thr);

    var subTerima = honor + thr;
    $("p-sub-terima").textContent = rupiah(subTerima);

    // Potongan wajib: BPJS Kesehatan 1% dari Honorarium (ditanggung pegawai, akun 811153).
    var bpjsKesPegawai = Math.round(honor * RATE_KESEHATAN_PEGAWAI);
    $("p-bpjs-kes-pegawai").textContent = rupiah(bpjsKesPegawai);

    var potongan = angka(String($("s-potongan").value).replace(/[^\d]/g, ""));
    var ketPotongan = $("s-potongan-ket").value.trim();
    $("p-potongan-label").textContent = potongan > 0 ? (ketPotongan || "Potongan lain") : "-";
    $("p-potongan").textContent = rupiah(potongan);
    var totalPotongan = bpjsKesPegawai + potongan;
    $("p-sub-potongan").textContent = rupiah(totalPotongan);

    var bersih = Math.max(0, subTerima - totalPotongan);
    $("p-bersih").textContent = rupiah(bersih);
    $("p-terbilang").textContent = terbilang(bersih) + " rupiah";

    $("p-bpjs-kes").textContent = rupiah(Math.round(honor * RATE_KESEHATAN));
    $("p-bpjs-tk").textContent = rupiah(Math.round(honor * RATE_TK));

    $("p-kotatgl").textContent = ($("s-kota").value.trim() || "") + ", " + fmtTanggal($("s-tgl").value || hariIni());
    $("p-terima-nama").textContent = nama || "(.................)";
    $("p-terima-nip").textContent = nip ? "NIP. " + nip : "";
    $("p-ppk-nama").textContent = $("s-ppk-nama").value || "(.................)";
    $("p-ppk-nip").textContent = $("s-ppk-nip").value ? "NIP. " + $("s-ppk-nip").value : "";
  }

  document.querySelectorAll("#form-sg input").forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("btn-cetak").addEventListener("click", function () { window.print(); });

  $("s-bulan").value = bulanIni();
  $("s-tgl").value = hariIni();

  /* ---------- Muat data (wajib mode admin + 1 pegawai terpilih) ---------- */
  var adminPw = sessionStorage.getItem("pjlp_admin_pw") || "";
  var adminEmail = sessionStorage.getItem("pjlp_admin_email") || "";
  var targetNip = sessionStorage.getItem("pjlp_target_nip") || "";
  var targetNama = sessionStorage.getItem("pjlp_target_nama") || "";

  if (typeof API === "undefined" || API.belumDikonfigurasi()) {
    $("status-akses").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL).";
    $("status-akses").classList.remove("hidden");
  } else if (!adminPw || !adminEmail || !targetNip) {
    $("status-akses").textContent = "Halaman ini khusus PPK/Kepegawaian — pilih pegawai lalu klik \"Buat Slip Gaji\" di Panel Admin.";
    $("status-akses").classList.remove("hidden");
  } else {
    $("banner-admin").classList.remove("hidden");
    $("banner-admin-nama").textContent = targetNama;
    API.post({ action: "adminDataMaster", email: adminEmail, password: adminPw, deviceId: "" }).then(function (res) {
      if (!res || res.status !== "success") {
        $("status-akses").textContent = (res && res.message) || "Gagal memuat data.";
        $("status-akses").classList.remove("hidden");
        return;
      }
      pegawai = (res.master || []).filter(function (m) { return m.nip === targetNip; })[0] || null;
      if (!pegawai) {
        $("status-akses").textContent = "Data Master PJLP untuk " + (targetNama || targetNip) + " belum diisi. Lengkapi dulu di tab Data PJLP.";
        $("status-akses").classList.remove("hidden");
        return;
      }
      $("konten").classList.remove("hidden");
      render();
    }).catch(function (err) {
      $("status-akses").textContent = "Gagal memuat: " + err.message;
      $("status-akses").classList.remove("hidden");
    });
  }
})();
