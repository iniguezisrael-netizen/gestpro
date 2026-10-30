# ===== Prueba de seguridad — Campers La Cuesta =====
# Resultado esperado en TODO: 403 (Storage/Firestore) o 200 con cuerpo "PERMISSION_DENIED",
# y 404 en rutas sensibles. Si ves 200 con datos reales, avisa de inmediato.

Write-Host "`n--- 1. Cabeceras de seguridad (sin cache) ---" -ForegroundColor Cyan
curl.exe -s -D - -o NUL "https://sistemas.camperslacuesta.com/?nocache=$(Get-Random)"

Write-Host "`n--- 2. Acceso anonimo a colecciones de Firestore ---" -ForegroundColor Cyan
$cols = @("ventas","productos","materia","consignacion","cotizaciones","cajas","reparaciones","bodegas","entregas","facturas","cobranza","vehiculos","produccion","catalogoMateriales")
foreach ($c in $cols) {
  $url = "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/$c/data"
  $code = curl.exe -s -o NUL -w "%{http_code}" $url
  Write-Host "$c -> $code"
}

Write-Host "`n--- 3. Lectura de roles/usuarios sin sesion ---" -ForegroundColor Cyan
curl.exe -s -o NUL -w "roles (coleccion) -> %{http_code}`n" "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/roles"
curl.exe -s -o NUL -w "users/data -> %{http_code}`n" "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/users/data"

Write-Host "`n--- 4. Query general (runQuery) sin sesion ---" -ForegroundColor Cyan
$body = '{"structuredQuery":{"from":[{"collectionId":"ventas"}]}}'
curl.exe -s -o NUL -w "runQuery ventas -> %{http_code}`n" -X POST -H "Content-Type: application/json" -d $body "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents:runQuery"

Write-Host "`n--- 5. Intento de ESCRITURA sin sesion (debe fallar) ---" -ForegroundColor Cyan
$writeBody = '{"fields":{"hack":{"stringValue":"prueba-no-autorizada"}}}'
curl.exe -s -o NUL -w "PATCH ventas/data -> %{http_code}`n" -X PATCH -H "Content-Type: application/json" -d $writeBody "https://firestore.googleapis.com/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/ventas/data"

Write-Host "`n--- 6. Listado de archivos en Storage sin sesion ---" -ForegroundColor Cyan
curl.exe -s -o NUL -w "listado bucket -> %{http_code}`n" "https://firebasestorage.googleapis.com/v0/b/campers-la-cuesta-84ade.appspot.com/o?prefix=fotos/"

Write-Host "`n--- 7. Rutas/archivos sensibles en el hosting ---" -ForegroundColor Cyan
$paths = @("firebase.json","firestore.rules","storage.rules","package.json",".git/config","admin.html",".env","config.js","backup.zip")
foreach ($p in $paths) {
  $code = curl.exe -s -o NUL -w "%{http_code}" "https://sistemas.camperslacuesta.com/$p"
  Write-Host "$p -> $code"
}

Write-Host "`n--- 8. Enumeracion de usuario en login (no debe distinguir) ---" -ForegroundColor Cyan
$apiKey = "PEGAR_AQUI_TU_API_KEY_SI_LA_TIENES_A_LA_MANO"
Write-Host "(este paso lo hacemos juntos si hace falta, salta si no tienes la API key a mano)"

Write-Host "`n=== Fin de pruebas ===" -ForegroundColor Green
