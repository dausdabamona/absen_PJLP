/* ============================================================
   BACKEND ABSENSI PJLP  —  Google Apps Script
   Versi dengan: geofence sisi server + kontrol perangkat + admin
   ------------------------------------------------------------
   SEMUA validasi penting (lokasi & izin perangkat) dilakukan
   di sini, BUKAN di browser, agar tidak bisa dimanipulasi.

   LANGKAH PASANG (sekali saja):
   1. Buka Google Sheets baru: https://sheet.new
   2. Menu  Ekstensi > Apps Script
   3. Hapus kode bawaan, tempel SELURUH isi file ini, Simpan.
   4. Di editor, pilih fungsi  setup  lalu klik  Run  (sekali).
      -> membuat tab Absensi & Perangkat dan password admin awal.
      -> izinkan akses saat diminta.
      -> lihat Logs untuk password admin awal (WAJIB diganti
         lewat panel admin setelah login pertama).
   5. Deploy > New deployment > jenis "Web app":
        - Execute as     : Me
        - Who has access : Anyone
      Salin URL (berakhiran /exec) ke  js/config.js.

   Jika kode ini diubah: Deploy > Manage deployments > Edit >
   Version: New version > Deploy (URL tetap sama).
   ============================================================ */

const TZ = "GMT+9"; // WIT. Ganti GMT+7 (WIB) / GMT+8 (WITA) bila perlu.
const SHEET_ABSEN = "Absensi";
const SHEET_PERANGKAT = "Perangkat";
const FOLDER_NAME = "Foto Absensi PJLP";

const HEADER_ABSEN = [
  "Timestamp", "Nama", "NIP/ID", "Jenis", "Tanggal", "Jam",
  "Latitude", "Longitude", "Akurasi (m)", "Jarak (m)", "Link Lokasi",
  "Foto", "Device ID", "Keterangan"
];
const HEADER_PERANGKAT = [
  "Device ID", "Nama", "NIP/ID", "Status", "Didaftarkan", "Diperbarui"
];

/* ====================== SETUP (jalankan sekali) ============= */
function setup() {
  getSheetAbsen();
  getSheetPerangkat();
  const p = props();
  if (!p.getProperty("ADMIN_PASSWORD")) {
    p.setProperty("ADMIN_PASSWORD", "admin123");
  }
  Logger.log("Setup selesai.");
  Logger.log("Password admin awal: " + p.getProperty("ADMIN_PASSWORD"));
  Logger.log("GANTI password ini lewat panel admin setelah login pertama.");
}

/* ====================== ROUTING ============================= */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "absen";
    switch (action) {
      case "absen":              return absen(data);
      case "daftarPerangkat":    return daftarPerangkat(data);
      case "cekPerangkat":       return cekPerangkat(data);
      case "adminLogin":         return adminLogin(data);
      case "adminData":          return adminData(data);
      case "setStatusPerangkat": return setStatusPerangkat(data);
      case "hapusPerangkat":     return hapusPerangkat(data);
      case "simpanPengaturan":   return simpanPengaturan(data);
      default:
        return jsonOutput({ status: "error", message: "Aksi tidak dikenal: " + action });
    }
  } catch (err) {
    return jsonOutput({ status: "error", message: String(err) });
  }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "rekap";
    if (action === "rekap") return rekap();
    return jsonOutput({ status: "error", message: "Aksi GET tidak dikenal." });
  } catch (err) {
    return jsonOutput({ status: "error", message: String(err) });
  }
}

