@echo off
cd /d "C:\Users\israe\Downloads\firebase-deploy"
echo Desplegando funciones y hosting...
call firebase deploy --only functions,hosting --project campers-la-cuesta-84ade > deploy-output.txt 2>&1
type deploy-output.txt
echo.
echo Deploy terminado. Presiona cualquier tecla para cerrar...
pause
