/* ============================================================
   BACKEND ABSENSI PJLP  —  Google Apps Script
   Login Email + Password (tanpa OAuth) + persetujuan admin
   + geofence + jam kerja otomatis + jurnal + rekap per-pengguna
   ------------------------------------------------------------
   PASANG:
   1. Buka Google Sheet > Ekstensi > Apps Script, tempel file ini.
   2. Jalankan fungsi  setup  sekali (izinkan akses).
   3. Deploy > New deployment > Web app
      (Execute as: Me, Who has access: Anyone) > salin URL /exec
      ke js/config.js.
   Ubah kode -> Deploy > Manage deployments > Edit > New version.
   ============================================================ */

const DEFAULT_ADMIN_EMAIL = "dausdaba@polikpsorong.ac.id"; // boleh >1, pisah koma

const TZ = "GMT+9"; // WIT
const SHEET_ABSEN = "Absensi";
const SHEET_JURNAL = "Jurnal";
const SHEET_PEGAWAI = "Pegawai";
const FOLDER_NAME = "Foto Jurnal PJLP";

const HEADER_ABSEN = [
  "Timestamp", "Email", "Nama", "NIP/ID", "Jenis", "Status Waktu", "Tanggal", "Jam",
  "Latitude", "Longitude", "Akurasi (m)", "Jarak (m)", "Link Lokasi", "Keterangan"
];
const HEADER_JURNAL = [
  "Timestamp", "Email", "Nama", "NIP/ID", "Tanggal", "Jam", "Kegiatan",
  "Foto", "Latitude", "Longitude", "Link Lokasi"
];
const HEADER_PEGAWAI = [
  "Email", "Nama", "NIP/ID", "PasswordHash", "Status", "Didaftarkan", "Diperbarui"
];

const DEFAULT_JAM_MASUK = "07:30";
const DEFAULT_JAM_PULANG = "16:00";
const DEFAULT_BUFFER_MASUK = 60;
const DEFAULT_BUFFER_PULANG = 240;

/* ====================== SETUP ============================== */
function setup() {
  getSheetAbsen();
  getSheetJurnal();
  getSheetPegawai();
  const p = props();
  if (!p.getProperty("JAM_MASUK")) p.setProperty("JAM_MASUK", DEFAULT_JAM_MASUK);
  if (!p.getProperty("JAM_PULANG")) p.setProperty("JAM_PULANG", DEFAULT_JAM_PULANG);
  if (!p.getProperty("BUFFER_MASUK")) p.setProperty("BUFFER_MASUK", String(DEFAULT_BUFFER_MASUK));
  if (!p.getProperty("BUFFER_PULANG")) p.setProperty("BUFFER_PULANG", String(DEFAULT_BUFFER_PULANG));
  if (!p.getProperty("ADMIN_EMAIL")) p.setProperty("ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL);
  if (!p.getProperty("ABAIKAN_LOKASI")) p.setProperty("ABAIKAN_LOKASI", "true");
  if (!p.getProperty("SALT")) p.setProperty("SALT", Utilities.getUuid());
  if (!p.getProperty("SECRET")) p.setProperty("SECRET", Utilities.getUuid());
  Logger.log("Setup selesai. Admin: " + p.getProperty("ADMIN_EMAIL"));
}

/* ====================== ROUTING =========================== */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case "daftar":           return daftar(data);
      case "login":            return login(data);
      case "cekAkun":          return cekAkun(data);
      case "gantiPassword":    return gantiPassword(data);
      case "absen":            return absen(data);
      case "jurnal":           return jurnal(data);
      case "rekapAbsensi":     return rekapData(data, SHEET_ABSEN);
      case "rekapJurnal":      return rekapData(data, SHEET_JURNAL);
      case "adminData":        return adminData(data);
      case "setStatusPegawai": return setStatusPegawai(data);
      case "resetPassword":    return resetPassword(data);
      case "hapusPegawai":     return hapusPegawai(data);
      case "simpanPengaturan": return simpanPengaturan(data);
      default:
        return jsonOutput({ status: "error", message: "Aksi tidak dikenal: " + data.action });
    }
  } catch (err) {
    return jsonOutput({ status: "error", message: String(err && err.message ? err.message : err) });
  }
}

function doGet() { return jsonOutput({ status: "success", message: "API Absensi PJLP aktif." }); }

