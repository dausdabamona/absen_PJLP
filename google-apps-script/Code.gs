/* ============================================================
   BACKEND ABSENSI PJLP  —  Google Apps Script
   Identitas berbasis PERANGKAT (tanpa login) + persetujuan admin
   + geofence + jam kerja otomatis + jurnal + rekap per-perangkat
   (admin pakai password untuk melihat semua).
   ------------------------------------------------------------
   PASANG:
   1. Buka Google Sheet > Ekstensi > Apps Script, tempel file ini.
   2. Jalankan fungsi  setup  sekali (izinkan akses).
      -> membuat tab Absensi, Jurnal, Perangkat + password admin.
      -> lihat View > Logs untuk password admin awal (admin123).
   3. Deploy > New deployment > Web app
      (Execute as: Me, Who has access: Anyone) > salin URL /exec
      ke js/config.js.
   Ubah kode -> Deploy > Manage deployments > Edit > New version.
   ============================================================ */

const TZ = "GMT+9"; // WIT
const SHEET_ABSEN = "Absensi";
const SHEET_JURNAL = "Jurnal";
const SHEET_IZIN = "Ketidakhadiran";
const SHEET_PERANGKAT = "Perangkat";
const FOLDER_NAME = "Foto Jurnal PJLP";

const JENIS_IZIN = ["Izin", "Sakit", "Cuti", "Dinas Luar", "Lainnya"];

const HEADER_ABSEN = [
  "Timestamp", "Device ID", "Nama", "NIP/ID", "Jenis", "Status Waktu", "Tanggal", "Jam",
  "Latitude", "Longitude", "Akurasi (m)", "Jarak (m)", "Link Lokasi", "Keterangan"
];
const HEADER_JURNAL = [
  "Timestamp", "Device ID", "Nama", "NIP/ID", "Tanggal", "Jam", "Kegiatan",
  "Foto", "Latitude", "Longitude", "Link Lokasi"
];
const HEADER_IZIN = [
  "Timestamp", "Device ID", "Nama", "NIP/ID", "Jenis", "Tanggal Mulai",
  "Tanggal Selesai", "Alasan", "Foto Surat"
];
const HEADER_PERANGKAT = [
  "Device ID", "Nama", "NIP/ID", "Status", "Didaftarkan", "Diperbarui"
];

const DEFAULT_JAM_MASUK = "07:30";
const DEFAULT_JAM_PULANG = "16:00";
const DEFAULT_BUFFER_MASUK = 60;
const DEFAULT_BUFFER_PULANG = 240;

/* ====================== SETUP ============================== */
function setup() {
  getSheetAbsen();
  getSheetJurnal();
  getSheetIzin();
  getSheetPerangkat();
  const p = props();
  if (!p.getProperty("ADMIN_EMAIL")) p.setProperty("ADMIN_EMAIL", "dausdaba@polikpsorong.ac.id");
  if (!p.getProperty("ADMIN_PASSWORD")) p.setProperty("ADMIN_PASSWORD", "admin123");
  if (!p.getProperty("JAM_MASUK")) p.setProperty("JAM_MASUK", DEFAULT_JAM_MASUK);
  if (!p.getProperty("JAM_PULANG")) p.setProperty("JAM_PULANG", DEFAULT_JAM_PULANG);
  if (!p.getProperty("BUFFER_MASUK")) p.setProperty("BUFFER_MASUK", String(DEFAULT_BUFFER_MASUK));
  if (!p.getProperty("BUFFER_PULANG")) p.setProperty("BUFFER_PULANG", String(DEFAULT_BUFFER_PULANG));
  if (!p.getProperty("ABAIKAN_LOKASI")) p.setProperty("ABAIKAN_LOKASI", "true");
  Logger.log("Setup selesai. Password admin awal: " + p.getProperty("ADMIN_PASSWORD"));
  Logger.log("GANTI password ini lewat panel admin setelah login pertama.");
}

