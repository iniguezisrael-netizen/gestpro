Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
cd C:\Users\israe\Downloads\firebase-deploy

# Ocultar venv de Windows para que no se suba a Cloud Run (Linux)
$venvPath = "functions_py\venv"
$venvTmp  = "functions_py\_venv_skip"
if (Test-Path $venvPath) {
    Write-Host "Ocultando venv de Windows..." -ForegroundColor Yellow
    Rename-Item $venvPath $venvTmp
}

try {
    Write-Host "Desplegando funciones Python..." -ForegroundColor Cyan
    firebase deploy --only functions:python
} finally {
    # Restaurar venv aunque falle el deploy
    if (Test-Path $venvTmp) {
        Write-Host "Restaurando venv..." -ForegroundColor Yellow
        Rename-Item $venvTmp $venvPath
    }
}
Write-Host "Listo." -ForegroundColor Green
