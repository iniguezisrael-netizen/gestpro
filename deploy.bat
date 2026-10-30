@echo off
cd /d "C:\Users\israe\Downloads\firebase-deploy"

echo === BACKUP DE FIRESTORE ===
node backup-firestore-predeploy.js
if %ERRORLEVEL% neq 0 (
  echo.
  echo DEPLOY ABORTADO — el backup falló. Revisa el error arriba.
  pause
  exit /b 1
)

echo === DEPLOY ===
echo y | firebase deploy --only hosting --project campers-la-cuesta-84ade --force
echo.
echo === DEPLOY TERMINADO ===
pause