/* ====================== ROUTING =========================== */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case "daftarPerangkat":    return daftarPerangkat(data);
      case "cekPerangkat":       return cekPerangkat(data);
      case "absen":              return absen(data);
      case "jurnal":             return jurnal(data);
      case "izin":               return izin(data);
      case "rekapAbsensi":       return rekapData(data, SHEET_ABSEN);
      case "rekapJurnal":        return rekapData(data, SHEET_JURNAL);
      case "rekapIzin":          return rekapData(data, SHEET_IZIN);
      case "adminLogin":         return adminLogin(data);
      case "adminData":          return adminData(data);
      case "setStatusPerangkat": return setStatusPerangkat(data);
      case "hapusPerangkat":     return hapusPerangkat(data);
      case "simpanPengaturan":   return simpanPengaturan(data);
      default:
        return jsonOutput({ status: "error", message: "Aksi tidak dikenal: " + data.action });
    }
  } catch (err) {
    return jsonOutput({ status: "error", message: String(err && err.message ? err.message : err) });
  }
}

function doGet() { return jsonOutput({ status: "success", message: "API Absensi PJLP aktif." }); }

/* ====================== PERANGKAT ======================== */
function daftarPerangkat(data) {
  if (!data.deviceId || !data.nama) return jsonOutput({ status: "error", message: "Nama & ID perangkat wajib." });
  const ada = cariPerangkat(data.deviceId);
  if (ada) return jsonOutput({ status: "success", deviceStatus: ada.status, message: "Perangkat sudah terdaftar (" + ada.status + ")." });
  const now = new Date();
  getSheetPerangkat().appendRow([String(data.deviceId), String(data.nama).trim(), data.nip || "", "pending", now, now]);
  return jsonOutput({ status: "success", deviceStatus: "pending", message: "Pendaftaran terkirim. Menunggu persetujuan admin." });
}

function cekPerangkat(data) {
  const dev = cariPerangkat(data.deviceId);
  const set = getPengaturan();
  const base = { status: "success", jamMasuk: set.jamMasuk, jamPulang: set.jamPulang };
  if (!dev) return jsonOutput(Object.assign(base, { terdaftar: false }));
  return jsonOutput(Object.assign(base, { terdaftar: true, deviceStatus: dev.status, nama: dev.nama, nip: dev.nip }));
}

/* ====================== ABSEN ============================ */
function absen(data) {
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "error", code: "belum_daftar", message: "Perangkat belum terdaftar." });
  if (dev.status !== "disetujui") return jsonOutput({ status: "error", code: dev.status, message: "Perangkat berstatus '" + dev.status + "'. Hubungi admin." });

  const set = getPengaturan();
  let jarak = "";
  if (!set.abaikanLokasi) {
    if (isNaN(set.lat) || isNaN(set.lng) || !set.radius) return jsonOutput({ status: "error", message: "Lokasi kampus belum diatur oleh admin." });
    if (!data.lat || !data.lng) return jsonOutput({ status: "error", message: "Lokasi GPS wajib diambil." });
    jarak = haversine(data.lat, data.lng, set.lat, set.lng);
    if (jarak > set.radius) return jsonOutput({ status: "error", message: "Absen ditolak: Anda di luar area " + set.namaInstansi + " (±" + Math.round(jarak) + " m, maksimal " + set.radius + " m)." });
  } else if (data.lat && data.lng && !isNaN(set.lat) && !isNaN(set.lng)) {
    jarak = haversine(data.lat, data.lng, set.lat, set.lng);
  }

  const now = new Date();
  const jenis = jenisOtomatis(now, set);
  const statusWaktu = hitungStatusWaktu(now, jenis, set);
  const linkLok = (data.lat && data.lng) ? "https://maps.google.com/?q=" + data.lat + "," + data.lng : "";
  getSheetAbsen().appendRow([
    now, dev.deviceId, dev.nama, dev.nip, jenis, statusWaktu,
    fmt(now, "yyyy-MM-dd"), fmt(now, "HH:mm:ss"),
    data.lat || "", data.lng || "", data.akurasi || "",
    jarak === "" ? "" : Math.round(jarak), linkLok, data.keterangan || ""
  ]);
  const infoJarak = jarak === "" ? "" : ", ±" + Math.round(jarak) + " m dari titik kampus";
  return jsonOutput({ status: "success", message: "Absen " + jenis + " berhasil (" + statusWaktu + infoJarak + ")." });
}

