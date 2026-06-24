/* ============================================================
   Logika halaman absen (index.html)
   Alur: cek perangkat -> (daftar / pending / blokir / absen)
   Absen: jenis & status waktu otomatis di server, tanpa foto.
   Jurnal Kegiatan: wajib deskripsi + foto.
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const deviceId = getDeviceId();

  const elJamTime = document.querySelector(".clock-time");
  const elJamDate = document.querySelector(".clock-date");
  const pesan = $("pesan");

  const seksi = {
    loading: $("seksi-loading"),
    daftar: $("seksi-daftar"),
    pending: $("seksi-pending"),
    blokir: $("seksi-blokir"),
    absen: $("seksi-absen")
  };

  // State
  let lokasiAbsen = null;   // {lat,lng,akurasi}
  let lokasiJurnal = null;
  let fotoJurnal = null;

  $("device-id-singkat").textContent = deviceId.slice(0, 8) + "…";

  /* ---------- Jam berjalan ---------- */
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function waktuLokal() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + CONFIG.OFFSET_JAM * 3600000);
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function updateJam() {
    const d = waktuLokal();
    elJamTime.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " " + CONFIG.LABEL_ZONA;
    elJamDate.textContent = HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
  }
  updateJam();
  setInterval(updateJam, 1000);

  /* ---------- Util tampilan ---------- */
  function tampil(nama) {
    Object.keys(seksi).forEach(function (k) { seksi[k].classList.toggle("hidden", k !== nama); });
  }
  function tampilkanPesan(teks, ok) {
    pesan.textContent = teks;
    pesan.className = "pesan " + (ok ? "ok" : "err");
    pesan.classList.remove("hidden");
  }

  /* ---------- Ambil lokasi (dipakai absen & jurnal) ---------- */
  function ambilLokasi(elStatus, btn, simpan) {
    if (!navigator.geolocation) {
      elStatus.textContent = "Browser tidak mendukung GPS.";
      elStatus.className = "status err";
      return;
    }
    elStatus.textContent = "Mengambil lokasi...";
    elStatus.className = "status muted";
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const lok = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: Math.round(pos.coords.accuracy) };
        simpan(lok);
        elStatus.innerHTML = "✔ Lokasi terekam (akurasi ±" + lok.akurasi + " m). " +
          '<a href="https://maps.google.com/?q=' + lok.lat + "," + lok.lng + '" target="_blank" rel="noopener">Lihat peta</a>';
        elStatus.className = "status ok";
        btn.disabled = false;
      },
      function (err) {
        elStatus.textContent = "Gagal mengambil lokasi: " + err.message;
        elStatus.className = "status err";
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  /* ---------- Kompres foto ---------- */
  function kompresGambar(dataUrl, maxLebar, kualitas, cb) {
    const img = new Image();
    img.onload = function () {
      const skala = Math.min(1, maxLebar / img.width);
      const w = Math.round(img.width * skala);
      const h = Math.round(img.height * skala);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL("image/jpeg", kualitas));
    };
    img.src = dataUrl;
  }

  /* ---------- Cek status perangkat ---------- */
  function cekStatus() {
    if (API.belumDikonfigurasi()) {
      seksi.loading.textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL di js/config.js).";
      seksi.loading.className = "status err center";
      return;
    }
    tampil("loading");
    seksi.loading.textContent = "Memeriksa status perangkat...";
    seksi.loading.className = "status muted center";

    API.post({ action: "cekPerangkat", deviceId: deviceId })
      .then(function (res) {
        if (res.status !== "success") throw new Error(res.message || "gagal");
        if (res.jamMasuk && res.jamPulang) {
          $("info-jam-kerja").textContent = "Jam kerja: masuk " + res.jamMasuk + " • pulang " + res.jamPulang +
            " (jenis & status dicatat otomatis)";
        }
        if (!res.terdaftar) { tampil("daftar"); return; }
        if (res.deviceStatus === "disetujui") {
          $("absen-nama").textContent = res.nama || "";
          $("absen-nip").textContent = res.nip ? "• " + res.nip : "";
          tampil("absen");
        } else if (res.deviceStatus === "pending") {
          $("pending-nama").textContent = res.nama || "";
          tampil("pending");
        } else {
          tampil("blokir");
        }
      })
      .catch(function (err) {
        seksi.loading.textContent = "Gagal memeriksa status: " + err.message;
        seksi.loading.className = "status err center";
        tampil("loading");
      });
  }

  /* ---------- Pendaftaran perangkat ---------- */
  $("form-daftar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const nama = $("d-nama").value.trim();
    if (!nama) { tampilkanPesan("Nama wajib diisi.", false); return; }
    const btn = $("btn-daftar");
    btn.disabled = true; btn.textContent = "Mengirim...";
    API.post({ action: "daftarPerangkat", deviceId: deviceId, nama: nama, nip: $("d-nip").value.trim() })
      .then(function (res) {
        if (res.status === "success") {
          $("pending-nama").textContent = nama;
          tampil("pending");
          pesan.classList.add("hidden");
        } else {
          tampilkanPesan("Gagal: " + (res.message || "kesalahan"), false);
        }
      })
      .catch(function (err) { tampilkanPesan("Gagal mendaftar: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Daftarkan Perangkat"; });
  });

  $("btn-cek-ulang").addEventListener("click", cekStatus);
  $("btn-cek-ulang2").addEventListener("click", cekStatus);

  /* ---------- Tab Absen / Jurnal ---------- */
  document.querySelectorAll("#seksi-absen .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll("#seksi-absen .tab").forEach(function (x) { x.classList.remove("aktif"); });
      t.classList.add("aktif");
      const pane = t.getAttribute("data-pane");
      $("pane-absen").classList.toggle("hidden", pane !== "pane-absen");
      $("pane-jurnal").classList.toggle("hidden", pane !== "pane-jurnal");
      pesan.classList.add("hidden");
    });
  });

  /* ---------- ABSEN ---------- */
  $("btn-lokasi").addEventListener("click", function () {
    ambilLokasi($("status-lokasi"), $("btn-lokasi"), function (l) { lokasiAbsen = l; });
  });

  $("form-absen").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const btn = $("btn-submit");
    btn.disabled = true; btn.textContent = "Mengirim...";
    pesan.classList.add("hidden");

    API.post({
      action: "absen",
      deviceId: deviceId,
      lat: lokasiAbsen ? lokasiAbsen.lat : "",
      lng: lokasiAbsen ? lokasiAbsen.lng : "",
      akurasi: lokasiAbsen ? lokasiAbsen.akurasi : "",
      keterangan: $("keterangan").value.trim()
    })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          lokasiAbsen = null;
          $("keterangan").value = "";
          $("status-lokasi").textContent = "Lokasi belum diambil.";
          $("status-lokasi").className = "status muted";
        } else {
          tampilkanPesan(res.message || "Gagal mencatat absen.", false);
          if (res.code && res.code !== "disetujui") cekStatus();
        }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Kirim Absen"; });
  });

  /* ---------- JURNAL ---------- */
  const inputJFoto = $("j-foto");
  $("btn-j-foto").addEventListener("click", function () { inputJFoto.click(); });
  inputJFoto.addEventListener("change", function () {
    const file = inputJFoto.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      kompresGambar(e.target.result, 1000, 0.7, function (dataUrl) {
        fotoJurnal = dataUrl;
        $("j-preview").src = dataUrl;
        $("j-preview-wrap").classList.remove("hidden");
        $("btn-j-foto").textContent = "Ganti Foto";
      });
    };
    reader.readAsDataURL(file);
  });

  $("btn-j-lokasi").addEventListener("click", function () {
    ambilLokasi($("j-status-lokasi"), $("btn-j-lokasi"), function (l) { lokasiJurnal = l; });
  });

  $("form-jurnal").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const kegiatan = $("j-kegiatan").value.trim();
    if (!kegiatan) { tampilkanPesan("Deskripsi kegiatan wajib diisi.", false); return; }
    if (!fotoJurnal) { tampilkanPesan("Foto kegiatan wajib diambil.", false); return; }

    const btn = $("btn-j-submit");
    btn.disabled = true; btn.textContent = "Menyimpan...";
    pesan.classList.add("hidden");

    API.post({
      action: "jurnal",
      deviceId: deviceId,
      kegiatan: kegiatan,
      foto: fotoJurnal,
      lat: lokasiJurnal ? lokasiJurnal.lat : "",
      lng: lokasiJurnal ? lokasiJurnal.lng : ""
    })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          fotoJurnal = null; lokasiJurnal = null;
          $("j-kegiatan").value = "";
          $("j-preview-wrap").classList.add("hidden");
          $("btn-j-foto").textContent = "Ambil / Pilih Foto";
          $("j-status-lokasi").textContent = "Lokasi belum diambil.";
          $("j-status-lokasi").className = "status muted";
        } else {
          tampilkanPesan(res.message || "Gagal menyimpan jurnal.", false);
          if (res.code && res.code !== "disetujui") cekStatus();
        }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Simpan Jurnal"; });
  });

  /* ---------- Mulai ---------- */
  cekStatus();
})();
