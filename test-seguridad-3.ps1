# ===== Prueba de seguridad — Parte 3 (solo lo que falta) =====

Write-Host "`n--- D. runQuery bien formado, sin sesion (debe dar 403) ---" -ForegroundColor Cyan
$body2 = '{"structuredQuery":{"from":[{"collectionId":"ventas"}],"limit":1}}'
curl.exe -s -X POST -H "Content-Type: application/json" -d $body2 "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents:runQuery"

Write-Host "`n`n--- E. Escritura bien formada, sin sesion (debe dar 403) ---" -ForegroundColor Cyan
$body3 = '{"fields":{"hack":{"stringValue":"prueba-no-autorizada"}}}'
curl.exe -s -X PATCH -H "Content-Type: application/json" -d $body3 "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/ventas/data?updateMask.fieldPaths=hack"

Write-Host "`n`n=== Fin parte 3 ===" -ForegroundColor Green