/* ====================== JURNAL =========================== */
function jurnal(data) {
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "error", code: "belum_daftar", message: "Perangkat belum terdaftar." });
  if (dev.status !== "disetujui") return jsonOutput({ status: "error", code: dev.status, message: "Perangkat berstatus '" + dev.status + "'. Hubungi admin." });
  if (!data.kegiatan || !String(data.kegiatan).trim()) return jsonOutput({ status: "error", message: "Deskripsi kegiatan wajib diisi." });
  if (!data.foto) return jsonOutput({ status: "error", message: "Foto kegiatan wajib diambil." });

  const now = new Date();
  const fotoUrl = simpanFoto(data.foto, dev.nama, "jurnal", now);
  const linkLok = (data.lat && data.lng) ? "https://maps.google.com/?q=" + data.lat + "," + data.lng : "";
  getSheetJurnal().appendRow([
    now, dev.deviceId, dev.nama, dev.nip, fmt(now, "yyyy-MM-dd"), fmt(now, "HH:mm:ss"),
    String(data.kegiatan).trim(), fotoUrl, data.lat || "", data.lng || "", linkLok
  ]);
  return jsonOutput({ status: "success", message: "Jurnal kegiatan berhasil disimpan." });
}

/* ====================== IZIN / TIDAK HADIR ============== */
function izin(data) {
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "error", code: "belum_daftar", message: "Perangkat belum terdaftar." });
  if (dev.status !== "disetujui") return jsonOutput({ status: "error", code: dev.status, message: "Perangkat berstatus '" + dev.status + "'. Hubungi admin." });
  if (JENIS_IZIN.indexOf(data.jenis) === -1) return jsonOutput({ status: "error", message: "Jenis ketidakhadiran tidak valid." });
  if (!data.tglMulai) return jsonOutput({ status: "error", message: "Tanggal mulai wajib diisi." });
  if (!data.alasan || !String(data.alasan).trim()) return jsonOutput({ status: "error", message: "Alasan wajib diisi." });
  if (!data.foto) return jsonOutput({ status: "error", message: "Foto surat wajib dilampirkan." });

  const now = new Date();
  const fotoUrl = simpanFoto(data.foto, dev.nama, "surat", now);
  getSheetIzin().appendRow([
    now, dev.deviceId, dev.nama, dev.nip, data.jenis,
    data.tglMulai, data.tglSelesai || data.tglMulai, String(data.alasan).trim(), fotoUrl
  ]);
  return jsonOutput({ status: "success", message: "Pengajuan " + data.jenis + " berhasil dikirim." });
}

/* ====================== REKAP =========================== */
function rekapData(data, namaSheet) {
  const isAdmin = data.adminPassword && data.adminPassword === getAdminPassword();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(namaSheet);
  if (!sheet) return jsonOutput({ status: "success", data: [], isAdmin: !!isAdmin });
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOutput({ status: "success", data: [], isAdmin: !!isAdmin });
  const headers = values.shift();
  const idxDev = headers.indexOf("Device ID");
  let rows = isAdmin ? values : values.filter(function (r) { return String(r[idxDev]) === String(data.deviceId); });
  const out = rows.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      let v = row[i];
      if (v instanceof Date) { v = (h === "Tanggal") ? fmt(v, "yyyy-MM-dd") : (h === "Jam") ? fmt(v, "HH:mm:ss") : fmt(v, "yyyy-MM-dd HH:mm:ss"); }
      obj[h] = v;
    });
    return obj;
  });
  return jsonOutput({ status: "success", data: out, isAdmin: !!isAdmin });
}

/* ====================== ADMIN =========================== */
function adminLogin(data) {
  if (!cekAdmin(data)) return jsonOutput({ status: "error", message: "Email atau password admin salah." });
  return jsonOutput({ status: "success", message: "Login berhasil." });
}

function adminData(data) {
  if (!cekAdmin(data)) return jsonOutput({ status: "error", message: "Email atau password admin salah." });
  return jsonOutput({ status: "success", perangkat: listPerangkat(), pengaturan: getPengaturanPublic() });
}

function setStatusPerangkat(data) {
  if (!cekAdmin(data)) return jsonOutput({ status: "error", message: "Email atau password admin salah." });
  if (["pending", "disetujui", "diblokir"].indexOf(data.statusBaru) === -1) return jsonOutput({ status: "error", message: "Status tidak valid." });
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "error", message: "Perangkat tidak ditemukan." });
  getSheetPerangkat().getRange(dev.rowIndex, 4).setValue(data.statusBaru);
  getSheetPerangkat().getRange(dev.rowIndex, 6).setValue(new Date());
  return jsonOutput({ status: "success", message: "Status diperbarui." });
}

