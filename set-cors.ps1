# ══════════════════════════════════════════════════════════════
#  Configurar CORS en Firebase Storage — Campers La Cuesta
#  Corre este script UNA SOLA VEZ.
#  Requiere: Firebase CLI instalado (firebase --version para verificar)
# ══════════════════════════════════════════════════════════════

Set-Location "C:\Users\israe\Downloads\firebase-deploy"

Write-Host "`n=== CONFIGURANDO CORS EN FIREBASE STORAGE ===" -ForegroundColor Cyan

# Intentar con Firebase CLI (v12+)
try {
    $out = firebase storage:cors set cors.json --project campers-la-cuesta-84ade 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ CORS configurado con Firebase CLI" -ForegroundColor Green
    } else {
        throw "Firebase CLI error: $out"
    }
} catch {
    Write-Host "⚠️  Firebase CLI no tiene el comando storage:cors." -ForegroundColor Yellow
    Write-Host "    Intenta con gsutil (Google Cloud SDK):" -ForegroundColor Yellow
    Write-Host "    gsutil cors set cors.json gs://campers-la-cuesta-84ade.appspot.com" -ForegroundColor White
}

Read-Host "`nPresiona Enter para cerrar"
