@echo off
cd /d "C:\Users\israe\Downloads\firebase-deploy"
echo Desplegando hosting + reglas Firestore...
call firebase deploy --only hosting,firestore:rules --project campers-la-cuesta-84ade > deploy-full-output.txt 2>&1
type deploy-full-output.txt
echo.
echo Deploy terminado. Presiona cualquier tecla para cerrar...
pause
