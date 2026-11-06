# GestPro — Reglas críticas para Claude

## Contexto general
- App en producción: Firebase Hosting `campers-la-cuesta-84ade`
- Archivo principal: `public/index.html` (SPA monolítica)
- SW: `public/sw.js` — siempre bumppear versión al hacer cambios en index.html
- Deploy: PowerShell → `firebase deploy --only hosting`
- Git: usar `write-tree` + `commit-tree` + `update-ref` (el `git commit` normal cuelga en la VM)

## Reglas de trabajo
1. **Antes de tocar código: avisar qué se va a cambiar y esperar confirmación**
2. No corromper la app — está en producción y funcionando
3. Después de cada cambio: git add + commit + push automático (sin que lo pida)
4. Siempre mandar el script de deploy después de cada cambio (sin que lo pida)

## Fixes críticos — NO reintroducir

### #er-scan (Entrega de Insumos — tableta MUNBYN ILT01P)
- **NUNCA** poner `inputmode="none"` en el campo `#er-scan`
- **NUNCA** quitar el `onclick` del div contenedor
- El escáner Honeywell N6703 usa IME commitText — `inputmode="none"` bloquea la conexión IME
- Fix original: commit `e6f4413`; regresionado en `91783da`; re-aplicado en `5d37d51`
- Estado correcto:
  ```html
  <div style="margin-bottom:8px;cursor:pointer" onclick="document.getElementById('er-scan').focus()">
    <input type="text" id="er-scan" placeholder="Escanear aquí…" autocomplete="off" autofocus
  ```

## Arquitectura Firestore (resumen)
- `FS_STATIC_COLS`: one-time `get()` con cache — no usan `onSnapshot`
- `FS_ARRAY_COLS`: `onSnapshot` de un solo doc
- Resto: `onSnapshot` por colección
- `enablePersistence({ synchronizeTabs: true })` activo — IndexedDB cache
- Idle 30 min → `_pauseSync()` → limpia listeners
- Page hidden 5 min → pausa listeners

## Workaround git en VM
```bash
git add <archivos>
TREE=$(git write-tree)
COMMIT=$(echo "mensaje" | git commit-tree $TREE -p HEAD)
git update-ref refs/heads/main $COMMIT
git push origin main
```
Los archivos `.lock` que deja git son normales — restricción de permisos del VM.

## Recordatorios personales — NUNCA hardcodear "Vencido"
En `_mostrarPopupRecordatorios`, el bloque `_popupPersV.map(p => {` debe
distinguir fecha pasada vs hoy. NUNCA poner `const dotCls = 'vencido'` fijo:
```js
// CORRECTO:
const _phoy = typeof today==='function' ? today() : new Date().toISOString().slice(0,10);
const _pvenc = p.fecha < _phoy;
const dotCls = _pvenc ? 'vencido' : 'hoy';
// label: _pvenc ? 'Vencido' : 'Hoy'
```
Recordatorios del día actual deben mostrar "Hoy" (amarillo), solo los de fecha
anterior muestran "Vencido" (rojo).
