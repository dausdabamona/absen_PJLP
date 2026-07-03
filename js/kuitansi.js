/* ============================================================
   Kuitansi Pembayaran PJLP — isi form -> pratinjau -> cetak/PDF.
   ============================================================ */

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
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

  function isiUraianDefault() {
    var el = $("k-uraian");
    if (el.value.trim() && el.value.trim() !== "Honorarium PJLP bulan ...") return;
    var nama = $("k-nama").value.trim(), jab = $("k-jabatan").value.trim(), bulan = namaBulan($("k-bulan").value);
    el.value = "Honorarium " + (jab || "PJLP") + " bulan " + bulan + (nama ? " a.n. " + nama : "");
  }

  function render() {
    $("p-instansi").textContent = $("k-instansi").value || "";
    $("p-alamat").textContent = $("k-alamat").value || "";
    $("p-nomor").textContent = $("k-nomor").value.trim() ? "Nomor: " + $("k-nomor").value.trim() : "";
    $("p-dari").textContent = $("k-dari").value || "-";
    $("p-uraian").textContent = $("k-uraian").value || "-";

    var nilai = Number(String($("k-nilai").value).replace(/[^\d]/g, "")) || 0;
    var tb = nilai > 0 ? (terbilang(nilai) + " rupiah") : "-";
    $("p-terbilang").textContent = tb;
    $("k-terbilang-info").textContent = nilai > 0 ? ("Terbilang: " + tb) : "";
    $("p-rp").textContent = rupiah(nilai) + ",-";

    $("p-kotatgl").textContent = ($("k-kota").value.trim() ? $("k-kota").value.trim() : "") + ", " + fmtTanggal($("k-tgl").value || hariIni());
    $("p-ttd-nama").textContent = $("k-nama").value || "(.................)";
    $("p-ttd-jabatan").textContent = $("k-jabatan").value || "";
    $("p-ttd-nip").textContent = $("k-nip").value ? "NIP. " + $("k-nip").value : "";
  }

  document.querySelectorAll("#form-ku input, #form-ku textarea").forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
  ["k-nama", "k-jabatan", "k-bulan"].forEach(function (id) {
    $(id).addEventListener("change", function () { isiUraianDefault(); render(); });
  });
  $("btn-cetak").addEventListener("click", function () { render(); window.print(); });

  $("k-bulan").value = bulanIni();
  $("k-tgl").value = hariIni();

  /* ---------- Mode Admin: kuitansi untuk PJLP lain yg dipilih di panel admin ---------- */
  var adminPw = sessionStorage.getItem("pjlp_admin_pw") || "";
  var targetNip = sessionStorage.getItem("pjlp_target_nip") || "";
  var targetNama = sessionStorage.getItem("pjlp_target_nama") || "";
  var modeAdmin = !!(adminPw && targetNip);

  if (typeof API !== "undefined" && !API.belumDikonfigurasi()) {
    if (modeAdmin) {
      $("banner-admin").classList.remove("hidden");
      $("banner-admin-nama").textContent = targetNama;
      if (targetNama && !$("k-nama").value) $("k-nama").value = targetNama;
      if (targetNip && !$("k-nip").value) $("k-nip").value = targetNip;

      API.post({ action: "adminDataMaster", password: adminPw, email: sessionStorage.getItem("pjlp_admin_email") || "" })
        .then(function (res) {
          if (!res || res.status !== "success") return;
          var m = (res.master || []).filter(function (x) { return x.nip === targetNip; })[0];
          if (m && m.jabatan2026 && $("k-jabatan").value === "PJLP") $("k-jabatan").value = m.jabatan2026;
          isiUraianDefault(); render();
        }).catch(function () {});
    } else {
      // Mode mandiri: hanya nama/NIP milik perangkat sendiri (tanpa data sensitif)
      API.post({ action: "cekPerangkat" }).then(function (res) {
        if (res && res.status === "success" && res.terdaftar) {
          if (res.nama && !$("k-nama").value) $("k-nama").value = res.nama;
          if (res.nip && !$("k-nip").value) $("k-nip").value = res.nip;
          isiUraianDefault(); render();
        }
      }).catch(function () {});
    }
  }

  isiUraianDefault();
  render();
})();