/* ====================== AKUN ============================== */
function daftar(data) {
  const email = normEmail(data.email);
  if (!email || email.indexOf("@") === -1) return jsonOutput({ status: "error", message: "Email tidak valid." });
  if (!data.nama || !String(data.nama).trim()) return jsonOutput({ status: "error", message: "Nama wajib diisi." });
  if (!data.password || String(data.password).length < 6) return jsonOutput({ status: "error", message: "Password minimal 6 karakter." });
  if (cariPegawai(email)) return jsonOutput({ status: "error", message: "Email sudah terdaftar. Silakan login." });

  const now = new Date();
  const statusAwal = cekIsAdmin(email) ? "disetujui" : "pending"; // admin langsung aktif
  getSheetPegawai().appendRow([email, String(data.nama).trim(), data.nip || "", hashPassword(data.password), statusAwal, now, now]);
  return jsonOutput({ status: "success", akunStatus: statusAwal, message: statusAwal === "disetujui" ? "Akun admin dibuat & aktif. Silakan login." : "Pendaftaran terkirim. Menunggu persetujuan admin." });
}

function login(data) {
  const email = normEmail(data.email);
  const peg = cariPegawai(email);
  if (!peg || peg.passwordHash !== hashPassword(data.password)) {
    return jsonOutput({ status: "error", message: "Email atau password salah." });
  }
  const set = getPengaturan();
  return jsonOutput({
    status: "success",
    token: buatToken(email, peg.passwordHash),
    nama: peg.nama, nip: peg.nip, akunStatus: peg.status,
    isAdmin: cekIsAdmin(email),
    jamMasuk: set.jamMasuk, jamPulang: set.jamPulang
  });
}

function cekAkun(data) {
  const u = verifikasiToken(data.token);
  const set = getPengaturan();
  return jsonOutput({
    status: "success", email: u.email, nama: u.nama, nip: u.nip,
    akunStatus: u.status, isAdmin: u.isAdmin,
    jamMasuk: set.jamMasuk, jamPulang: set.jamPulang
  });
}

function gantiPassword(data) {
  const u = verifikasiToken(data.token);
  const peg = cariPegawai(u.email);
  if (peg.passwordHash !== hashPassword(data.passwordLama)) return jsonOutput({ status: "error", message: "Password lama salah." });
  if (!data.passwordBaru || String(data.passwordBaru).length < 6) return jsonOutput({ status: "error", message: "Password baru minimal 6 karakter." });
  getSheetPegawai().getRange(peg.rowIndex, 4).setValue(hashPassword(data.passwordBaru));
  getSheetPegawai().getRange(peg.rowIndex, 7).setValue(new Date());
  return jsonOutput({ status: "success", token: buatToken(u.email, hashPassword(data.passwordBaru)), message: "Password diperbarui." });
}

/* ====================== ABSEN ============================= */
function absen(data) {
  const u = verifikasiToken(data.token);
  if (u.status !== "disetujui") return jsonOutput({ status: "error", code: u.status, message: "Akun berstatus '" + u.status + "'. Hubungi admin." });

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
    now, u.email, u.nama, u.nip, jenis, statusWaktu,
    fmt(now, "yyyy-MM-dd"), fmt(now, "HH:mm:ss"),
    data.lat || "", data.lng || "", data.akurasi || "",
    jarak === "" ? "" : Math.round(jarak), linkLok, data.keterangan || ""
  ]);
  const infoJarak = jarak === "" ? "" : ", ±" + Math.round(jarak) + " m dari titik kampus";
  return jsonOutput({ status: "success", message: "Absen " + jenis + " berhasil (" + statusWaktu + infoJarak + ")." });
}

/* ====================== JURNAL =========================== */
function jurnal(data) {
  const u = verifikasiToken(data.token);
  if (u.status !== "disetujui") return jsonOutput({ status: "error", code: u.status, message: "Akun berstatus '" + u.status + "'. Hubungi admin." });
  if (!data.kegiatan || !String(data.kegiatan).trim()) return jsonOutput({ status: "error", message: "Deskripsi kegiatan wajib diisi." });
  if (!data.foto) return jsonOutput({ status: "error", message: "Foto kegiatan wajib diambil." });

  const now = new Date();
  const fotoUrl = simpanFoto(data.foto, u.nama, "jurnal", now);
  const linkLok = (data.lat && data.lng) ? "https://maps.google.com/?q=" + data.lat + "," + data.lng : "";
  getSheetJurnal().appendRow([
    now, u.email, u.nama, u.nip, fmt(now, "yyyy-MM-dd"), fmt(now, "HH:mm:ss"),
    String(data.kegiatan).trim(), fotoUrl, data.lat || "", data.lng || "", linkLok
  ]);
  return jsonOutput({ status: "success", message: "Jurnal kegiatan berhasil disimpan." });
}

