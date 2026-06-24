/* ============================================================
   Rekap (rekap.html) — data perangkat sendiri; admin (password)
   bisa melihat semua. Filter server-side per Device ID.
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const info = $("info"), theadRow = $("thead-row"), tbody = $("tbody");

  let mode = "absensi";
  let semuaData = [];

  const KOLOM = {
    absensi: [
      { judul: "Tanggal", get: function (r) { return tgl(r["Tanggal"]); } },
      { judul: "Jam", get: function (r) { return f(r, ["Jam"]); } },
      { judul: "Nama", get: function (r) { return f(r, ["Nama"]); } },
      { judul: "Jenis", get: function (r) { return badge(f(r, ["Jenis"])); }, raw: function (r) { return f(r, ["Jenis"]); } },
      { judul: "Status Waktu", get: function (r) { return f(r, ["Status Waktu"]); } },
      { judul: "Lokasi", get: function (r) { return link(f(r, ["Link Lokasi"]), "Peta"); }, raw: function (r) { return f(r, ["Link Lokasi"]); } },
      { judul: "Keterangan", get: function (r) { return f(r, ["Keterangan"]); } }
    ],
    jurnal: [
      { judul: "Tanggal", get: function (r) { return tgl(r["Tanggal"]); } },
      { judul: "Jam", get: function (r) { return f(r, ["Jam"]); } },
      { judul: "Nama", get: function (r) { return f(r, ["Nama"]); } },
      { judul: "Kegiatan", get: function (r) { return f(r, ["Kegiatan"]); } },
      { judul: "Foto", get: function (r) { return link(f(r, ["Foto"]), "Lihat"); }, raw: function (r) { return f(r, ["Foto"]); } },
      { judul: "Lokasi", get: function (r) { return link(f(r, ["Link Lokasi"]), "Peta"); }, raw: function (r) { return f(r, ["Link Lokasi"]); } }
    ]
  };
  const HTML_COLS = { "Jenis": 1, "Lokasi": 1, "Foto": 1 };

  function tgl(v) { return v ? String(v).substring(0, 10) : ""; }
  function f(row, kandidat) { for (var i = 0; i < kandidat.length; i++) { var k = kandidat[i]; if (row[k] !== undefined && row[k] !== "") return String(row[k]); } return ""; }
  function badge(j) { if (!j) return ""; var cls = j.toLowerCase() === "pulang" ? "pulang" : "masuk"; return '<span class="badge ' + cls + '">' + esc(j) + "</span>"; }
  function link(url, teks) { return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + teks + "</a>" : "-"; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function render(data) {
    const kolom = KOLOM[mode];
    theadRow.innerHTML = kolom.map(function (k) { return "<th>" + k.judul + "</th>"; }).join("");
    if (!data.length) { tbody.innerHTML = ""; info.textContent = "Tidak ada data untuk filter ini."; return; }
    info.textContent = "Menampilkan " + data.length + " baris.";
    tbody.innerHTML = data.map(function (row) {
      return "<tr>" + kolom.map(function (k) {
        const isi = k.get(row);
        return HTML_COLS[k.judul] ? "<td>" + isi + "</td>" : "<td>" + esc(isi) + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }

  function terapkanFilter() {
    const nama = $("f-nama").value.trim().toLowerCase(), dari = $("f-dari").value, sampai = $("f-sampai").value;
    const hasil = semuaData.filter(function (row) {
      const rNama = f(row, ["Nama"]).toLowerCase(), rTgl = tgl(f(row, ["Tanggal"]));
      if (nama && rNama.indexOf(nama) === -1) return false;
      if (dari && rTgl < dari) return false;
      if (sampai && rTgl > sampai) return false;
      return true;
    });
    render(hasil); return hasil;
  }

  function muatData() {
    if (API.belumDikonfigurasi()) { info.textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL)."; info.className = "status err"; return; }
    info.textContent = "Memuat data..."; info.className = "status muted";
    API.post({ action: mode === "jurnal" ? "rekapJurnal" : "rekapAbsensi", adminPassword: $("f-admin").value })
      .then(function (res) {
        if (res.status === "success") {
          $("badge-admin").classList.toggle("hidden", !res.isAdmin);
          semuaData = res.data || [];
          terapkanFilter();
        } else { info.textContent = "Gagal memuat: " + (res.message || "kesalahan"); info.className = "status err"; }
      })
      .catch(function (err) { info.textContent = "Gagal memuat data: " + err.message; info.className = "status err"; });
  }

  function eksporCSV() {
    const data = terapkanFilter();
    if (!data.length) { alert("Tidak ada data untuk diekspor."); return; }
    const kolom = KOLOM[mode];
    const header = kolom.map(function (k) { return k.judul; });
    const baris = data.map(function (row) { return kolom.map(function (k) { return k.raw ? k.raw(row) : k.get(row); }); });
    const csv = [header].concat(baris).map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "rekap-" + mode + "-pjlp.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif"); mode = t.getAttribute("data-mode"); muatData();
    });
  });
  $("btn-refresh").addEventListener("click", muatData);
  $("btn-ekspor").addEventListener("click", eksporCSV);
  $("f-nama").addEventListener("input", terapkanFilter);
  $("f-dari").addEventListener("change", terapkanFilter);
  $("f-sampai").addEventListener("change", terapkanFilter);
  $("f-admin").addEventListener("change", muatData);

  muatData();
})();
