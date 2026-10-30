# ============================================================
# backup_campers.ps1 — Respaldo diario de CampersLaCuesta
# Guarda en: C:\Users\israe\Documents\CampersBackups\
# Conserva los últimos 7 respaldos (borra los más viejos)
# ============================================================

$origen    = "C:\Users\israe\Downloads\firebase-deploy"
$destino   = "C:\Users\israe\Documents\CampersBackups"
$fecha     = Get-Date -Format "yyyy-MM-dd_HH-mm"
$zipNombre = "campers_$fecha.zip"
$zipRuta   = Join-Path $destino $zipNombre

# Crear carpeta de respaldos si no existe
if (-not (Test-Path $destino)) {
    New-Item -ItemType Directory -Path $destino | Out-Null
}

# Crear el zip
Compress-Archive -Path $origen -DestinationPath $zipRuta -Force
Write-Host "Respaldo creado: $zipNombre"

# Borrar respaldos viejos — conservar solo los 7 más recientes
$respaldos = Get-ChildItem -Path $destino -Filter "campers_*.zip" |
             Sort-Object LastWriteTime -Descending

if ($respaldos.Count -gt 7) {
    $respaldos | Select-Object -Skip 7 | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Host "Borrado respaldo viejo: $($_.Name)"
    }
}

Write-Host "Listo. Respaldos en: $destino"
