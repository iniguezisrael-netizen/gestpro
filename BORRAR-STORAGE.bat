@echo off
cd /d C:\Users\israe\Downloads\firebase-deploy
echo Buscando token de Firebase...

REM Metodo 1: leer access_token del configstore de firebase-tools
powershell -NoProfile -Command ^
  "$p1='%APPDATA%\configstore\firebase-tools.json';$p2='%USERPROFILE%\.config\configstore\firebase-tools.json';" ^
  "if(Test-Path $p1){$f=$p1}elseif(Test-Path $p2){$f=$p2}else{exit 1};" ^
  "$j=Get-Content $f|ConvertFrom-Json;" ^
  "$t=$j.tokens.access_token;if(-not $t){$t=$j.user.access_token};" ^
  "if($t){[System.IO.File]::WriteAllText('%CD%\token.txt',$t)}" ^
  2>nul

if exist token.txt (
  echo Token encontrado en configstore.
  node borrar-storage-viejo.js --borrar
) else (
  echo No se encontro token. Intenta ejecutar: firebase login
)

del token.txt 2>nul
echo.
echo Presione una tecla para cerrar.
pause
