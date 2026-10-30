Set-Location "C:\Users\israe\Downloads\firebase-deploy"
Write-Host "Desplegando solo Hosting..."
firebase deploy --only hosting --project campers-la-cuesta-84ade
Write-Host ""
Write-Host "=== HOSTING DESPLEGADO ==="
Read-Host "Presiona Enter para cerrar"
