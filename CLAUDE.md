# GestPro — CamperERP (Campers La Cuesta)
# Última actualización: 2026-11-10

## Proyecto
- **App**: Single-file HTML monolith (`public/index.html`, ~25 267 líneas, ~1.5 MB)
- **Firebase project**: `campers-la-cuesta-84ade`
- **Hosting**: `sistemas.camperslacuesta.com`
- **Git remote**: `https://github.com/iniguezisrael-netizen/gestpro.git`
- **Credenciales GitHub**: guardadas en credential.helper store del equipo (Windows)
- **SW actual**: `campers-v321` (`public/sw.js` línea 9)
- **SDK Firebase**: `10.7.0` compat
- **Líneas index.html**: 25 267 (actualizado 2026-11-10) — si difiere >50 líneas, revalidar mapa

---

## Deploy (PowerShell — mandar SIEMPRE al terminar cambios en index.html, sin que lo pidan)
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
cd C:\Users\israe\Downloads\firebase-deploy
firebase deploy --only hosting
```

## Git — después de cada sesión de cambios (automático, sin que lo pidan)
```
git add public/index.html   # (agregar sw.js si se modificó)
git commit -m "descripción"
git push
```
Incluir siempre en el commit:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WtkKKPFfefRpMgCMQxXHAi
```

---

## Reglas de operación — NO HACER SIN AUTORIZACIÓN EXPLÍCITA
- NO correr migraciones de datos
- NO eliminar colecciones/documentos de Firestore
- NO desactivar `RTDB_DUAL_WRITE`
- NO modificar/borrar backups
- **Antes de cualquier cambio en código: decir qué cambia y esperar confirmación**
- Identificar causa exacta antes de proponer cualquier fix
- Responder en español, breve y directo

---

## Constantes clave (public/index.html)
| Constante | Línea | Valor |
|---|---|---|
| `RTDB_DUAL_WRITE` | 1647 | `true` — doble escritura RTDB+Firestore, NO desactivar |
| `FS_COLLECTIONS` | 1071 | 29 colecciones (ver línea) |
| `FS_STATIC_COLS` | 1087 | catalogoMateriales, checadorConfig, catConsig, vehiculos, facturas, recordatoriosPersonales |
| `FS_ARRAY_COLS` | 1084 | clientesCredito |
| `_EMPRESA` | 1054 | Datos empresa (RFC, banco, etc.) — pendiente mover a config segura |
| `_RENDER_DEBOUNCE` | 902 | 600ms (1500ms en tablet) |
| `session` | 1773 | Estado de auth actual |

---

## Mapa de líneas — funciones críticas (verificado 2026-11-10)

### Sync / Data
| Función | Línea | Descripción |
|---|---|---|
| `loadFromFirebase()` | 2096 | Carga inicial: RTDB fast-load (gate: ≥10 cols → salta Firestore) |
| `_procesarColecciones()` | 1989 | Procesa resultado RTDB/FS y puebla `db[]` |
| `startRealtimeSync()` | 2592 | Inicia listeners RTDB por rol; llamada en login (2803,2808,2815,2838,2876) y resume (25247) |
| `_startSingleCollectionListener()` | 2336 | Por colección: static cols (skip si db[col] lleno) → RTDB listener → FS fallback |
| `_startRTDBListenerForCol()` | 2245 | Listener RTDB individual |
| `_ensureLazyCollections()` | 2635 | Carga colecciones extra al navegar a una página |
| `_verificarCajasAbiertas()` | 1675 | Background: compara cajas abiertas RTDB vs Firestore (Fix 2) |
| `saveDb()` | 1829 | Guarda colección en Firestore + localStorage + RTDB (dual-write) |
| `fsWriteCollection()` | 1115 | Escribe colección completa a Firestore |
| `_rtdbWriteCollection()` | 1649 | Escribe colección completa a RTDB |
| `_rtdbDeleteFromCollection()` | 1702 | Elimina doc de RTDB |
| `sid()` | 1778 | Genera ID único global |

