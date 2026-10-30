@echo off
cd /d C:\Users\israe\Downloads\firebase-deploy
echo Desplegando storage rules temporales...
firebase deploy --only storage > deploy-storage-output.txt 2>&1
echo Deploy terminado.
echo.
echo Descargando backup...
node leer-backup.js > run-backup-output.txt 2>&1
echo Descarga terminada.
