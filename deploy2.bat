@echo off
cd /d C:\Users\israe\Downloads\firebase-deploy
echo y | firebase deploy --only functions,hosting --project campers-la-cuesta-84ade --force
echo.
echo === DEPLOY TERMINADO ===
pause
