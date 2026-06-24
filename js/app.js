/* ============================================================
   Logika halaman absen (index.html)
   ============================================================ */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elJamTime = document.querySelector(".clock-time");
  const elJamDate = document.querySelector(".clock-date");
  const form = $("form-absen");
  const btnLokasi = $("btn-lokasi");
  const statusLokasi = $("status-lokasi");
  const btnFoto = $("btn-foto");
  const inputFoto = $("foto");
  const previewWrap = $("preview-wrap");
  const preview = $("preview");
  const btnSubmit = $("btn-submit");
  const pesan = $("pesan");

  // State lokasi & foto
  let lokasi = null;     // { lat, lng, akurasi }
  let fotoBase64 = null; // string data URL terkompresi

  /* ---------- Jam berjalan ---------- */
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  function waktuLokal() {
    // Hitung waktu sesuai OFFSET_JAM agar konsisten lintas perangkat
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + CONFIG.OFFSET_JAM * 3600000);
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function updateJam() {
    const d = waktuLokal();
    elJamTime.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${CONFIG.LABEL_ZONA}`;
    elJamDate.textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  }
  updateJam();
  setInterval(updateJam, 1000);

  /* ---------- Lokasi GPS ---------- */
  function hitungJarak(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meter
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  btnLokasi.addEventListener("click", function () {
    if (!navigator.geolocation) {
      statusLokasi.textContent = "Browser tidak mendukung GPS.";
      statusLokasi.className = "status err";
      return;
    }
    statusLokasi.textContent = "Mengambil lokasi...";
    statusLokasi.className = "status muted";
    btnLokasi.disabled = true;

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        lokasi = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          akurasi: Math.round(pos.coords.accuracy)
        };
        let teks = `✔ Lokasi terekam (akurasi ±${lokasi.akurasi} m).`;
        let kelas = "status ok";

        if (CONFIG.AKTIFKAN_VALIDASI_RADIUS) {
          const jarak = hitungJarak(
            lokasi.lat, lokasi.lng,
            CONFIG.LOKASI_KANTOR.lat, CONFIG.LOKASI_KANTOR.lng
          );
          if (jarak > CONFIG.LOKASI_KANTOR.radiusMeter) {
            teks = `⚠ Anda ±${Math.round(jarak)} m dari kantor (di luar radius ${CONFIG.LOKASI_KANTOR.radiusMeter} m).`;
            kelas = "status err";
            lokasi.diLuarRadius = true;
          } else {
            teks += ` Dalam radius kantor (±${Math.round(jarak)} m).`;
          }
        }
        statusLokasi.innerHTML = teks +
          ` <a href="https://maps.google.com/?q=${lokasi.lat},${lokasi.lng}" target="_blank" rel="noopener">Lihat peta</a>`;
        statusLokasi.className = kelas;
        btnLokasi.disabled = false;
      },
      function (err) {
        statusLokasi.textContent = "Gagal mengambil lokasi: " + err.message;
        statusLokasi.className = "status err";
        btnLokasi.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  /* ---------- Foto ---------- */
  btnFoto.addEventListener("click", () => inputFoto.click());

  inputFoto.addEventListener("change", function () {
    const file = inputFoto.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      kompresGambar(e.target.result, 800, 0.7, function (dataUrl) {
        fotoBase64 = dataUrl;
        preview.src = dataUrl;
        previewWrap.classList.remove("hidden");
        btnFoto.textContent = "Ganti Foto";
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
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL("image/jpeg", kualitas));
    };
    img.src = dataUrl;
  }

  /* ---------- Submit ---------- */
  function tampilkanPesan(teks, ok) {
    pesan.textContent = teks;
    pesan.className = "pesan " + (ok ? "ok" : "err");
    pesan.classList.remove("hidden");
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();

    if (CONFIG.APPS_SCRIPT_URL.indexOf("GANTI_DENGAN") === 0) {
      tampilkanPesan("Aplikasi belum dikonfigurasi. Isi APPS_SCRIPT_URL di js/config.js.", false);
      return;
    }

    const nama = $("nama").value.trim();
    if (!nama) { tampilkanPesan("Nama wajib diisi.", false); return; }
    if (!lokasi) { tampilkanPesan("Ambil lokasi GPS terlebih dahulu.", false); return; }
    if (!fotoBase64) { tampilkanPesan("Ambil foto terlebih dahulu.", false); return; }

    const data = {
      nama: nama,
      nip: $("nip").value.trim(),
      jenis: form.jenis.value,
      lat: lokasi.lat,
      lng: lokasi.lng,
      akurasi: lokasi.akurasi,
      foto: fotoBase64,
      keterangan: $("keterangan").value.trim()
    };

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Mengirim...";
    pesan.classList.add("hidden");

    fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      // text/plain = "simple request" agar tidak terblokir CORS preflight
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success") {
          tampilkanPesan("✔ " + (res.message || "Absen berhasil dicatat."), true);
          form.reset();
          lokasi = null;
          fotoBase64 = null;
          previewWrap.classList.add("hidden");
          btnFoto.textContent = "Ambil / Pilih Foto";
          statusLokasi.textContent = "Lokasi belum diambil.";
          statusLokasi.className = "status muted";
        } else {
          tampilkanPesan("Gagal: " + (res.message || "kesalahan tidak diketahui"), false);
        }
      })
      .catch((err) => {
        tampilkanPesan("Gagal mengirim: " + err.message, false);
      })
      .finally(() => {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Kirim Absen";
      });
  });
})();
