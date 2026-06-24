/* ============================================================
   Logika halaman rekap (rekap.html)
   ============================================================ */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const info = $("info");
  const tbody = $("tbody");

  let semuaData = [];

  function fmtTanggal(v) {
    // Apps Script bisa mengirim string ISO atau "yyyy-MM-dd"
    if (!v) return "";
    return String(v).substring(0, 10);
  }

  function getField(row, kandidat) {
    for (const k of kandidat) {
      if (row[k] !== undefined && row[k] !== "") return row[k];
    }
    return "";
  }

  function render(data) {
    tbody.innerHTML = "";
    if (!data.length) {
      info.textContent = "Tidak ada data untuk filter ini.";
      info.className = "status muted";
      return;
    }
    info.textContent = `Menampilkan ${data.length} baris.`;
    info.className = "status muted";

    const rows = data.map((row) => {
      const tanggal = fmtTanggal(getField(row, ["Tanggal"]));
      const jam = getField(row, ["Jam"]);
      const nama = getField(row, ["Nama"]);
      const nip = getField(row, ["NIP/ID", "NIP", "ID"]);
      const jenis = getField(row, ["Jenis"]);
      const linkLok = getField(row, ["Link Lokasi"]);
      const foto = getField(row, ["Foto"]);
      const ket = getField(row, ["Keterangan"]);

      const badge = jenis.toLowerCase() === "pulang" ? "pulang" : "masuk";
      const lokHtml = linkLok ? `<a href="${linkLok}" target="_blank" rel="noopener">Peta</a>` : "-";
      const fotoHtml = foto ? `<a href="${foto}" target="_blank" rel="noopener">Lihat</a>` : "-";

      return `<tr>
        <td>${tanggal}</td>
        <td>${jam}</td>
        <td>${nama}</td>
        <td>${nip}</td>
        <td><span class="badge ${badge}">${jenis}</span></td>
        <td>${lokHtml}</td>
        <td>${fotoHtml}</td>
        <td>${ket}</td>
      </tr>`;
    });
    tbody.innerHTML = rows.join("");
  }

  function terapkanFilter() {
    const nama = $("f-nama").value.trim().toLowerCase();
    const dari = $("f-dari").value;
    const sampai = $("f-sampai").value;

    const hasil = semuaData.filter((row) => {
      const rNama = String(getField(row, ["Nama"])).toLowerCase();
      const rTgl = fmtTanggal(getField(row, ["Tanggal"]));
      if (nama && !rNama.includes(nama)) return false;
      if (dari && rTgl < dari) return false;
      if (sampai && rTgl > sampai) return false;
      return true;
    });
    render(hasil);
    return hasil;
  }

  function muatData() {
    if (CONFIG.APPS_SCRIPT_URL.indexOf("GANTI_DENGAN") === 0) {
      info.textContent = "Aplikasi belum dikonfigurasi. Isi APPS_SCRIPT_URL di js/config.js.";
      info.className = "status err";
      return;
    }
    info.textContent = "Memuat data...";
    info.className = "status muted";

    fetch(CONFIG.APPS_SCRIPT_URL)
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success") {
          semuaData = res.data || [];
          terapkanFilter();
        } else {
          info.textContent = "Gagal memuat: " + (res.message || "kesalahan");
          info.className = "status err";
        }
      })
      .catch((err) => {
        info.textContent = "Gagal memuat data: " + err.message;
        info.className = "status err";
      });
  }

  /* ---------- Ekspor CSV ---------- */
  function eksporCSV() {
    const data = terapkanFilter();
    if (!data.length) { alert("Tidak ada data untuk diekspor."); return; }

    const header = ["Tanggal", "Jam", "Nama", "NIP/ID", "Jenis", "Latitude", "Longitude", "Link Lokasi", "Foto", "Keterangan"];
    const baris = data.map((row) => [
      fmtTanggal(getField(row, ["Tanggal"])),
      getField(row, ["Jam"]),
      getField(row, ["Nama"]),
      getField(row, ["NIP/ID", "NIP", "ID"]),
      getField(row, ["Jenis"]),
      getField(row, ["Latitude"]),
      getField(row, ["Longitude"]),
      getField(row, ["Link Lokasi"]),
      getField(row, ["Foto"]),
      getField(row, ["Keterangan"])
    ]);

    const csv = [header, ...baris]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rekap-absensi-pjlp.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Event ---------- */
  $("btn-refresh").addEventListener("click", muatData);
  $("btn-ekspor").addEventListener("click", eksporCSV);
  $("f-nama").addEventListener("input", terapkanFilter);
  $("f-dari").addEventListener("change", terapkanFilter);
  $("f-sampai").addEventListener("change", terapkanFilter);

  muatData();
})();
