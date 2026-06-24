/* ============================================================
   BACKEND ABSENSI PJLP  —  Google Apps Script
   ------------------------------------------------------------
   Cara pakai:
   1. Buka Google Sheets baru: https://sheet.new
   2. Menu  Ekstensi > Apps Script
   3. Hapus kode bawaan, tempel SELURUH isi file ini.
   4. Simpan (ikon disket).
   5. Klik  Deploy > New deployment > pilih jenis "Web app".
        - Execute as       : Me (akun Anda)
        - Who has access   : Anyone
   6. Klik Deploy, izinkan akses, lalu SALIN URL Web app
      (berakhiran /exec).
   7. Tempel URL itu ke  js/config.js  pada APPS_SCRIPT_URL.

   Catatan: setiap kali mengubah kode ini, lakukan
   Deploy > Manage deployments > Edit > Version: New version,
   agar perubahan aktif (URL tetap sama).
   ============================================================ */

const SHEET_NAME = "Absensi";
const FOLDER_NAME = "Foto Absensi PJLP";
const TZ = "GMT+9"; // WIT. Ganti GMT+7 (WIB) / GMT+8 (WITA) bila perlu.

const HEADER = [
  "Timestamp", "Nama", "NIP/ID", "Jenis", "Tanggal", "Jam",
  "Latitude", "Longitude", "Akurasi (m)", "Link Lokasi", "Foto", "Keterangan"
];

/* ---------- POST: simpan absen ---------- */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (!data.nama) {
      return jsonOutput({ status: "error", message: "Nama wajib diisi." });
    }

    const sheet = getSheet();
    const now = new Date();

    let fotoUrl = "";
    if (data.foto) {
      fotoUrl = simpanFoto(data.foto, data.nama, data.jenis, now);
    }

    const linkLokasi = (data.lat && data.lng)
      ? "https://maps.google.com/?q=" + data.lat + "," + data.lng
      : "";

    sheet.appendRow([
      now,
      data.nama,
      data.nip || "",
      data.jenis || "",
      Utilities.formatDate(now, TZ, "yyyy-MM-dd"),
      Utilities.formatDate(now, TZ, "HH:mm:ss"),
      data.lat || "",
      data.lng || "",
      data.akurasi || "",
      linkLokasi,
      fotoUrl,
      data.keterangan || ""
    ]);

    return jsonOutput({ status: "success", message: "Absen berhasil dicatat." });
  } catch (err) {
    return jsonOutput({ status: "error", message: String(err) });
  }
}

/* ---------- GET: ambil data untuk rekap ---------- */
function doGet(e) {
  try {
    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return jsonOutput({ status: "success", data: [] });
    }
    const headers = values.shift();
    const data = values.map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) {
        let v = row[i];
        // Normalkan kolom tanggal/jam jika berupa objek Date
        if (v instanceof Date) {
          if (h === "Tanggal") v = Utilities.formatDate(v, TZ, "yyyy-MM-dd");
          else if (h === "Jam") v = Utilities.formatDate(v, TZ, "HH:mm:ss");
          else v = Utilities.formatDate(v, TZ, "yyyy-MM-dd HH:mm:ss");
        }
        obj[h] = v;
      });
      return obj;
    });
    return jsonOutput({ status: "success", data: data });
  } catch (err) {
    return jsonOutput({ status: "error", message: String(err) });
  }
}

/* ---------- Helper ---------- */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
    sheet.getRange(1, 1, 1, HEADER.length).setFontWeight("bold");
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
    (nama || "tanpa-nama").replace(/[^\w]+/g, "_"),
    jenis || "absen",
    Utilities.formatDate(waktu, TZ, "yyyyMMdd_HHmmss")
  ].join("_") + ".jpg";

  const blob = Utilities.newBlob(bytes, contentType, namaFile);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
