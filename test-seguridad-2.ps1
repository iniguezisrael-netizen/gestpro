# ===== Prueba de seguridad — Parte 2 (verificacion de contenido) =====

Write-Host "`n--- A. Contenido real de /firebase.json (deberia ser SPA o el JSON real) ---" -ForegroundColor Cyan
$body = curl.exe -s "https://sistemas.camperslacuesta.com/firebase.json"
Write-Host $body.Substring(0, [Math]::Min(300, $body.Length))

Write-Host "`n--- B. Content-Type y tamano de cada ruta sensible ---" -ForegroundColor Cyan
$paths = @("firebase.json","firestore.rules","storage.rules",".env","backup.zip","admin.html")
foreach ($p in $paths) {
  Write-Host "`n>> $p"
  curl.exe -s -D - -o NUL "https://sistemas.camperslacuesta.com/$p" | Select-String "HTTP/|Content-Type|Content-Length"
}

Write-Host "`n--- C. Comparar contra la pagina principal (index real) ---" -ForegroundColor Cyan
curl.exe -s -D - -o NUL "https://sistemas.camperslacuesta.com/" | Select-String "HTTP/|Content-Type|Content-Length"

Write-Host "`n--- D. runQuery bien formado, sin sesion (debe dar 403 PERMISSION_DENIED) ---" -ForegroundColor Cyan
$body2 = '{"structuredQuery":{"from":[{"collectionId":"ventas"}],"limit":1}}'
curl.exe -s -X POST -H "Content-Type: application/json" -d $body2 "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents:runQuery"

Write-Host "`n`n--- E. Escritura bien formada, sin sesion (debe dar 403 PERMISSION_DENIED) ---" -ForegroundColor Cyan
$body3 = '{"fields":{"hack":{"stringValue":"prueba-no-autorizada"}}}'
curl.exe -s -X PATCH -H "Content-Type: application/json" -d $body3 "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/ventas/data?updateMask.fieldPaths=hack"

Write-Host "`n`n=== Fin parte 2 ===" -ForegroundColor Green
