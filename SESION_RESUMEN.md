# GestPro — Campers La Cuesta · Resumen de sesión
**Última actualización:** 2026-07-17  
**App:** `https://sistemas.camperslacuesta.com`  
**Proyecto Firebase:** `campers-la-cuesta-84ade`  
**Archivos principales:** `public/index.html` (~14 500 líneas), `public/sw.js`, `functions/index.js`  
**SW actual:** `campers-v41`

---

## Estado actual del sistema

### Infraestructura
- Firebase Hosting + Firestore + Storage + Functions (Node 20, firebase-functions v2)
- Cloud Functions deployadas: `cambiarPasswordUsuario`, `actualizarEmailUsuario`, `crearUsuario`, `enviarCorreoMasivo`, `proxyStorageImg`, `dailyBackup`
- Deploy command (incluye functions):
  ```powershell
  Set-Location "C:\Users\israe\Downloads\firebase-deploy"
  echo y | firebase deploy --only hosting,firestore:rules,functions --project campers-la-cuesta-84ade --force
  ```

### Funciones JS globales clave
| Función | Propósito |
|---|---|
| `sid()` | Counter global compartido entre todas las colecciones |
| `_pg(key, arr)` / `_pgHTML(key, total, fn)` | Paginación |
| `_normSearch(str)` | Búsqueda sin acentos |
| `can(['rol'])` | Control de acceso por rol |
| `showModal()`, `closeModal()`, `showToast()` | UI primitives |
| `subirFotoAStorage(dataUrl, carpeta, cb)` | Sube imagen a Storage (base64 si offline) |
| `_cargarFuenteYBuildPDF` / `_precargarFotos` / `_buildPDF` | Pipeline PDF con jsPDF |
| `toggleDarkMode()` | Dark mode con persistencia en localStorage |
| `_copiar(text, label)` | Copiar al portapapeles |
| `_waMensaje(tel, nombre)` | Abrir WhatsApp web |
| `_buscarGlobal(q)` | Búsqueda global (cotizaciones, ventas, clientes) |
| `logActividad(accion, detalle)` | Bitácora a Firestore |
| `exportCotizXLSX()` | Export Excel de cotizaciones (solo admin) |

---

## Cambios implementados en esta sesión

### 1. Mejoras estéticas y funcionales (bloque "todas")
- **Dark mode** con botón `🌙/☀️` en topbar, persistido en localStorage
- **Búsqueda global** en topbar con resultado debounced
- **Botones copy 📋 y WhatsApp 💬** en celdas de teléfono/email de Clientes
- **Skeleton shimmer** (`.sk`, `.sk-row`) para estados de carga
- **Atajos de teclado:** Esc cierra modal, Ctrl+S guarda
- **Session timeout** 20 min de inactividad → diálogo de expiración
- **Bitácora de actividad** (`db.bitacora` + Firestore)

### 2. RFC en Cotizaciones y Ventas
- Campo RFC agregado en formulario de cotización (junto a Tel/Celular en grid 3 columnas)
- RFC guardado como `ctRfc` en cotizaciones, `rfc` en ventas
- Columna RFC visible en tabla de cotizaciones y ventas
- RFC mostrado en detalle `verCotiz()`

### 3. Fix orden folios cotizaciones
- Ordenamiento por `b.id - a.id` (descendente) en lugar de `.slice().reverse()`
- Paginator usa `window._czTotalFilt` para contar correctamente con filtros de fecha

### 4. Fix fotos en PDF de cotizaciones
- Cascada 3 métodos: `fetch()` → canvas con `crossOrigin` → Cloud Function proxy
- `proxyStorageImg` en `functions/index.js`: descarga imagen server-side y devuelve base64
- Imágenes ya en base64 se cortocircuitan directo

### 5. Detalle de Precios colapsable en modal cotización
- Sección "Detalle de Precios" envuelta en `<details open>` igual que otras secciones
- Summary: `💰 Detalle de Precios (clic para abrir)`

### 6. IVA sin desglose
- Radio buttons Neto/+IVA se mantienen pero **no calculan** IVA encima del precio
- El precio ingresado ES el precio final (sin agregar 16%)
- Total = suma directa de (cantidad × precio) de cada ítem
- En `verCotiz()`, junto al total aparece `Neto (sin IVA)` o `+IVA (16%)` como etiqueta

### 7. Excel solo para admin
- Botón Excel movido dentro del bloque `esAdmin`
- Si la librería XLSX no cargó, se descarga on-demand y reintenta automáticamente

---

## Estructura del modal de cotización (secciones colapsables)
1. `<details>` **DATOS DEL CLIENTE** (clic para abrir)
2. `<details>` **ESPECIFICACIONES DEL PRODUCTO** (clic para abrir)
3. `<details open>` **💰 DETALLE DE PRECIOS** (clic para abrir)
4. **Estado** (grid 2 col) + **Notas/Condiciones**
5. `<details>` **🔔 Recordatorio de Seguimiento** (clic para abrir)

---

## Pendientes conocidos
- [ ] **Sección Entrega Insumos** (tarea #14, no iniciada)
- [ ] Verificar que fotos en PDF funcionen tras deploy de functions con `proxyStorageImg`
- [ ] Configurar CORS en Firebase Storage con `gsutil` si el proxy falla (ver `cors.json` y `set-cors.ps1`)

---

## Archivos auxiliares creados
| Archivo | Propósito |
|---|---|
| `cors.json` | Configuración CORS para Firebase Storage |
| `set-cors.ps1` | Script para aplicar CORS con gsutil |
| `deploy.ps1` | Deploy solo hosting+rules (NO incluye functions) |

> **Nota:** Para futuros deploys siempre usar el comando completo con `functions` para incluir `proxyStorageImg`.