function hapusPerangkat(data) {
  if (!cekAdmin(data)) return jsonOutput({ status: "error", message: "Email atau password admin salah." });
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "error", message: "Perangkat tidak ditemukan." });
  getSheetPerangkat().deleteRow(dev.rowIndex);
  return jsonOutput({ status: "success", message: "Perangkat dihapus." });
}

function simpanPengaturan(data) {
  if (!cekAdmin(data)) return jsonOutput({ status: "error", message: "Email atau password admin salah." });
  const p = props();
  if (data.lat !== undefined && data.lat !== "") p.setProperty("KAMPUS_LAT", String(data.lat));
  if (data.lng !== undefined && data.lng !== "") p.setProperty("KAMPUS_LNG", String(data.lng));
  if (data.radius !== undefined && data.radius !== "") p.setProperty("KAMPUS_RADIUS", String(data.radius));
  if (data.namaInstansi) p.setProperty("NAMA_INSTANSI", data.namaInstansi);
  if (data.jamMasuk && /^\d{1,2}:\d{2}$/.test(data.jamMasuk)) p.setProperty("JAM_MASUK", data.jamMasuk);
  if (data.jamPulang && /^\d{1,2}:\d{2}$/.test(data.jamPulang)) p.setProperty("JAM_PULANG", data.jamPulang);
  if (data.bufferMasuk !== undefined && data.bufferMasuk !== "") p.setProperty("BUFFER_MASUK", String(parseInt(data.bufferMasuk, 10) || 0));
  if (data.bufferPulang !== undefined && data.bufferPulang !== "") p.setProperty("BUFFER_PULANG", String(parseInt(data.bufferPulang, 10) || 0));
  if (data.abaikanLokasi !== undefined) p.setProperty("ABAIKAN_LOKASI", data.abaikanLokasi ? "true" : "false");
  if (data.passwordBaru) {
    if (String(data.passwordBaru).length < 6) return jsonOutput({ status: "error", message: "Password baru minimal 6 karakter." });
    p.setProperty("ADMIN_PASSWORD", String(data.passwordBaru));
  }
  if (data.emailAdminBaru) {
    if (String(data.emailAdminBaru).indexOf("@") === -1) return jsonOutput({ status: "error", message: "Email admin tidak valid." });
    p.setProperty("ADMIN_EMAIL", String(data.emailAdminBaru).trim());
  }
  return jsonOutput({ status: "success", message: "Pengaturan disimpan." });
}

function getAdminPassword() {
  // Default "admin123" walau setup belum dijalankan, agar admin selalu bisa masuk.
  let pw = props().getProperty("ADMIN_PASSWORD");
  if (!pw) { pw = "admin123"; props().setProperty("ADMIN_PASSWORD", pw); }
  return pw;
}
function getAdminEmail() {
  let em = props().getProperty("ADMIN_EMAIL");
  if (!em) { em = "dausdaba@polikpsorong.ac.id"; props().setProperty("ADMIN_EMAIL", em); }
  return em;
}
function cekAdmin(data) {
  // Admin tunggal: email HARUS cocok DAN password HARUS cocok.
  const emailOk = data.email !== undefined && String(data.email).trim().toLowerCase() === getAdminEmail().toLowerCase();
  const passOk = data.password !== undefined && String(data.password) === getAdminPassword();
  return emailOk && passOk;
}

