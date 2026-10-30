Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Refrescar PATH para incluir Python recien instalado
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

cd C:\Users\israe\Downloads\firebase-deploy

# Crear entorno virtual Python si no existe
$venvActivate = "functions_py\venv\Scripts\activate.bat"
if (-not (Test-Path $venvActivate)) {
    Write-Host "Creando entorno virtual Python..." -ForegroundColor Cyan
    python -m venv functions_py\venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR al crear venv. Verifica que Python 3.11 este instalado." -ForegroundColor Red
        Read-Host "Enter para salir"
        exit 1
    }
}

Write-Host "Instalando dependencias Python..." -ForegroundColor Cyan
& "functions_py\venv\Scripts\pip.exe" install -r functions_py\requirements.txt

# Parchar olefile2.py (tiene sintaxis Python 2 que rompe Cloud Build)
$oleFile = "functions_py\venv\Lib\site-packages\olefile\olefile2.py"
if (Test-Path $oleFile) {
    Write-Host "Parcheando olefile2.py (sintaxis Python 2)..." -ForegroundColor Cyan
    Set-Content $oleFile "# olefile2.py - Python 2 compatibility shim (not used in Python 3)`nraise ImportError('olefile2 is a Python 2 module. Use olefile instead.')"
}

npm install --prefix functions
firebase deploy