/* ====================== REKAP ============================ */
function rekapData(data, namaSheet) {
  const u = verifikasiToken(data.token);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(namaSheet);
  if (!sheet) return jsonOutput({ status: "success", data: [], isAdmin: u.isAdmin });
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOutput({ status: "success", data: [], isAdmin: u.isAdmin });
  const headers = values.shift();
  const idxEmail = headers.indexOf("Email");
  let rows = u.isAdmin ? values : values.filter(function (r) { return String(r[idxEmail]).toLowerCase() === u.email; });
  const out = rows.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      let v = row[i];
      if (v instanceof Date) { v = (h === "Tanggal") ? fmt(v, "yyyy-MM-dd") : (h === "Jam") ? fmt(v, "HH:mm:ss") : fmt(v, "yyyy-MM-dd HH:mm:ss"); }
      obj[h] = v;
    });
    return obj;
  });
  return jsonOutput({ status: "success", data: out, isAdmin: u.isAdmin });
}

/* ====================== ADMIN =========================== */
function adminData(data) {
  const u = verifikasiToken(data.token);
  if (!u.isAdmin) return jsonOutput({ status: "error", message: "Anda bukan admin." });
  return jsonOutput({ status: "success", pegawai: listPegawai(), pengaturan: getPengaturanPublic() });
}

function setStatusPegawai(data) {
  const u = verifikasiToken(data.token);
  if (!u.isAdmin) return jsonOutput({ status: "error", message: "Anda bukan admin." });
  if (["pending", "disetujui", "diblokir"].indexOf(data.statusBaru) === -1) return jsonOutput({ status: "error", message: "Status tidak valid." });
  const peg = cariPegawai(data.email);
  if (!peg) return jsonOutput({ status: "error", message: "Pegawai tidak ditemukan." });
  getSheetPegawai().getRange(peg.rowIndex, 5).setValue(data.statusBaru);
  getSheetPegawai().getRange(peg.rowIndex, 7).setValue(new Date());
  return jsonOutput({ status: "success", message: "Status diperbarui." });
}

function resetPassword(data) {
  const u = verifikasiToken(data.token);
  if (!u.isAdmin) return jsonOutput({ status: "error", message: "Anda bukan admin." });
  if (!data.passwordBaru || String(data.passwordBaru).length < 6) return jsonOutput({ status: "error", message: "Password baru minimal 6 karakter." });
  const peg = cariPegawai(data.email);
  if (!peg) return jsonOutput({ status: "error", message: "Pegawai tidak ditemukan." });
  getSheetPegawai().getRange(peg.rowIndex, 4).setValue(hashPassword(data.passwordBaru));
  getSheetPegawai().getRange(peg.rowIndex, 7).setValue(new Date());
  return jsonOutput({ status: "success", message: "Password " + data.email + " direset." });
}

function hapusPegawai(data) {
  const u = verifikasiToken(data.token);
  if (!u.isAdmin) return jsonOutput({ status: "error", message: "Anda bukan admin." });
  const peg = cariPegawai(data.email);
  if (!peg) return jsonOutput({ status: "error", message: "Pegawai tidak ditemukan." });
  getSheetPegawai().deleteRow(peg.rowIndex);
  return jsonOutput({ status: "success", message: "Pegawai dihapus." });
}

function simpanPengaturan(data) {
  const u = verifikasiToken(data.token);
  if (!u.isAdmin) return jsonOutput({ status: "error", message: "Anda bukan admin." });
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
  if (data.adminEmail) p.setProperty("ADMIN_EMAIL", String(data.adminEmail).toLowerCase());
  return jsonOutput({ status: "success", message: "Pengaturan disimpan." });
}

