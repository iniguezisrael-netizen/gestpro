@echo off
cd /d C:\Users\israe\Downloads\firebase-deploy
echo Desplegando solo Hosting...
firebase deploy --only hosting --project campers-la-cuesta-84ade
echo.
echo === HOSTING DESPLEGADO ===
pause
