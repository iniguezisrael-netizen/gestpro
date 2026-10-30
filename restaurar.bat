@echo off
cd /d C:\Users\israe\Downloads\firebase-deploy
echo Desplegando storage rules (revertiendo regla temporal)...
firebase deploy --only storage > restaurar-deploy-output.txt 2>&1
echo Deploy terminado.
echo.
echo Restaurando item 313 en Firestore...
node restaurar-item313.js
echo.
echo Listo. Revisa restaurar-output.log para el resultado.
pause
