@echo off
cd /d "C:\Users\israe\Downloads\firebase-deploy"
echo Iniciando daemon de respaldo local...
echo Los respaldos se guardan en: C:\Users\israe\Documents\respaldo app\
echo.
echo (Deja esta ventana abierta para que el daemon siga funcionando)
echo Para detenerlo, cierra esta ventana.
echo.
node backup-local-daemon.js
pause
