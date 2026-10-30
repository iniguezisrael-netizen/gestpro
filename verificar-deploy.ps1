$url = "https://sistemas.camperslacuesta.com"
try {
    $content = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15).Content
    $hits1 = ([regex]::Matches($content, 'renderHerramientas')).Count
    $hits2 = ([regex]::Matches($content, 'herramientasAsignadas')).Count
    $hits3 = ([regex]::Matches($content, 'btn-descargar-respaldo')).Count
    if ($hits1 -gt 0 -and $hits2 -gt 0 -and $hits3 -gt 0) {
        "OK - Deploy verificado: renderHerramientas=$hits1, herramientasAsignadas=$hits2, btn-descargar-respaldo=$hits3" | Out-File "$PSScriptRoot\verificar-deploy-output.txt" -Encoding UTF8
    } else {
        "FALLO - Codigo nuevo NO esta en produccion (renderHerramientas=$hits1, herramientasAsignadas=$hits2, btn-descargar-respaldo=$hits3)" | Out-File "$PSScriptRoot\verificar-deploy-output.txt" -Encoding UTF8
    }
} catch {
    "ERROR: $($_.Exception.Message)" | Out-File "$PSScriptRoot\verificar-deploy-output.txt" -Encoding UTF8
}
Write-Host "Listo."
pause