### Auth / Login
| Función | Línea | Descripción |
|---|---|---|
| `doLogin()` | 2726 | Flujo completo de login |
| `verificarPasswordAdmin()` | 1022 | Verificación de contraseña admin |
| `logout()` | 3157 | Cierra sesión |
| `can(roles)` | 3183 | Control de acceso por rol: `can(['admin','secretaria'])` |
| `initApp()` | 3210 | Inicialización post-login |
| `buildNav()` | 3307 | Construye menú por rol |
| `navigate(page)` | 3323 | Navega entre páginas |
| `renderPage(page)` | 3345 | Dispatcher principal de módulos |

### Módulos de UI (render)
| Función | Línea | Módulo |
|---|---|---|
| `renderInventario(tipo)` | 4048 | Productos / Materia prima |
| `renderVentas()` | 5506 | Ventas |
| `renderCotizaciones()` | 9936 | Cotizaciones |
| `renderClientes()` | 10277 | Clientes |
| `renderCaja()` | 12730 | Caja |
| `renderFacturas()` | 13778 | Facturas |
| `renderReparaciones()` | 14793 | Reparaciones |
| `renderCobranza()` | 14957 | Cobranza |
| `renderProduccion()` | 16045 | Producción |
| `renderAgenda()` | 20623 | Agenda |
| `renderChecador()` | 22482 | Checador |

### Utilerías
| Función | Línea | Descripción |
|---|---|---|
| `showModal()` | 17863 | Modal genérico |
| `closeModal()` | 17940 | Cierra modal |
| `showToast()` | 17506 | Notificación temporal |
| `_info()` | 17990 | Alerta informativa |
| `escapeHtml()` | 3197 | Escape XSS |
| `_normSearch()` | 17722 | Búsqueda sin acentos |
| `logActividad()` | 24440 | Bitácora a Firestore |
| `_cajaMovAdd()` | 12544 | Agrega movimiento a caja (Fix 1: dual-write RTDB línea 12570) |
| `confirmarCierre()` | 13333 | Cierra caja |

---

## Prioridad de carga por rol (`_FS_PRIORITY` línea 1981)
- **admin**: ventas (inmediato) + resto lazy por `_PAGE_EXTRA_COLS`
- **secretaria**: ventas, cotizaciones, clientes, cajas, cobranza
- **auxiliar**: ventas, cotizaciones, materia, productos, cajas, clientes
- **almacen**: materia, catalogoMateriales, herramientas, herramientasAsignadas, herramientasHistorial, entregaInsumos, bodegas, productos
- **checador**: checadas, checadorConfig

Colecciones extra por página: `_PAGE_EXTRA_COLS` línea 2612

---

## Arquitectura de datos
- **Cada entidad = documento individual**: `ventas/195`, `cajas/1276614`, etc.
- **NO existe** patrón `{col}/data` — cada documento es una entidad
- `FS_ARRAY_COLS` (`clientesCredito`) es la excepción: items son strings, no objetos con `.id`
- **RTDB fast-load**: si RTDB tiene ≥10 colecciones → salta Firestore completamente (línea 2120)
- **Firestore cache**: se puebla solo con `onSnapshot`. Los listeners RTDB NO la pueblan → cache siempre fría desde Fix RTDB (Nov 7)

---

## Estructura de colecciones Firestore
29 colecciones + `_config`, `_logs`, `_meta`, `roles` (sistema)
Colecciones estáticas (FS_STATIC_COLS): no cambian frecuentemente, skip Firestore si `db[col]` ya tiene datos.

---

## Credenciales firebase-tools (en equipo Windows)
- Archivo: `C:\Users\israe\.config\configstore\firebase-tools.json`
- Contiene: `tokens.access_token` (válido ~1 hora), `tokens.refresh_token`
- Si expiró: correr `firebase projects:list` para refrescarlo

---

## Notas técnicas de UI
- `pendienteCotizar: true` → muestra botón "Fijar total" en venta
- `pendienteCotizar: false/undefined` + `total=0` → muestra $0 sin botón (bug conocido, aplicar PATCH)
- Lógica en línea ~7713