/* ====================== ABSEN (publik) ===================== */
function absen(data) {
  const dev = cariPerangkat(data.deviceId);
  if (!dev) {
    return jsonOutput({ status: "error", code: "belum_daftar", message: "Perangkat belum terdaftar." });
  }
  if (dev.status !== "disetujui") {
    return jsonOutput({ status: "error", code: dev.status, message: "Perangkat berstatus '" + dev.status + "'. Hubungi admin." });
  }

  const set = getPengaturan();
  if (isNaN(set.lat) || isNaN(set.lng) || !set.radius) {
    return jsonOutput({ status: "error", message: "Lokasi kampus belum diatur oleh admin." });
  }
  if (!data.lat || !data.lng) {
    return jsonOutput({ status: "error", message: "Lokasi GPS wajib diambil." });
  }

  const jarak = haversine(data.lat, data.lng, set.lat, set.lng);
  if (jarak > set.radius) {
    return jsonOutput({
      status: "error",
      message: "Absen ditolak: Anda di luar area " + set.namaInstansi +
        " (±" + Math.round(jarak) + " m dari titik, maksimal " + set.radius + " m)."
    });
  }

  let fotoUrl = "";
  if (data.foto) fotoUrl = simpanFoto(data.foto, dev.nama, data.jenis, new Date());

  const now = new Date();
  getSheetAbsen().appendRow([
    now, dev.nama, dev.nip, data.jenis || "",
    fmt(now, "yyyy-MM-dd"), fmt(now, "HH:mm:ss"),
    data.lat, data.lng, data.akurasi || "", Math.round(jarak),
    "https://maps.google.com/?q=" + data.lat + "," + data.lng,
    fotoUrl, data.deviceId, data.keterangan || ""
  ]);

  return jsonOutput({
    status: "success",
    message: "Absen " + (data.jenis || "") + " berhasil (±" + Math.round(jarak) + " m dari titik kampus)."
  });
}

/* ============== PENDAFTARAN PERANGKAT (publik) ============= */
function daftarPerangkat(data) {
  if (!data.deviceId || !data.nama) {
    return jsonOutput({ status: "error", message: "Nama & ID perangkat wajib." });
  }
  const ada = cariPerangkat(data.deviceId);
  if (ada) {
    return jsonOutput({ status: "success", deviceStatus: ada.status, message: "Perangkat sudah terdaftar (" + ada.status + ")." });
  }
  const now = new Date();
  getSheetPerangkat().appendRow([String(data.deviceId), data.nama, data.nip || "", "pending", now, now]);
  return jsonOutput({ status: "success", deviceStatus: "pending", message: "Pendaftaran terkirim. Menunggu persetujuan admin." });
}

function cekPerangkat(data) {
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "success", terdaftar: false });
  return jsonOutput({ status: "success", terdaftar: true, deviceStatus: dev.status, nama: dev.nama, nip: dev.nip });
}

/* ====================== ADMIN ============================== */
function adminLogin(data) {
  cekAdmin(data);
  return jsonOutput({ status: "success", message: "Login berhasil." });
}

function adminData(data) {
  cekAdmin(data);
  return jsonOutput({ status: "success", perangkat: listPerangkat(), pengaturan: getPengaturanPublic() });
}

function setStatusPerangkat(data) {
  cekAdmin(data);
  const valid = ["pending", "disetujui", "diblokir"];
  if (valid.indexOf(data.status) === -1) {
    return jsonOutput({ status: "error", message: "Status tidak valid." });
  }
  const row = cariPerangkat(data.deviceId);
  if (!row) return jsonOutput({ status: "error", message: "Perangkat tidak ditemukan." });
  const sheet = getSheetPerangkat();
  sheet.getRange(row.rowIndex, 4).setValue(data.status);
  sheet.getRange(row.rowIndex, 6).setValue(new Date());
  return jsonOutput({ status: "success", message: "Status diperbarui." });
}

function hapusPerangkat(data) {
  cekAdmin(data);
  const row = cariPerangkat(data.deviceId);
  if (!row) return jsonOutput({ status: "error", message: "Perangkat tidak ditemukan." });
  getSheetPerangkat().deleteRow(row.rowIndex);
  return jsonOutput({ status: "success", message: "Perangkat dihapus." });
}

