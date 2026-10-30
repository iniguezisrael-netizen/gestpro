@echo off
echo.
echo === Deploy a Cloudflare Pages ===
echo.

set CLOUDFLARE_API_TOKEN=cfut_jkD2WUQjMKEujhAs2D2vJaro9l1ACZUdDZNDmUFN764c1b65
set CLOUDFLARE_ACCOUNT_ID=9cd3aaf5646f228ec0f34092f74fc6b3

echo Preparando archivos limpios (sin .bak)...

:: Crear carpeta temporal sin archivos .bak
if exist "%TEMP%\campers-deploy" rmdir /s /q "%TEMP%\campers-deploy"
mkdir "%TEMP%\campers-deploy"

copy /Y "%~dp0public\index.html" "%TEMP%\campers-deploy\"
copy /Y "%~dp0public\sw.js" "%TEMP%\campers-deploy\"
copy /Y "%~dp0public\logo.png" "%TEMP%\campers-deploy\"
if exist "%~dp0public\manifest.json" copy /Y "%~dp0public\manifest.json" "%TEMP%\campers-deploy\"

echo.
echo Desplegando en Cloudflare Pages...
echo.

cd /d "%TEMP%\campers-deploy"
npx wrangler@latest pages deploy . --project-name campers-la-cuesta --branch main
cd /d "%~dp0"

echo.
echo Limpiando...
rmdir /s /q "%TEMP%\campers-deploy"

pause
