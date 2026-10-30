@echo off
cd /d C:\Users\israe\Downloads\firebase-deploy
echo Configurando secrets de R2 en Firebase...
echo b97d71115368d1be4bf544a839104a7b | firebase functions:secrets:set R2_ACCESS_KEY_ID --project campers-la-cuesta-84ade
echo 72045db307465e2b9924d9a08ffbd6869e03a78e2a9ed866d6cb1ec593edf35a | firebase functions:secrets:set R2_SECRET_ACCESS_KEY --project campers-la-cuesta-84ade
echo.
echo === SECRETS CONFIGURADOS ===
pause
