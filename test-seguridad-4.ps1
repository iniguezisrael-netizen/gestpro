# ===== Prueba de seguridad — Parte 4 (JSON via archivo, evita el problema de comillas) =====

$queryJson = '{"structuredQuery":{"from":[{"collectionId":"ventas"}],"limit":1}}'
$queryJson | Out-File -Encoding utf8 -NoNewline "$env:TEMP\query.json"

$writeJson = '{"fields":{"hack":{"stringValue":"prueba-no-autorizada"}}}'
$writeJson | Out-File -Encoding utf8 -NoNewline "$env:TEMP\write.json"

Write-Host "`n--- D. runQuery bien formado, sin sesion (debe dar 403 PERMISSION_DENIED) ---" -ForegroundColor Cyan
curl.exe -s -X POST -H "Content-Type: application/json" --data-binary "@$env:TEMP\query.json" "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents:runQuery"

Write-Host "`n`n--- E. Escritura bien formada, sin sesion (debe dar 403 PERMISSION_DENIED) ---" -ForegroundColor Cyan
curl.exe -s -X PATCH -H "Content-Type: application/json" --data-binary "@$env:TEMP\write.json" "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/ventas/data?updateMask.fieldPaths=hack"

Write-Host "`n`n=== Fin parte 4 ===" -ForegroundColor Green
