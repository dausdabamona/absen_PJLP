/* ============================================================
   Logika halaman absen (index.html)
   Alur: cek perangkat -> (daftar / pending / blokir / absen)
   ============================================================ */

(function () {
  "use strict";

  const $ = function (id) { return document.getElementById(id); };
  const deviceId = getDeviceId();

  // Elemen umum
  const elJamTime = document.querySelector(".clock-time");
  const elJamDate = document.querySelector(".clock-date");
  const pesan = $("pesan");

  // Seksi
  const seksi = {
    loading: $("seksi-loading"),
    daftar: $("seksi-daftar"),
    pending: $("seksi-pending"),
    blokir: $("seksi-blokir"),
    absen: $("seksi-absen")
  };

  // State absen
  let lokasi = null;
  let fotoBase64 = null;

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
    Object.keys(seksi).forEach(function (k) {
      seksi[k].classList.toggle("hidden", k !== nama);
    });
  }
  function tampilkanPesan(teks, ok) {
    pesan.textContent = teks;
    pesan.className = "pesan " + (ok ? "ok" : "err");
    pesan.classList.remove("hidden");
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
        if (res.status !== "success") { throw new Error(res.message || "gagal"); }
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

  /* ---------- Lokasi GPS ---------- */
  $("btn-lokasi").addEventListener("click", function () {
    const statusLokasi = $("status-lokasi");
    const btn = $("btn-lokasi");
    if (!navigator.geolocation) {
      statusLokasi.textContent = "Browser tidak mendukung GPS.";
      statusLokasi.className = "status err";
      return;
    }
    statusLokasi.textContent = "Mengambil lokasi...";
    statusLokasi.className = "status muted";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        lokasi = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          akurasi: Math.round(pos.coords.accuracy)
        };
        statusLokasi.innerHTML = "✔ Lokasi terekam (akurasi ±" + lokasi.akurasi + " m). " +
          '<a href="https://maps.google.com/?q=' + lokasi.lat + "," + lokasi.lng + '" target="_blank" rel="noopener">Lihat peta</a>';
        statusLokasi.className = "status ok";
        btn.disabled = false;
      },
      function (err) {
        statusLokasi.textContent = "Gagal mengambil lokasi: " + err.message;
        statusLokasi.className = "status err";
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  /* ---------- Foto ---------- */
  const inputFoto = $("foto");
  $("btn-foto").addEventListener("click", function () { inputFoto.click(); });
  inputFoto.addEventListener("change", function () {
    const file = inputFoto.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      kompresGambar(e.target.result, 800, 0.7, function (dataUrl) {
        fotoBase64 = dataUrl;
        $("preview").src = dataUrl;
        $("preview-wrap").classList.remove("hidden");
        $("btn-foto").textContent = "Ganti Foto";
      });
    };
    reader.readAsDataURL(file);
  });
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

  /* ---------- Submit absen ---------- */
  $("form-absen").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!lokasi) { tampilkanPesan("Ambil lokasi GPS terlebih dahulu.", false); return; }
    if (!fotoBase64) { tampilkanPesan("Ambil foto terlebih dahulu.", false); return; }

    const btn = $("btn-submit");
    btn.disabled = true; btn.textContent = "Mengirim...";
    pesan.classList.add("hidden");

    API.post({
      action: "absen",
      deviceId: deviceId,
      jenis: document.querySelector('input[name="jenis"]:checked').value,
      lat: lokasi.lat,
      lng: lokasi.lng,
      akurasi: lokasi.akurasi,
      foto: fotoBase64,
      keterangan: $("keterangan").value.trim()
    })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          // reset
          lokasi = null; fotoBase64 = null;
          $("preview-wrap").classList.add("hidden");
          $("btn-foto").textContent = "Ambil / Pilih Foto";
          $("keterangan").value = "";
          $("status-lokasi").textContent = "Lokasi belum diambil.";
          $("status-lokasi").className = "status muted";
        } else {
          tampilkanPesan(res.message || "Gagal mencatat absen.", false);
          // bila status perangkat berubah, segarkan tampilan
          if (res.code && res.code !== "disetujui") { cekStatus(); }
        }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Kirim Absen"; });
  });

  /* ---------- Mulai ---------- */
  cekStatus();
})();
