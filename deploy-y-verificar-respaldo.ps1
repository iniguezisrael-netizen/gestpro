Set-Location "C:\Users\israe\Downloads\firebase-deploy"

Write-Host "Desplegando a Firebase Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting

Write-Host ""
Write-Host "Esperando 10 segundos para que el CDN se actualice..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Verificando deploy..." -ForegroundColor Cyan
try {
    $content = (Invoke-WebRequest -Uri "https://sistemas.camperslacuesta.com" -UseBasicParsing -TimeoutSec 15).Content
    $hits1 = ([regex]::Matches($content, 'btn-descargar-respaldo')).Count
    $hits2 = ([regex]::Matches($content, 'btnRespaldo')).Count
    if ($hits1 -gt 0 -and $hits2 -gt 0) {
        $msg = "OK - Deploy verificado: btn-descargar-respaldo=$hits1 refs, btnRespaldo=$hits2 refs en produccion"
        Write-Host $msg -ForegroundColor Green
    } else {
        $msg = "FALLO - Codigo nuevo NO esta en produccion (btn-descargar-respaldo=$hits1, btnRespaldo=$hits2)"
        Write-Host $msg -ForegroundColor Red
    }
    $msg | Out-File "$PSScriptRoot\verificar-deploy-output.txt" -Encoding UTF8
} catch {
    $msg = "ERROR: $($_.Exception.Message)"
    Write-Host $msg -ForegroundColor Red
    $msg | Out-File "$PSScriptRoot\verificar-deploy-output.txt" -Encoding UTF8
}

Write-Host ""
pause