function simpanPengaturan(data) {
  cekAdmin(data);
  const p = props();
  if (data.lat !== undefined && data.lat !== "") p.setProperty("KAMPUS_LAT", String(data.lat));
  if (data.lng !== undefined && data.lng !== "") p.setProperty("KAMPUS_LNG", String(data.lng));
  if (data.radius !== undefined && data.radius !== "") p.setProperty("KAMPUS_RADIUS", String(data.radius));
  if (data.namaInstansi) p.setProperty("NAMA_INSTANSI", data.namaInstansi);
  if (data.passwordBaru) {
    if (String(data.passwordBaru).length < 6) {
      return jsonOutput({ status: "error", message: "Password baru minimal 6 karakter." });
    }
    p.setProperty("ADMIN_PASSWORD", String(data.passwordBaru));
  }
  return jsonOutput({ status: "success", message: "Pengaturan disimpan." });
}

/* ====================== REKAP (publik baca) ================ */
function rekap() {
  const sheet = getSheetAbsen();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOutput({ status: "success", data: [] });
  const headers = values.shift();
  const data = values.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      let v = row[i];
      if (v instanceof Date) {
        if (h === "Tanggal") v = fmt(v, "yyyy-MM-dd");
        else if (h === "Jam") v = fmt(v, "HH:mm:ss");
        else v = fmt(v, "yyyy-MM-dd HH:mm:ss");
      }
      obj[h] = v;
    });
    return obj;
  });
  return jsonOutput({ status: "success", data: data });
}

/* ====================== HELPER ============================= */
function props() { return PropertiesService.getScriptProperties(); }

function cekAdmin(data) {
  const pw = props().getProperty("ADMIN_PASSWORD");
  if (!pw) throw new Error("Password admin belum diatur. Jalankan fungsi setup() di editor.");
  if (!data.password || String(data.password) !== pw) throw new Error("Password admin salah.");
  return true;
}

function getPengaturan() {
  const p = props();
  return {
    lat: parseFloat(p.getProperty("KAMPUS_LAT") || ""),
    lng: parseFloat(p.getProperty("KAMPUS_LNG") || ""),
    radius: parseInt(p.getProperty("KAMPUS_RADIUS") || "0", 10),
    namaInstansi: p.getProperty("NAMA_INSTANSI") || "Politeknik Kelautan dan Perikanan Sorong"
  };
}

function getPengaturanPublic() {
  const s = getPengaturan();
  return {
    lat: isNaN(s.lat) ? "" : s.lat,
    lng: isNaN(s.lng) ? "" : s.lng,
    radius: s.radius || "",
    namaInstansi: s.namaInstansi
  };
}

function getDataPerangkat() {
  const sheet = getSheetPerangkat();
  const values = sheet.getDataRange().getValues();
  values.shift(); // header
  return values.map(function (r, i) {
    return {
      rowIndex: i + 2,
      deviceId: String(r[0]),
      nama: r[1],
      nip: r[2],
      status: r[3],
      didaftarkan: r[4],
      diperbarui: r[5]
    };
  });
}

function cariPerangkat(deviceId) {
  if (!deviceId) return null;
  return getDataPerangkat().filter(function (d) { return d.deviceId === String(deviceId); })[0] || null;
}

function listPerangkat() {
  return getDataPerangkat().map(function (d) {
    return {
      deviceId: d.deviceId,
      nama: d.nama,
      nip: d.nip,
      status: d.status,
      didaftarkan: d.didaftarkan instanceof Date ? fmt(d.didaftarkan, "yyyy-MM-dd HH:mm") : d.didaftarkan
    };
  });
}

function getSheetAbsen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ABSEN);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ABSEN);
    sheet.appendRow(HEADER_ABSEN);
    sheet.getRange(1, 1, 1, HEADER_ABSEN.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetPerangkat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PERANGKAT);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PERANGKAT);
    sheet.appendRow(HEADER_PERANGKAT);
    sheet.getRange(1, 1, 1, HEADER_PERANGKAT.length).setFontWeight("bold");
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
  const namaFile = [
    String(nama || "tanpa-nama").replace(/[^\w]+/g, "_"),
    jenis || "absen",
    fmt(waktu, "yyyyMMdd_HHmmss")
  ].join("_") + ".jpg";
  const blob = Utilities.newBlob(bytes, contentType, namaFile);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meter
  const toRad = function (x) { return x * Math.PI / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmt(d, f) { return Utilities.formatDate(d, TZ, f); }

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
