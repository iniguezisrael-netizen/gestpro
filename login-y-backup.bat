@echo off
echo Iniciando sesion en Firebase...
firebase login
echo.
echo Leyendo backup...
node leer-backup.js
echo.
pause
