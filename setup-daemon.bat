@echo off
REM ─────────────────────────────────────────────────────────────
REM setup-daemon.bat
REM Registra el daemon de respaldo de datos Y el de fotos
REM en el Programador de Tareas de Windows.
REM Ejecutar como Administrador.
REM ─────────────────────────────────────────────────────────────

SET SCRIPT_DIR=%~dp0
SET NODE_SCRIPT_DATOS=%SCRIPT_DIR%backup-local-daemon.js
SET NODE_SCRIPT_FOTOS=%SCRIPT_DIR%backup-fotos-daemon.js

REM Buscar node.exe
where node >nul 2>&1
IF ERRORLEVEL 1 (
  echo ERROR: Node.js no encontrado.
  pause
  exit /b 1
)
FOR /F "tokens=*" %%i IN ('where node') DO SET NODE_PATH=%%i

echo.
echo Registrando tareas...
echo   Datos: %NODE_SCRIPT_DATOS%
echo   Fotos: %NODE_SCRIPT_FOTOS%
echo   Node:  %NODE_PATH%
echo.

REM Eliminar tareas anteriores si existen
schtasks /Delete /TN "GestProBackupDaemon" /F >nul 2>&1
schtasks /Delete /TN "GestProFotosDaemon"  /F >nul 2>&1

REM Crear tarea datos: corre al iniciar sesion
schtasks /Create /TN "GestProBackupDaemon" /TR "\"%NODE_PATH%\" \"%NODE_SCRIPT_DATOS%\"" /SC ONLOGON /F
IF ERRORLEVEL 1 ( echo ERROR al crear tarea de datos. & pause & exit /b 1 )

REM Crear tarea fotos: corre al iniciar sesion
schtasks /Create /TN "GestProFotosDaemon" /TR "\"%NODE_PATH%\" \"%NODE_SCRIPT_FOTOS%\"" /SC ONLOGON /F
IF ERRORLEVEL 1 ( echo ERROR al crear tarea de fotos. & pause & exit /b 1 )

echo Tareas registradas. Iniciando ahora...
start "" "%NODE_PATH%" "%NODE_SCRIPT_DATOS%"
start "" "%NODE_PATH%" "%NODE_SCRIPT_FOTOS%"

echo.
echo Listo. Los respaldos se guardan en:
echo   Datos: %USERPROFILE%\Downloads\GestPro-Backups\
echo   Fotos: %USERPROFILE%\Downloads\GestPro-Fotos\
echo.
pause
