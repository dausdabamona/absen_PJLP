@echo off
setlocal
chcp 65001 >nul
REM ============================================================
REM  Deploy backend Apps Script (Code.gs) - Absensi PJLP
REM  Cara pakai : klik ganda file ini, atau ketik deploy.bat di CMD.
REM  Urutan benar: git pull  ->  clasp push  ->  clasp deploy
REM
REM  Prasyarat (cukup sekali disiapkan):
REM    1. Node.js terpasang
REM    2. npm install -g @google/clasp@2.4.2
REM    3. clasp login   (login akun Google yang punya akses script)
REM  File .bat ini harus berada di dalam folder repo (ada .clasp.json).
REM ============================================================

set "DEPLOY_ID=AKfycbxsQXxfUL5_nlspnxZF8pNwaghRbH4gk0jA6duPpcKdPBG7Mz4YVlqdpDoM_o-s2L8f"

REM Pindah ke folder tempat file .bat ini berada (root repo)
cd /d "%~dp0"

if not exist ".clasp.json" (
  echo [X] .clasp.json tidak ditemukan.
  echo     Pastikan deploy.bat berada di dalam folder repo absen_PJLP.
  goto :end
)

echo.
echo ============================================================
echo  1/3  Mengambil kode terbaru dari GitHub (git pull)...
echo ============================================================
call git pull
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  2/3  Push Code.gs ke Apps Script (clasp push)...
echo ============================================================
call clasp push --force
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  3/3  Aktifkan versi baru ke Web App /exec (clasp deploy)...
echo ============================================================
call clasp deploy -i %DEPLOY_ID% -d "deploy.bat"
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  SELESAI. Backend sudah diperbarui dan aktif di URL /exec.
echo ============================================================
goto :end

:error
echo.
echo ------------------------------------------------------------
echo  GAGAL. Periksa pesan error di atas.
echo  Cek: sudah "clasp login"? Node/clasp terpasang?
echo       Koneksi internet aktif? Berada di folder repo?
echo ------------------------------------------------------------

:end
echo.
pause
