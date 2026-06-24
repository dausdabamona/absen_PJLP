/* ============================================================
   Halaman absen (index.html) — identitas berbasis perangkat
   Cek perangkat -> (daftar / pending / blokir / absen).
   Absen: jenis & status otomatis di server, tanpa foto.
   Jurnal: wajib foto + deskripsi. Pengingat jurnal tiap N menit.
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

  let lokasiAbsen = null, lokasiJurnal = null, fotoJurnal = null;
  let reminderTimer = null;

  $("device-id-singkat").textContent = deviceId.slice(0, 8) + "…";

  /* ---------- Jam ---------- */
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  function waktuLokal() { const n = new Date(); return new Date(n.getTime() + n.getTimezoneOffset() * 60000 + CONFIG.OFFSET_JAM * 3600000); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function updateJam() {
    const d = waktuLokal();
    elJamTime.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " " + CONFIG.LABEL_ZONA;
    elJamDate.textContent = HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
  }
  updateJam(); setInterval(updateJam, 1000);

  /* ---------- Util ---------- */
  function tampil(nama) { Object.keys(seksi).forEach(function (k) { seksi[k].classList.toggle("hidden", k !== nama); }); }
  function tampilkanPesan(teks, ok) { pesan.textContent = teks; pesan.className = "pesan " + (ok ? "ok" : "err"); pesan.classList.remove("hidden"); }

  function ambilLokasi(elStatus, btn, simpan) {
    if (!navigator.geolocation) { elStatus.textContent = "Browser tidak mendukung GPS."; elStatus.className = "status err"; return; }
    elStatus.textContent = "Mengambil lokasi..."; elStatus.className = "status muted"; btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const lok = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: Math.round(pos.coords.accuracy) };
        simpan(lok);
        elStatus.innerHTML = "✔ Lokasi terekam (±" + lok.akurasi + " m). " +
          '<a href="https://maps.google.com/?q=' + lok.lat + "," + lok.lng + '" target="_blank" rel="noopener">Lihat peta</a>';
        elStatus.className = "status ok"; btn.disabled = false;
      },
      function (err) { elStatus.textContent = "Gagal mengambil lokasi: " + err.message; elStatus.className = "status err"; btn.disabled = false; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }
  function kompresGambar(dataUrl, maxLebar, kualitas, cb) {
    const img = new Image();
    img.onload = function () {
      const skala = Math.min(1, maxLebar / img.width), w = Math.round(img.width * skala), h = Math.round(img.height * skala);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(c.toDataURL("image/jpeg", kualitas));
    };
    img.src = dataUrl;
  }

  /* ---------- Cek perangkat ---------- */
  function cekStatus() {
    if (API.belumDikonfigurasi()) {
      seksi.loading.textContent = "Aplikasi belum dikonfigurasi (APPS_SCRIPT_URL di js/config.js).";
      seksi.loading.className = "status err center"; return;
    }
    tampil("loading");
    seksi.loading.textContent = "Memeriksa status perangkat..."; seksi.loading.className = "status muted center";
    API.post({ action: "cekPerangkat" })
      .then(function (res) {
        if (res.status !== "success") throw new Error(res.message || "gagal");
        if (res.jamMasuk && res.jamPulang) {
          $("info-jam-kerja").textContent = "Jam kerja: masuk " + res.jamMasuk + " • pulang " + res.jamPulang + " (jenis & status otomatis)";
        }
        if (!res.terdaftar) { tampil("daftar"); return; }
        if (res.deviceStatus === "disetujui") {
          $("absen-nama").textContent = res.nama || "";
          $("absen-nip").textContent = res.nip ? "• " + res.nip : "";
          tampil("absen"); mulaiReminder();
        } else if (res.deviceStatus === "pending") {
          $("pending-nama").textContent = res.nama || ""; tampil("pending");
        } else { tampil("blokir"); }
      })
      .catch(function (err) {
        seksi.loading.textContent = "Gagal memeriksa status: " + err.message;
        seksi.loading.className = "status err center"; tampil("loading");
      });
  }

  /* ---------- Daftar ---------- */
  $("form-daftar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const nama = $("d-nama").value.trim();
    if (!nama) { tampilkanPesan("Nama wajib diisi.", false); return; }
    const btn = $("btn-daftar"); btn.disabled = true; btn.textContent = "Mengirim...";
    API.post({ action: "daftarPerangkat", nama: nama, nip: $("d-nip").value.trim() })
      .then(function (res) {
        if (res.status === "success") { $("pending-nama").textContent = nama; tampil("pending"); pesan.classList.add("hidden"); }
        else tampilkanPesan("Gagal: " + (res.message || "kesalahan"), false);
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

  /* ---------- Absen ---------- */
  $("btn-lokasi").addEventListener("click", function () { ambilLokasi($("status-lokasi"), $("btn-lokasi"), function (l) { lokasiAbsen = l; }); });
  $("form-absen").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const btn = $("btn-submit"); btn.disabled = true; btn.textContent = "Mengirim..."; pesan.classList.add("hidden");
    API.post({ action: "absen", lat: lokasiAbsen ? lokasiAbsen.lat : "", lng: lokasiAbsen ? lokasiAbsen.lng : "", akurasi: lokasiAbsen ? lokasiAbsen.akurasi : "", keterangan: $("keterangan").value.trim() })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          lokasiAbsen = null; $("keterangan").value = "";
          $("status-lokasi").textContent = "Lokasi belum diambil."; $("status-lokasi").className = "status muted";
        } else { tampilkanPesan(res.message || "Gagal mencatat absen.", false); if (res.code && res.code !== "disetujui") cekStatus(); }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Kirim Absen"; });
  });

  /* ---------- Jurnal ---------- */
  const inputJFoto = $("j-foto");
  $("btn-j-foto").addEventListener("click", function () { inputJFoto.click(); });
  inputJFoto.addEventListener("change", function () {
    const file = inputJFoto.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      kompresGambar(e.target.result, 1000, 0.7, function (dataUrl) {
        fotoJurnal = dataUrl; $("j-preview").src = dataUrl;
        $("j-preview-wrap").classList.remove("hidden"); $("btn-j-foto").textContent = "Ganti Foto";
      });
    };
    reader.readAsDataURL(file);
  });
  $("btn-j-lokasi").addEventListener("click", function () { ambilLokasi($("j-status-lokasi"), $("btn-j-lokasi"), function (l) { lokasiJurnal = l; }); });
  $("form-jurnal").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const kegiatan = $("j-kegiatan").value.trim();
    if (!kegiatan) { tampilkanPesan("Deskripsi kegiatan wajib diisi.", false); return; }
    if (!fotoJurnal) { tampilkanPesan("Foto kegiatan wajib diambil.", false); return; }
    const btn = $("btn-j-submit"); btn.disabled = true; btn.textContent = "Menyimpan..."; pesan.classList.add("hidden");
    API.post({ action: "jurnal", kegiatan: kegiatan, foto: fotoJurnal, lat: lokasiJurnal ? lokasiJurnal.lat : "", lng: lokasiJurnal ? lokasiJurnal.lng : "" })
      .then(function (res) {
        if (res.status === "success") {
          tampilkanPesan("✔ " + res.message, true);
          fotoJurnal = null; lokasiJurnal = null; $("j-kegiatan").value = "";
          $("j-preview-wrap").classList.add("hidden"); $("btn-j-foto").textContent = "Ambil / Pilih Foto";
          $("j-status-lokasi").textContent = "Lokasi belum diambil."; $("j-status-lokasi").className = "status muted";
          tandaiJurnalTerisi();
        } else { tampilkanPesan(res.message || "Gagal menyimpan jurnal.", false); if (res.code && res.code !== "disetujui") cekStatus(); }
      })
      .catch(function (err) { tampilkanPesan("Gagal mengirim: " + err.message, false); })
      .finally(function () { btn.disabled = false; btn.textContent = "Simpan Jurnal"; });
  });

  /* ---------- Pengingat jurnal ---------- */
  const INTERVAL_MS = (CONFIG.INTERVAL_JURNAL_MENIT || 120) * 60000;
  function keyJurnal() { return "pjlp_last_jurnal_" + deviceId; }
  function tandaiJurnalTerisi() { localStorage.setItem(keyJurnal(), String(Date.now())); $("reminder-banner").classList.add("hidden"); updateReminderStatus(); }
  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination); o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.1;
      o.start(); setTimeout(function () { o.stop(); ac.close(); }, 500);
    } catch (e) { /* abaikan */ }
  }
  function notify() {
    const teks = "Saatnya mengisi Jurnal Kegiatan.";
    $("reminder-banner").textContent = "🔔 " + teks; $("reminder-banner").classList.remove("hidden");
    if ("Notification" in window && Notification.permission === "granted") { try { new Notification("Pengingat Jurnal PJLP", { body: teks, tag: "jurnal-pjlp" }); } catch (e) { } }
    beep();
  }
  function updateReminderStatus() {
    const last = parseInt(localStorage.getItem(keyJurnal()) || "0", 10) || Date.now();
    const menit = Math.ceil(Math.max(0, INTERVAL_MS - (Date.now() - last)) / 60000);
    $("reminder-status").textContent = "⏰ Pengingat jurnal tiap " + CONFIG.INTERVAL_JURNAL_MENIT + " menit" + (menit > 0 ? " · berikutnya ±" + menit + " menit lagi" : " · sekarang!");
  }
  function cekReminder() {
    const last = parseInt(localStorage.getItem(keyJurnal()) || "0", 10);
    if (!last) { localStorage.setItem(keyJurnal(), String(Date.now())); updateReminderStatus(); return; }
    if (Date.now() - last >= INTERVAL_MS) notify();
    updateReminderStatus();
  }
  function mulaiReminder() {
    if (reminderTimer) return;
    if (!localStorage.getItem(keyJurnal())) localStorage.setItem(keyJurnal(), String(Date.now()));
    if ("Notification" in window && Notification.permission === "default") { try { Notification.requestPermission(); } catch (e) { } }
    updateReminderStatus(); cekReminder();
    reminderTimer = setInterval(cekReminder, 60000);
  }

  /* ---------- Mulai ---------- */
  cekStatus();
})();
