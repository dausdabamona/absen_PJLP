/* ============================================================
   Daftar Nominatif Gaji PJLP — SEMUA pegawai sekaligus.
   Wajib mode admin (PPK/Kepegawaian). Gaji pokok otomatis dari
   Harga Negosiasi / jumlah bulan kontrak, bisa dikoreksi manual.
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function parseTgl(s) { var p = /(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return p ? new Date(+p[1], +p[2] - 1, +p[3]) : null; }
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

  function bulanAntara(mulai, selesai) {
    var a = parseTgl(mulai), b = parseTgl(selesai);
    if (!a || !b) return 9; // default periode kontrak PJLP (April-Desember)
    var bln = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
    return bln > 0 ? bln : 9;
  }

  var baris = []; // { nama, nip, jabatan, rekening, gajiPokok, potongan }

  function render() {
    $("p-instansi").textContent = $("n-instansi").value || "";
    $("p-alamat").textContent = $("n-alamat").value || "";
    var bulanTxt = namaBulan($("n-bulan").value);
    var sub = "Bulan " + bulanTxt;
    if ($("n-nomor").value.trim()) sub = "Nomor: " + $("n-nomor").value.trim() + " — " + sub;
    $("p-sub").textContent = sub;

    if (!baris.length) {
      $("p-body").innerHTML = '<tr><td colspan="9" class="kosong-baris">Tidak ada data pegawai (Data Master PJLP kosong atau semua bertanda PPK).</td></tr>';
      $("p-total").textContent = "0"; $("p-terbilang").textContent = "nol rupiah";
    } else {
      $("p-body").innerHTML = baris.map(function (b, i) {
        var bersih = Math.max(0, angka(b.gajiPokok) - angka(b.potongan));
        return "<tr>" +
          "<td class=\"num\">" + (i + 1) + "</td>" +
          "<td>" + esc(b.nama) + "</td>" +
          "<td>" + esc(b.nip) + "</td>" +
          "<td>" + esc(b.jabatan) + "</td>" +
          "<td class=\"rp\"><input type=\"text\" inputmode=\"numeric\" class=\"in-pokok\" data-i=\"" + i + "\" value=\"" + angka(b.gajiPokok) + "\"></td>" +
          "<td class=\"rp\"><input type=\"text\" inputmode=\"numeric\" class=\"in-potongan\" data-i=\"" + i + "\" value=\"" + angka(b.potongan) + "\"></td>" +
          "<td class=\"rp\">" + rupiah(bersih) + "</td>" +
          "<td>" + esc(b.rekening) + "</td>" +
          "<td></td>" +
        "</tr>";
      }).join("");
      var total = baris.reduce(function (s, b) { return s + Math.max(0, angka(b.gajiPokok) - angka(b.potongan)); }, 0);
      $("p-total").textContent = rupiah(total);
      $("p-terbilang").textContent = terbilang(total) + " rupiah";
    }

    $("p-kotatgl").textContent = ($("n-kota").value.trim() || "") + ", " + fmtTanggal($("n-tgl").value || hariIni());
    $("p-pembuat-nama").textContent = $("n-pembuat").value || "(.................)";
    $("p-ppk-nama").textContent = $("n-ppk-nama").value || "(.................)";
    $("p-ppk-nip").textContent = $("n-ppk-nip").value ? "NIP. " + $("n-ppk-nip").value : "";
  }

  $("p-body").addEventListener("input", function (ev) {
    var el = ev.target;
    var i = parseInt(el.getAttribute("data-i"), 10);
    if (isNaN(i)) return;
    var v = angka(String(el.value).replace(/[^\d]/g, ""));
    if (el.classList.contains("in-pokok")) baris[i].gajiPokok = v;
    else if (el.classList.contains("in-potongan")) baris[i].potongan = v;
    // Recompute hanya total & kolom bersih baris ini tanpa re-render penuh (jaga fokus input)
    var total = baris.reduce(function (s, b) { return s + Math.max(0, angka(b.gajiPokok) - angka(b.potongan)); }, 0);
    $("p-total").textContent = rupiah(total);
    $("p-terbilang").textContent = terbilang(total) + " rupiah";
    var tr = el.closest("tr");
    var bersih = Math.max(0, angka(baris[i].gajiPokok) - angka(baris[i].potongan));
    tr.children[6].textContent = rupiah(bersih);
  });

  document.querySelectorAll("#form-ng input").forEach(function (el) {
    if (el.closest("#p-body")) return;
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  $("btn-cetak").addEventListener("click", function () { window.print(); });

  $("n-bulan").value = bulanIni();
  $("n-tgl").value = hariIni();

  /* ---------- Muat data (wajib mode admin) ---------- */
  var adminPw = sessionStorage.getItem("pjlp_admin_pw") || "";
  var adminEmail = sessionStorage.getItem("pjlp_admin_email") || "";

  if (typeof API === "undefined" || API.belumDikonfigurasi()) {
    $("status-akses").textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL).";
    $("status-akses").classList.remove("hidden");
  } else if (!adminPw || !adminEmail) {
    $("status-akses").textContent = "Halaman ini khusus PPK/Kepegawaian — buka lewat tombol \"Buat Daftar Nominatif Gaji\" di Panel Admin.";
    $("status-akses").classList.remove("hidden");
  } else {
    $("ng-status").textContent = "Memuat data pegawai...";
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

      baris = master.filter(function (m) { return !nipPPK[String(m.nip).trim()]; }).map(function (m) {
        var bln = bulanAntara(m.kontrakMulai, m.kontrakSelesai);
        var pokok = m.hargaNegosiasi ? Math.round(Number(m.hargaNegosiasi) / bln) : 0;
        return { nama: m.nama || "", nip: m.nip || "", jabatan: m.jabatan2026 || "", rekening: m.rekening || "", gajiPokok: pokok, potongan: 0 };
      });

      $("ng-status").textContent = baris.length ? ("Ditemukan " + baris.length + " pegawai.") : "Belum ada Data Master PJLP.";
      $("konten").classList.remove("hidden");
      render();
    }).catch(function (err) {
      $("status-akses").textContent = "Gagal memuat: " + err.message;
      $("status-akses").classList.remove("hidden");
    });
  }
})();