/* ====================== AUTH HELPER ===================== */
function normEmail(e) { return String(e || "").trim().toLowerCase(); }

function hashPassword(pw) { return sha256Hex(String(pw) + "::" + props().getProperty("SALT")); }

function buatToken(email, passwordHash) { return email + "|" + hmacHex(email + "|" + passwordHash); }

function verifikasiToken(token) {
  if (!token) throw new Error("Belum login. Silakan login.");
  const idx = String(token).indexOf("|");
  if (idx === -1) throw new Error("Sesi tidak valid, login ulang.");
  const email = normEmail(token.substring(0, idx));
  const sig = token.substring(idx + 1);
  const peg = cariPegawai(email);
  if (!peg) throw new Error("Akun tidak ditemukan, login ulang.");
  if (sig !== hmacHex(email + "|" + peg.passwordHash)) throw new Error("Sesi tidak valid (password mungkin berubah), login ulang.");
  return { email: email, nama: peg.nama, nip: peg.nip, status: peg.status, isAdmin: cekIsAdmin(email), rowIndex: peg.rowIndex };
}

function cekIsAdmin(email) {
  const admins = (props().getProperty("ADMIN_EMAIL") || DEFAULT_ADMIN_EMAIL).toLowerCase().split(",").map(function (s) { return s.trim(); });
  return admins.indexOf(normEmail(email)) !== -1;
}

function sha256Hex(s) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytesToHex(raw);
}
function hmacHex(msg) {
  const raw = Utilities.computeHmacSha256Signature(msg, props().getProperty("SECRET"));
  return bytesToHex(raw);
}
function bytesToHex(bytes) {
  return bytes.map(function (b) { return ("0" + (b & 0xFF).toString(16)).slice(-2); }).join("");
}

/* ====================== JAM KERJA ======================= */
function parseJamMenit(j) { const m = String(j).match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function menitSekarang(now) { return parseInt(fmt(now, "H"), 10) * 60 + parseInt(fmt(now, "m"), 10); }
function jenisOtomatis(now, set) {
  const masuk = parseJamMenit(set.jamMasuk) || parseJamMenit(DEFAULT_JAM_MASUK);
  const pulang = parseJamMenit(set.jamPulang) || parseJamMenit(DEFAULT_JAM_PULANG);
  return menitSekarang(now) <= (masuk + pulang) / 2 ? "Masuk" : "Pulang";
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
    abaikanLokasi: (p.getProperty("ABAIKAN_LOKASI") || "true") === "true",
    adminEmail: p.getProperty("ADMIN_EMAIL") || DEFAULT_ADMIN_EMAIL
  };
}
function getPengaturanPublic() {
  const s = getPengaturan();
  return {
    lat: isNaN(s.lat) ? "" : s.lat, lng: isNaN(s.lng) ? "" : s.lng, radius: s.radius || "",
    namaInstansi: s.namaInstansi, jamMasuk: s.jamMasuk, jamPulang: s.jamPulang,
    bufferMasuk: s.bufferMasuk, bufferPulang: s.bufferPulang, abaikanLokasi: s.abaikanLokasi, adminEmail: s.adminEmail
  };
}

function getDataPegawai() {
  const values = getSheetPegawai().getDataRange().getValues();
  values.shift();
  return values.map(function (r, i) {
    return { rowIndex: i + 2, email: String(r[0]).toLowerCase(), nama: r[1], nip: r[2], passwordHash: r[3], status: r[4], didaftarkan: r[5] };
  });
}
function cariPegawai(email) {
  const e = normEmail(email); if (!e) return null;
  return getDataPegawai().filter(function (d) { return d.email === e; })[0] || null;
}
function listPegawai() {
  return getDataPegawai().map(function (d) {
    return { email: d.email, nama: d.nama, nip: d.nip, status: d.status, didaftarkan: d.didaftarkan instanceof Date ? fmt(d.didaftarkan, "yyyy-MM-dd HH:mm") : d.didaftarkan };
  });
}

function getSheetAbsen() { return getOrCreateSheet(SHEET_ABSEN, HEADER_ABSEN); }
function getSheetJurnal() { return getOrCreateSheet(SHEET_JURNAL, HEADER_JURNAL); }
function getSheetPegawai() { return getOrCreateSheet(SHEET_PEGAWAI, HEADER_PEGAWAI); }
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
