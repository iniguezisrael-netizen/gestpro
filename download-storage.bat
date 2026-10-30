@echo off
cd /d "C:\Users\israe\Downloads\firebase-deploy"
node download-storage.js > download-output.txt 2>&1
type download-output.txt
echo.
echo Presiona cualquier tecla para cerrar...
pause > nul
