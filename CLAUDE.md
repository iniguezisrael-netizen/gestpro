# GestPro — CamperERP (Campers La Cuesta)

## Proyecto
- **App**: Single-file HTML monolith (`public/index.html`, ~25 000 líneas)
- **Firebase project**: `campers-la-cuesta-84ade`
- **Hosting**: `sistemas.camperslacuesta.com`
- **Git remote**: `https://github.com/iniguezisrael-netizen/gestpro.git`
- **Credenciales GitHub**: guardadas en credential.helper store del equipo

## Deploy (PowerShell)
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
cd C:\Users\israe\Downloads\firebase-deploy
firebase deploy --only hosting
```
Siempre mandar este script al usuario al terminar cambios en index.html, sin que lo pida.

## Git — después de cada sesión de cambios
```
git add public/index.html public/sw.js   # (o los archivos modificados)
git commit -m "descripción"
git push
```
Incluir siempre en el commit:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WtkKKPFfefRpMgCMQxXHAi
```

## Estructura de datos — CRÍTICO (verificado 2026-11-06)
- **Cada venta es un documento individual** en Firestore: `ventas/{ventaId}`
  - Ejemplo: venta #195 → `ventas/195`
  - Campos del doc: `total`, `pendienteCotizar`, `cliente`, `estado`, `fecha`, `items` (array de productos/servicios de esa venta), etc.
- **264 ventas** en Firestore al 2026-11-06
- Colecciones existentes en Firestore: `_config`, `_logs`, `_meta`, `agenda`, `bodegas`, `cajas`, `catConsig`, `catalogoMateriales`, `checadas`, `checadorConfig`, `clientes`, `clientesCredito`, `cobranza`, `consignacion`, `cotizaciones`, `entregaInsumos`, `facturas`, `herramientas`, `materia`, `ordenesCompra`, `produccion`, `productos`, `proveedores`, `recordatoriosPersonales`, `reparaciones`, `reportesEntrega`, `reportesProduccion`, `roles`, `vehiculos`, `ventas`
- **NO existe** un documento `ventas/data` único — cada entidad es un documento separado
- `fsWriteCollection` en el código puede referirse a colecciones que SÍ usan un doc único (`{col}/data`) — verificar caso por caso
- **RTDB dual-write** (`RTDB_DUAL_WRITE`): existe flag de doble escritura RTDB+Firestore. No desactivar.

## SW Cache — historial de versiones
| Versión        | Commit  | Motivo                          |
|----------------|---------|---------------------------------|
| campers-v316   | anterior| versión previa                  |
| campers-v317   | 74b3f3d | deploy fix serverSnapshot       |

Archivo: `public/sw.js` línea ~9: `const CACHE_VERSION = 'campers-vXXX'`
Incrementar en cada deploy que requiera invalidar caché de usuarios.

## Bugs conocidos y fixes aplicados
### serverSnapshot bug (CORREGIDO — commit 74b3f3d + a4af266)
- **Causa**: `_serverSnapshot` se pre-actualizaba antes de `saveDb`, haciendo que `fsWriteCollection` tratara los items como "no sucios" y saltara el batch write a Firestore.
- **Fix**: mover la actualización de `_serverSnapshot` a DESPUÉS del write exitoso.
- **Impacto**: afectó ventas y posiblemente pedidos. Ventas con `total=0` y `pendienteCotizar=false` quedaron sin precio visible.

### Login link fuera del box (CORREGIDO — commit a4af266)
- El `</div>` de `.login-box` cerraba ANTES del `<p>` de "¿Olvidaste tu contraseña?".
- Fix: mover el cierre del div después del `<p>`.

### Ventas con total=$0 (CORREGIDO — 2026-11-06)
- Ventas afectadas encontradas: NV 13350004, NV 269, NV 300, NV test_write
- Fix aplicado: `pendienteCotizar=true` vía REST API PATCH en cada documento individual
- NV 195 no existía en Firestore (solo en RTDB) — corregida vía PATCH a RTDB: /ventas/195/pendienteCotizar=true
- Script: `fix-ventas-cero.js` (disponible en esta sesión)

## Pendientes de sesiones anteriores
- [ ] `_EMPRESA` security fix: datos bancarios/RFC en HTML público (líneas ~200-250 aprox.)
- [x] `dailyBackup` Cloud Function: `.trim()` ya estaba aplicado — no requería cambio
- [x] Firestore persistence: migrado de `enablePersistence` a `settings({localCache})` — commit c7db2da
- [x] RTDB write rules: `_meta/tombstones` tightened — commit c7db2da + publicado en Firebase Console
- [ ] Verificar NV 195 — si aún muestra $0, buscar en RTDB o investigar causa distinta

## PRÓXIMA SESIÓN (2026-11-10, después de las 3pm) — PRIORITARIO
### Problema raíz: escrituras RTDB grandes pueden perderse si el navegador se cierra
- **Causa**: `_rtdbWriteCollection` escribe TODA la colección (pesado/lento). Si se interrumpe,
  RTDB queda desactualizado vs Firestore. Al cargar, app lee RTDB (≥10 cols) y salta Firestore → dato perdido.
- **Fix 1 (write path)**: Cambiar `_cajaMovAdd` y otros para hacer write targetizado al doc específico
  en RTDB (`database.ref('/db/cajas/' + caja.id).set(caja)`) en lugar de `_rtdbWriteCollection`.
  Aplica también a `confirmarCierre` y `saveDb` donde sea posible.
- **Fix 2 (load path)**: Cambiar `loadFromFirebase` para que, al detectar RTDB ≥10 colecciones, aún
  compare conteos de documentos en colecciones críticas (cajas, ventas) vs Firestore. Si hay
  discrepancia → recargar esa colección desde Firestore.
- **Dato de referencia**: El movimiento $520 ("Concha no. 11 bolita", 2026-11-07 12:22) fue
  restaurado manualmente en RTDB vía browser el 2026-11-09. Caja 1276614, Secretaria.

## Reglas de operación — NO HACER SIN AUTORIZACIÓN EXPLÍCITA
- NO correr migraciones de datos sin confirmación
- NO eliminar colecciones/documentos de Firestore
- NO desactivar RTDB_DUAL_WRITE
- NO modificar/borrar backups
- NO mover código sin decir primero qué cambia y esperar confirmación
- Identificar causa exacta antes de proponer cualquier fix

## Credenciales firebase-tools (en equipo Windows)
- Archivo: `C:\Users\israe\.config\configstore\firebase-tools.json`
- Contiene: `tokens.access_token` (válido ~1 hora), `tokens.refresh_token`
- Si el token expiró: correr `firebase projects:list` para refrescarlo
- El `client_secret` hardcodeado de firebase-tools ya NO funciona (fue revocado). Usar `access_token` directo del archivo.
- Para scripts Node.js que necesiten Firestore REST API: leer `access_token` del archivo arriba

## Notas técnicas
- `pendienteCotizar: true` → muestra botón "Fijar total" en la venta
- `pendienteCotizar: false/undefined` + `total=0` → muestra $0 sin botón (bug)
- Lógica en index.html ~línea 7713
- Para listar ventas afectadas: GET `/v1/projects/campers-la-cuesta-84ade/databases/(default)/documents/ventas?pageSize=300`