/* ====================== JAM KERJA ======================= */
function parseJamMenit(j) { const m = String(j).match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function menitSekarang(now) { return parseInt(fmt(now, "H"), 10) * 60 + parseInt(fmt(now, "m"), 10); }
function jenisOtomatis(now, set) {
  // Patokan tengah hari: sebelum 12.00 = Masuk, 12.00 ke atas = Pulang.
  return menitSekarang(now) < 720 ? "Masuk" : "Pulang";
}
function hitungStatusWaktu(now, jenis, set) {
  const skg = menitSekarang(now);
  if (jenis === "Masuk") {
    const batas = (parseJamMenit(set.jamMasuk) || parseJamMenit(DEFAULT_JAM_MASUK)) + set.bufferMasuk;
    const lewat = skg - batas;
    return lewat <= 0 ? "Tepat Waktu" : "Terlambat " + lewat + " menit";
  }
  const batas = (parseJamMenit(set.jamPulang) || parseJamMenit(DEFAULT_JAM_PULANG)) - set.bufferPulang;
  const cepat = batas - skg;
  return cepat <= 0 ? "Tepat Waktu" : "Pulang Cepat " + cepat + " menit";
}

/* ====================== DATA HELPER ==================== */
function props() { return PropertiesService.getScriptProperties(); }

function getPengaturan() {
  const p = props();
  return {
    lat: parseFloat(p.getProperty("KAMPUS_LAT") || ""),
    lng: parseFloat(p.getProperty("KAMPUS_LNG") || ""),
    radius: parseInt(p.getProperty("KAMPUS_RADIUS") || "0", 10),
    namaInstansi: p.getProperty("NAMA_INSTANSI") || "Politeknik Kelautan dan Perikanan Sorong",
    jamMasuk: p.getProperty("JAM_MASUK") || DEFAULT_JAM_MASUK,
    jamPulang: p.getProperty("JAM_PULANG") || DEFAULT_JAM_PULANG,
    bufferMasuk: parseInt(p.getProperty("BUFFER_MASUK") || String(DEFAULT_BUFFER_MASUK), 10),
    bufferPulang: parseInt(p.getProperty("BUFFER_PULANG") || String(DEFAULT_BUFFER_PULANG), 10),
    abaikanLokasi: (p.getProperty("ABAIKAN_LOKASI") || "true") === "true"
  };
}
function getPengaturanPublic() {
  const s = getPengaturan();
  return {
    lat: isNaN(s.lat) ? "" : s.lat, lng: isNaN(s.lng) ? "" : s.lng, radius: s.radius || "",
    namaInstansi: s.namaInstansi, jamMasuk: s.jamMasuk, jamPulang: s.jamPulang,
    bufferMasuk: s.bufferMasuk, bufferPulang: s.bufferPulang, abaikanLokasi: s.abaikanLokasi,
    adminEmail: getAdminEmail()
  };
}

function getDataPerangkat() {
  const values = getSheetPerangkat().getDataRange().getValues();
  values.shift();
  return values.map(function (r, i) {
    return { rowIndex: i + 2, deviceId: String(r[0]), nama: r[1], nip: r[2], status: r[3], didaftarkan: r[4] };
  });
}
function cariPerangkat(deviceId) {
  if (!deviceId) return null;
  return getDataPerangkat().filter(function (d) { return d.deviceId === String(deviceId); })[0] || null;
}
function listPerangkat() {
  return getDataPerangkat().map(function (d) {
    return { deviceId: d.deviceId, nama: d.nama, nip: d.nip, status: d.status, didaftarkan: d.didaftarkan instanceof Date ? fmt(d.didaftarkan, "yyyy-MM-dd HH:mm") : d.didaftarkan };
  });
}

function getSheetAbsen() { return getOrCreateSheet(SHEET_ABSEN, HEADER_ABSEN); }
function getSheetJurnal() { return getOrCreateSheet(SHEET_JURNAL, HEADER_JURNAL); }
function getSheetIzin() { return getOrCreateSheet(SHEET_IZIN, HEADER_IZIN); }
function getSheetPerangkat() { return getOrCreateSheet(SHEET_PERANGKAT, HEADER_PERANGKAT); }
function getOrCreateSheet(nama, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(nama);
  if (!sheet) {
    sheet = ss.insertSheet(nama);
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}
function simpanFoto(base64, nama, jenis, waktu) {
  const folder = getFolder();
  const parts = base64.split(",");
  const meta = parts[0].match(/:(.*?);/);
  const contentType = meta ? meta[1] : "image/jpeg";
  const bytes = Utilities.base64Decode(parts[1]);
  const namaFile = [String(nama || "tanpa-nama").replace(/[^\w]+/g, "_"), jenis || "foto", fmt(waktu, "yyyyMMdd_HHmmss")].join("_") + ".jpg";
  const blob = Utilities.newBlob(bytes, contentType, namaFile);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = function (x) { return x * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function fmt(d, f) { return Utilities.formatDate(d, TZ, f); }
function jsonOutput(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
