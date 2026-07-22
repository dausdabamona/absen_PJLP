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
const SHEET_MASTER_PJLP = "Data Master PJLP";
const SHEET_REGISTER_DOKUMEN = "Register Dokumen Pengadaan";
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
  "Device ID", "Nama", "NIP/ID", "Status", "Didaftarkan", "Diperbarui", "Role"
];
const HEADER_MASTER_PJLP = [
  "NIP/ID", "Nama", "NIK", "NPWP", "Jabatan 2026", "Alamat",
  "Nilai HPS (Rp)", "Harga Negosiasi (Rp)", "Data Rekening", "Pendidikan",
  "Tanggal Mulai Kontrak", "Tanggal Selesai Kontrak", "Diperbarui", "Honorarium Bulanan (Rp)"
];
const HEADER_REGISTER_DOKUMEN = [
  "No File", "Jenis Dokumen", "Nomor Surat", "Tanggal", "Jabatan PJLP", "Nama PJLP", "Keterangan"
];
// Seed sekali (idempotent): riwayat register dokumen pengadaan PJLP TA 2026
const SEED_REGISTER_DOKUMEN = [
  [2, "Undangan Pemasukan Penawaran", "B.5817/PP.9.30/TU.330/III/2026", "2026-03-16", "Petugas Layanan Informasi", "Monica Huwae, A.Md", "HPS: Rp46.889.061"],
  [3, "Undangan Pemasukan Penawaran", "B.5818/PP.9.30/TU.330/III/2026", "2026-03-16", "Content Creator", "La Ode Faden Bilfar, A.Md.Pi", "HPS: Rp46.889.061"],
  [4, "Undangan Pemasukan Penawaran", "B.5819/PP.9.30/TU.330/III/2026", "2026-03-16", "Pramubakti", "Alda Wahdaniah, A.Md", "HPS: Rp41.130.742"],
  [5, "Undangan Pemasukan Penawaran", "B.5820/PP.9.30/TU.330/III/2026", "2026-03-16", "Pengemudi Operasional", "Muhamat Weking, A.Md", "HPS: Rp41.130.742"],
  [6, "BA Perubahan Waktu Seleksi (Adendum)", "B.6300/PP.9.30/PL.450/III/2026", "2026-03-26", "Semua Jabatan", "-", "Perpanjangan waktu pemasukan s.d. 30 Maret 2026"],
  [7, "BA Evaluasi Penawaran", "B.6536/PP.9.30/TU.330/IV/2026", "2026-04-01", "Petugas Layanan Informasi", "Monica Huwae, A.Md", "Lulus semua evaluasi"],
  [8, "BA Evaluasi Penawaran", "B.6538/PP.9.30/TU.330/IV/2026", "2026-04-01", "Content Creator", "La Ode Faden Bilfar, A.Md.Pi", "Lulus semua evaluasi"],
  [9, "BA Evaluasi Penawaran", "B.6541/PP.9.30/TU.330/IV/2026", "2026-04-01", "Pramubakti", "Alda Wahdaniah, A.Md", "Lulus semua evaluasi"],
  [10, "BA Evaluasi Penawaran", "B.6542/PP.9.30/TU.330/IV/2026", "2026-04-01", "Pengemudi Operasional", "Muhamat Weking, A.Md", "Lulus semua evaluasi"],
  [11, "Undangan Klarifikasi & Negosiasi", "B.6547/PP.9.30/TU.330/IV/2026", "2026-04-01", "Petugas Layanan Informasi", "Monica Huwae, A.Md", "Via Zoom, 15.00 WIT"],
  [12, "Undangan Klarifikasi & Negosiasi", "B.6548/PP.9.30/TU.330/IV/2026", "2026-04-01", "Content Creator", "La Ode Faden Bilfar, A.Md.Pi", "Via Zoom, 15.30 WIT"],
  [13, "Undangan Klarifikasi & Negosiasi", "B.6549/PP.9.30/TU.330/IV/2026", "2026-04-01", "Pramubakti", "Alda Wahdaniah, A.Md", "Via Zoom, 16.00 WIT"],
  [14, "Undangan Klarifikasi & Negosiasi", "B.6549/PP.9.30/TU.330/IV/2026", "2026-04-01", "Pengemudi Operasional", "Muhamat Weking, A.Md", "Via Zoom, 16.30 WIT (nomor sama dgn no.13)"],
  [15, "BA Klarifikasi Teknis & Negosiasi Harga", "B.6565/PP.9.30/PL.450/IV/2026", "2026-04-01", "Petugas Layanan Informasi", "Monica Huwae, A.Md", "Harga negosiasi = HPS"],
  [16, "BA Klarifikasi Teknis & Negosiasi Harga", "B.6566/PP.9.30/PL.450/IV/2026", "2026-04-01", "Content Creator", "La Ode Faden Bilfar, A.Md.Pi", "Harga negosiasi = HPS"],
  [17, "BA Klarifikasi Teknis & Negosiasi Harga", "B.6567/PP.9.30/PL.450/IV/2026", "2026-04-01", "Pramubakti", "Alda Wahdaniah, A.Md", "Harga negosiasi = HPS"],
  [18, "BA Klarifikasi Teknis & Negosiasi Harga", "B.6568/PP.9.30/PL.450/IV/2026", "2026-04-01", "Pengemudi Operasional", "Muhamat Weking, A.Md", "Harga negosiasi = HPS"],
  [19, "BAHPL (BA Hasil Pengadaan Langsung)", "B.6569/PP.9.30/PL.450/IV/2026", "2026-04-01", "Petugas Layanan Informasi", "Monica Huwae, A.Md", "Pemenang"],
  [20, "BAHPL (BA Hasil Pengadaan Langsung)", "B.6570/PP.9.30/PL.450/IV/2026", "2026-04-01", "Content Creator", "La Ode Faden Bilfar, A.Md.Pi", "Pemenang"],
  [21, "BAHPL (BA Hasil Pengadaan Langsung)", "B.6571/PP.9.30/PL.450/IV/2026", "2026-04-01", "Pramubakti", "Alda Wahdaniah, A.Md", "Pemenang"],
  [22, "BAHPL (BA Hasil Pengadaan Langsung)", "B.6572/PP.9.30/PL.450/IV/2026", "2026-04-01", "Pengemudi Operasional", "Muhamat Weking, A.Md", "Pemenang"],
  [23, "Penetapan & Pengumuman Pemenang", "B.6573/PP.9.30/PL.450/IV/2026", "2026-04-01", "Petugas Layanan Informasi", "Monica Huwae, A.Md", "Pemenang ditetapkan"],
  [24, "Penetapan & Pengumuman Pemenang", "B.6574/PP.9.30/PL.450/IV/2026", "2026-04-01", "Content Creator", "La Ode Faden Bilfar, A.Md.Pi", "Pemenang ditetapkan"],
  [25, "Penetapan & Pengumuman Pemenang", "B.6575/PP.9.30/PL.450/IV/2026", "2026-04-01", "Pramubakti", "Alda Wahdaniah, A.Md", "Pemenang ditetapkan"],
  [26, "Penetapan & Pengumuman Pemenang", "B.6576/PP.9.30/PL.450/IV/2026", "2026-04-01", "Pengemudi Operasional", "Muhamat Weking, A.Md", "Pemenang ditetapkan"],
  [27, "Nota Dinas Laporan Pemilihan", "2784/PP.9.30/PL.460/IV/2026", "2026-04-01", "Petugas Layanan Informasi", "Monica Huwae, A.Md", "Pejabat Pengadaan → PPK"],
  [28, "Nota Dinas Laporan Pemilihan", "2785/PP.9.30/PL.460/IV/2026", "2026-04-01", "Content Creator", "La Ode Faden Bilfar, A.Md.Pi", "Pejabat Pengadaan → PPK"],
  [29, "Nota Dinas Laporan Pemilihan", "2786/PP.9.30/PL.460/IV/2026", "2026-04-01", "Pramubakti", "Alda Wahdaniah, A.Md", "Pejabat Pengadaan → PPK"],
  [30, "Nota Dinas Laporan Pemilihan", "2787/PP.9.30/PL.460/IV/2026", "2026-04-01", "Pengemudi Operasional", "Muhamat Weking, A.Md", "Pejabat Pengadaan → PPK"]
];
// Seed sekali (idempotent): data master PJLP TA 2026 (isi awal, bisa diedit admin di panel)
// Elemen terakhir tiap baris = Honorarium Bulanan (Rp), diambil dari SPK asli
// (dipisah dari "now"/Diperbarui oleh seedDataAwal() di bawah).
const SEED_MASTER_PJLP = [
  ["8106036310990002", "Monica Huwae, A.Md", "8106036310990002", "20.139.103.4-951.000", "Petugas Layanan Informasi", "Kampung Wernas, Sorong Selatan", 46889061, 46889061, "BNI Sorong - 1853717189 a.n. Monica Huwae", "D-III", "2026-04-01", "2026-12-31", 4293240],
  ["7404190107000004", "La Ode Faden Bilfar, A.Md.Pi", "7404190107000004", "62.425.102.1-951.000", "Content Creator", "Jl. Kapitan Pattimura Kel. Suprau, Kec. Maladumes, Kota Sorong", 46889061, 46889061, "BNI Manokwari - 1170375422 a.n. La Ode Faden", "D-III", "2026-04-01", "2026-12-31", 4293240],
  ["7309066406000002", "Alda Wahdaniah, A.Md", "7309066406000002", "50.442.774.1-951.000", "Pramubakti", "Jln. Kilang Blok.D RT.03/RW.03", 41130742, 41130742, "BNI Sorong - 1857635100 a.n. Alda Wahdaniah", "D-III", "2026-04-01", "2026-12-31", 3766000],
  ["8171020808820008", "Muhamat Weking, A.Md", "8171020808820008", "20.505.893.6.-951.000", "Pengemudi Operasional", "Jl. Kapitan Pattimura, Suprau, Maladum Mes, Kota Sorong", 41130742, 41130742, "BNI Sorong - 1795316943 a.n. Muhamat Weking", "D-III", "2026-04-01", "2026-12-31", 3766000]
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
  getSheetMasterPjlp();
  getSheetRegisterDokumen();
  perbaikiHeader();
  seedDataAwal();
  const p = props();
  if (!p.getProperty("ADMIN_EMAIL")) p.setProperty("ADMIN_EMAIL", "dausdaba@polikpsorong.ac.id");
  if (!p.getProperty("ADMIN_PASSWORD")) p.setProperty("ADMIN_PASSWORD", "admin123");
  if (!p.getProperty("JAM_MASUK")) p.setProperty("JAM_MASUK", DEFAULT_JAM_MASUK);
  if (!p.getProperty("JAM_PULANG")) p.setProperty("JAM_PULANG", DEFAULT_JAM_PULANG);
  if (!p.getProperty("BUFFER_MASUK")) p.setProperty("BUFFER_MASUK", String(DEFAULT_BUFFER_MASUK));
  if (!p.getProperty("BUFFER_PULANG")) p.setProperty("BUFFER_PULANG", String(DEFAULT_BUFFER_PULANG));
  if (!p.getProperty("ABAIKAN_LOKASI")) p.setProperty("ABAIKAN_LOKASI", "true");
  if (!p.getProperty("BEBAS_JUMAT")) p.setProperty("BEBAS_JUMAT", "true");
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
      case "rekapAbsensi":       return rekapData(data, SHEET_ABSEN, HEADER_ABSEN);
      case "rekapJurnal":        return rekapData(data, SHEET_JURNAL, HEADER_JURNAL);
      case "rekapIzin":          return rekapData(data, SHEET_IZIN, HEADER_IZIN);
      case "adminLogin":         return adminLogin(data);
      case "adminData":          return adminData(data);
      case "setStatusPerangkat": return setStatusPerangkat(data);
      case "hapusPerangkat":     return hapusPerangkat(data);
      case "editPerangkat":      return editPerangkat(data);
      case "setRolePerangkat":   return setRolePerangkat(data);
      case "simpanPengaturan":   return simpanPengaturan(data);
      case "adminDataMaster":    return adminDataMaster(data);
      case "simpanDataMaster":   return simpanDataMaster(data);
      case "adminRegisterDokumen": return adminRegisterDokumen(data);
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
  if (!data.nip || !String(data.nip).trim()) return jsonOutput({ status: "error", message: "NIP/ID wajib diisi." });
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
  const now = new Date();
  const jumat = fmt(now, "u") === "5"; // 5 = Jumat
  const bebasLokasi = set.abaikanLokasi || (set.bebasJumat && jumat);

  let jarak = "";
  if (!bebasLokasi) {
    if (isNaN(set.lat) || isNaN(set.lng) || !set.radius) return jsonOutput({ status: "error", message: "Lokasi kampus belum diatur oleh admin." });
    if (!data.lat || !data.lng) return jsonOutput({ status: "error", message: "Lokasi GPS wajib diambil." });
    jarak = haversine(data.lat, data.lng, set.lat, set.lng);
    if (jarak > set.radius) return jsonOutput({ status: "error", message: "Absen ditolak: Anda di luar area " + set.namaInstansi + " (±" + Math.round(jarak) + " m, maksimal " + set.radius + " m)." });
  } else if (data.lat && data.lng && !isNaN(set.lat) && !isNaN(set.lng)) {
    jarak = haversine(data.lat, data.lng, set.lat, set.lng);
  }

  const jenis = jenisOtomatis(now, set);
  const statusWaktu = hitungStatusWaktu(now, jenis, set);
  const linkLok = (data.lat && data.lng) ? "https://maps.google.com/?q=" + data.lat + "," + data.lng : "";
  const ket = (set.bebasJumat && jumat && !set.abaikanLokasi) ? ((data.keterangan ? data.keterangan + " " : "") + "[Jumat: bebas lokasi]").trim() : (data.keterangan || "");
  getSheetAbsen().appendRow([
    now, dev.deviceId, dev.nama, dev.nip, jenis, statusWaktu,
    fmt(now, "yyyy-MM-dd"), fmt(now, "HH:mm:ss"),
    data.lat || "", data.lng || "", data.akurasi || "",
    jarak === "" ? "" : Math.round(jarak), linkLok, ket
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

  const asli = new Date();
  let waktu = asli;
  // Jurnal susulan: tanggalKegiatan (YYYY-MM-DD) opsional untuk mencatat hari yang telah lewat.
  // Jam tetap memakai jam submit asli; tanggal masa depan diabaikan (dianggap jurnal hari ini).
  if (data.tanggalKegiatan && /^\d{4}-\d{2}-\d{2}$/.test(data.tanggalKegiatan)) {
    const bagian = data.tanggalKegiatan.split("-").map(Number);
    const dipilih = new Date(bagian[0], bagian[1] - 1, bagian[2], asli.getHours(), asli.getMinutes(), asli.getSeconds());
    if (dipilih <= asli) waktu = dipilih;
  }
  const fotoUrl = simpanFoto(data.foto, dev.nama, "jurnal", asli);
  const linkLok = (data.lat && data.lng) ? "https://maps.google.com/?q=" + data.lat + "," + data.lng : "";
  getSheetJurnal().appendRow([
    waktu, dev.deviceId, dev.nama, dev.nip, fmt(waktu, "yyyy-MM-dd"), fmt(waktu, "HH:mm:ss"),
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
function rekapData(data, namaSheet, header) {
  const isAdmin = data.adminPassword && data.adminPassword === getAdminPassword();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(namaSheet);
  if (!sheet) return jsonOutput({ status: "success", data: [], isAdmin: !!isAdmin });
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOutput({ status: "success", data: [], isAdmin: !!isAdmin });
  values.shift(); // buang baris header di sheet; nama kolom diambil dari konstanta (header) agar selalu cocok dgn urutan tulis
  const idxDev = header.indexOf("Device ID");
  const idxNip = header.indexOf("NIP/ID");
  let rows;
  if (isAdmin) {
    rows = values;
  } else {
    // Gabungkan lintas-perangkat milik orang yang sama (NIP sama), agar 1 orang dengan
    // beberapa HP tetap melihat satu laporan gabungan, bukan terpecah per perangkat.
    const devSaya = cariPerangkat(data.deviceId);
    const nipSaya = (devSaya && devSaya.nip) ? String(devSaya.nip).trim() : "";
    rows = values.filter(function (r) {
      if (String(r[idxDev]) === String(data.deviceId)) return true;
      if (nipSaya && idxNip !== -1 && String(r[idxNip]).trim() === nipSaya) return true;
      return false;
    });
  }
  const out = rows.map(function (row) {
    const obj = {};
    header.forEach(function (h, i) {
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
  if (cekAdmin(data)) return jsonOutput({ status: "success", message: "Login berhasil.", role: "ppk" });
  if (cekKepegawaian(data)) return jsonOutput({ status: "success", message: "Login berhasil.", role: "kepegawaian" });
  return jsonOutput({ status: "error", message: "Email atau password salah." });
}

function adminData(data) {
  if (!cekAdminAtauKepegawaian(data)) return jsonOutput({ status: "error", message: "Email atau password salah." });
  const role = cekAdmin(data) ? "ppk" : "kepegawaian";
  return jsonOutput({ status: "success", role: role, perangkat: listPerangkat(), pengaturan: getPengaturanPublic() });
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

function editPerangkat(data) {
  // Perbaiki Nama/NIP satu baris perangkat (mis. typo NIP yang menggagalkan penggabungan
  // laporan lintas-perangkat berdasarkan NIP).
  if (!cekAdmin(data)) return jsonOutput({ status: "error", message: "Email atau password admin salah." });
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "error", message: "Perangkat tidak ditemukan." });
  if (!data.namaBaru || !String(data.namaBaru).trim()) return jsonOutput({ status: "error", message: "Nama wajib diisi." });
  if (!data.nipBaru || !String(data.nipBaru).trim()) return jsonOutput({ status: "error", message: "NIP/ID wajib diisi." });
  const sheet = getSheetPerangkat();
  sheet.getRange(dev.rowIndex, 2).setValue(String(data.namaBaru).trim());
  sheet.getRange(dev.rowIndex, 3).setValue(String(data.nipBaru).trim());
  sheet.getRange(dev.rowIndex, 6).setValue(new Date());
  return jsonOutput({ status: "success", message: "Data perangkat diperbarui." });
}

function setRolePerangkat(data) {
  // PPK-only: tandai/lepas tanda "PPK" pada satu perangkat. Perangkat bertanda PPK
  // dikecualikan dari Data Master PJLP, dropdown pegawai, dan Daftar Nominatif Gaji.
  if (!cekAdmin(data)) return jsonOutput({ status: "error", message: "Email atau password admin salah." });
  const dev = cariPerangkat(data.deviceId);
  if (!dev) return jsonOutput({ status: "error", message: "Perangkat tidak ditemukan." });
  const roleBaru = data.roleBaru === "PPK" ? "PPK" : "";
  getSheetPerangkat().getRange(dev.rowIndex, 7).setValue(roleBaru);
  return jsonOutput({ status: "success", message: roleBaru ? "Ditandai sebagai PPK." : "Tanda PPK dilepas." });
}

/* ============== DATA MASTER PJLP (admin-only, data sensitif) ============== */
function fmtTglFleksibel(v) {
  if (v instanceof Date) return fmt(v, "yyyy-MM-dd");
  return v || "";
}
function getDataMaster() {
  const values = getSheetMasterPjlp().getDataRange().getValues();
  values.shift();
  return values.map(function (r, i) {
    return {
      rowIndex: i + 2, nip: String(r[0]), nama: r[1], nik: String(r[2] || ""), npwp: String(r[3] || ""),
      jabatan2026: r[4] || "", alamat: r[5] || "", nilaiHps: r[6] || "", hargaNegosiasi: r[7] || "",
      rekening: r[8] || "", pendidikan: r[9] || "",
      kontrakMulai: fmtTglFleksibel(r[10]), kontrakSelesai: fmtTglFleksibel(r[11]),
      diperbarui: r[12] instanceof Date ? fmt(r[12], "yyyy-MM-dd HH:mm") : r[12],
      honorariumBulanan: r[13] || ""
    };
  });
}
function adminDataMaster(data) {
  // PPK atau Kepegawaian: mengembalikan data sensitif (NIK/NPWP/rekening). Endpoint mandiri
  // PJLP (cekPerangkat) TIDAK memakai fungsi ini dan tidak pernah mengirim data ini ke device biasa.
  if (!cekAdminAtauKepegawaian(data)) return jsonOutput({ status: "error", message: "Email atau password salah." });
  return jsonOutput({ status: "success", master: getDataMaster() });
}
function simpanDataMaster(data) {
  if (!cekAdminAtauKepegawaian(data)) return jsonOutput({ status: "error", message: "Email atau password salah." });
  if (!data.nip) return jsonOutput({ status: "error", message: "NIP/ID wajib diisi." });
  const sheet = getSheetMasterPjlp();
  const existing = getDataMaster().filter(function (m) { return m.nip === String(data.nip); })[0];
  const now = new Date();
  const row = [
    String(data.nip), data.nama || "", data.nik || "", data.npwp || "", data.jabatan2026 || "",
    data.alamat || "", data.nilaiHps || "", data.hargaNegosiasi || "", data.rekening || "", data.pendidikan || "",
    data.kontrakMulai || "", data.kontrakSelesai || "", now, data.honorariumBulanan || ""
  ];
  if (existing) sheet.getRange(existing.rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return jsonOutput({ status: "success", message: "Data master tersimpan." });
}

/* ============== REGISTER DOKUMEN PENGADAAN (admin-only, referensi) ============== */
function adminRegisterDokumen(data) {
  if (!cekAdminAtauKepegawaian(data)) return jsonOutput({ status: "error", message: "Email atau password salah." });
  const values = getSheetRegisterDokumen().getDataRange().getValues();
  const headers = values.shift();
  const out = values.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) {
      let v = row[i];
      if (v instanceof Date) v = fmt(v, "yyyy-MM-dd");
      obj[h] = v;
    });
    return obj;
  });
  return jsonOutput({ status: "success", data: out });
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
  if (data.bebasJumat !== undefined) p.setProperty("BEBAS_JUMAT", data.bebasJumat ? "true" : "false");
  if (data.passwordBaru) {
    if (String(data.passwordBaru).length < 6) return jsonOutput({ status: "error", message: "Password baru minimal 6 karakter." });
    p.setProperty("ADMIN_PASSWORD", String(data.passwordBaru));
  }
  if (data.emailAdminBaru) {
    if (String(data.emailAdminBaru).indexOf("@") === -1) return jsonOutput({ status: "error", message: "Email admin tidak valid." });
    p.setProperty("ADMIN_EMAIL", String(data.emailAdminBaru).trim());
  }
  if (data.kepegawaianEmailBaru !== undefined && data.kepegawaianEmailBaru !== "") {
    if (String(data.kepegawaianEmailBaru).indexOf("@") === -1) return jsonOutput({ status: "error", message: "Email Kepegawaian tidak valid." });
    p.setProperty("KEPEGAWAIAN_EMAIL", String(data.kepegawaianEmailBaru).trim());
  }
  if (data.kepegawaianPasswordBaru) {
    if (String(data.kepegawaianPasswordBaru).length < 6) return jsonOutput({ status: "error", message: "Password Kepegawaian minimal 6 karakter." });
    p.setProperty("KEPEGAWAIAN_PASSWORD", String(data.kepegawaianPasswordBaru));
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
  // PPK (kontrol penuh): email HARUS cocok DAN password HARUS cocok.
  const emailOk = data.email !== undefined && String(data.email).trim().toLowerCase() === getAdminEmail().toLowerCase();
  const passOk = data.password !== undefined && String(data.password) === getAdminPassword();
  return emailOk && passOk;
}
function getKepegawaianEmail() { return props().getProperty("KEPEGAWAIAN_EMAIL") || ""; }
function getKepegawaianPassword() { return props().getProperty("KEPEGAWAIAN_PASSWORD") || ""; }
function cekKepegawaian(data) {
  // Role Kepegawaian: akun terpisah, akses terbatas (lihat cekAdminAtauKepegawaian).
  // Belum aktif sampai PPK mengatur email+password Kepegawaian lewat Pengaturan.
  const em = getKepegawaianEmail(), pw = getKepegawaianPassword();
  if (!em || !pw) return false;
  const emailOk = data.email !== undefined && String(data.email).trim().toLowerCase() === em.toLowerCase();
  const passOk = data.password !== undefined && String(data.password) === pw;
  return emailOk && passOk;
}
function cekAdminAtauKepegawaian(data) { return cekAdmin(data) || cekKepegawaian(data); }
function isPasswordAdminAtauKepegawaian(pw) {
  if (!pw) return false;
  const kepPw = getKepegawaianPassword();
  return String(pw) === getAdminPassword() || (!!kepPw && String(pw) === kepPw);
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
    abaikanLokasi: (p.getProperty("ABAIKAN_LOKASI") || "true") === "true",
    bebasJumat: (p.getProperty("BEBAS_JUMAT") || "true") === "true"
  };
}
function getPengaturanPublic() {
  const s = getPengaturan();
  return {
    lat: isNaN(s.lat) ? "" : s.lat, lng: isNaN(s.lng) ? "" : s.lng, radius: s.radius || "",
    namaInstansi: s.namaInstansi, jamMasuk: s.jamMasuk, jamPulang: s.jamPulang,
    bufferMasuk: s.bufferMasuk, bufferPulang: s.bufferPulang, abaikanLokasi: s.abaikanLokasi,
    bebasJumat: s.bebasJumat, adminEmail: getAdminEmail(), kepegawaianEmail: getKepegawaianEmail()
  };
}

function getDataPerangkat() {
  const values = getSheetPerangkat().getDataRange().getValues();
  values.shift();
  return values.map(function (r, i) {
    return { rowIndex: i + 2, deviceId: String(r[0]), nama: r[1], nip: r[2], status: r[3], didaftarkan: r[4], role: r[6] || "" };
  });
}
function cariPerangkat(deviceId) {
  if (!deviceId) return null;
  return getDataPerangkat().filter(function (d) { return d.deviceId === String(deviceId); })[0] || null;
}
function listPerangkat() {
  const semua = getDataPerangkat();
  return semua.map(function (d) {
    const out = { deviceId: d.deviceId, nama: d.nama, nip: d.nip, status: d.status, role: d.role || "", didaftarkan: d.didaftarkan instanceof Date ? fmt(d.didaftarkan, "yyyy-MM-dd HH:mm") : d.didaftarkan };
    if (d.status === "pending" && d.nip && d.role !== "PPK") {
      const nipTrim = String(d.nip).trim();
      const cocok = semua.filter(function (x) {
        return x.status === "disetujui" && x.role !== "PPK" && x.nip && String(x.nip).trim() === nipTrim && x.deviceId !== d.deviceId;
      })[0];
      if (cocok) out.kemungkinanSama = cocok.nama;
    }
    return out;
  });
}

function perbaikiHeader() {
  // Menulis ulang baris-1 (header) agar cocok dengan urutan data yang ditulis kode.
  // Berguna untuk sheet lama yang headernya dibuat di versi sebelumnya.
  [[SHEET_ABSEN, HEADER_ABSEN], [SHEET_JURNAL, HEADER_JURNAL], [SHEET_IZIN, HEADER_IZIN], [SHEET_PERANGKAT, HEADER_PERANGKAT],
   [SHEET_MASTER_PJLP, HEADER_MASTER_PJLP], [SHEET_REGISTER_DOKUMEN, HEADER_REGISTER_DOKUMEN]]
    .forEach(function (pair) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(pair[0]);
      if (!sheet) return;
      sheet.getRange(1, 1, 1, pair[1].length).setValues([pair[1]]).setFontWeight("bold");
    });
}

function seedDataAwal() {
  // Idempotent: hanya mengisi jika sheet masih kosong (belum ada baris data).
  const shReg = getSheetRegisterDokumen();
  if (shReg.getDataRange().getNumRows() < 2 && SEED_REGISTER_DOKUMEN.length) {
    shReg.getRange(2, 1, SEED_REGISTER_DOKUMEN.length, HEADER_REGISTER_DOKUMEN.length).setValues(SEED_REGISTER_DOKUMEN);
  }
  const shMaster = getSheetMasterPjlp();
  if (shMaster.getDataRange().getNumRows() < 2 && SEED_MASTER_PJLP.length) {
    const now = new Date();
    const rows = SEED_MASTER_PJLP.map(function (r) { return r.slice(0, 12).concat([now, r[12]]); });
    shMaster.getRange(2, 1, rows.length, HEADER_MASTER_PJLP.length).setValues(rows);
  }
}

function getSheetAbsen() { return getOrCreateSheet(SHEET_ABSEN, HEADER_ABSEN); }
function getSheetJurnal() { return getOrCreateSheet(SHEET_JURNAL, HEADER_JURNAL); }
function getSheetIzin() { return getOrCreateSheet(SHEET_IZIN, HEADER_IZIN); }
function getSheetPerangkat() { return getOrCreateSheet(SHEET_PERANGKAT, HEADER_PERANGKAT); }
function getSheetMasterPjlp() { return getOrCreateSheet(SHEET_MASTER_PJLP, HEADER_MASTER_PJLP); }
function getSheetRegisterDokumen() { return getOrCreateSheet(SHEET_REGISTER_DOKUMEN, HEADER_REGISTER_DOKUMEN); }
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
