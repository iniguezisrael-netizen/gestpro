import re

with open('/sessions/rcw-01wtkkkpffefrpmgcmqxxhai/mnt/firebase-deploy/public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1. Modificar la query del listener en _startSingleCollectionListener ──────
old_listener = '    // ── Resto: escuchar colección entera, actualizaciones incrementales ──────\n    unsub = firestore.collection(colName).onSnapshot(snapshot => {'
new_listener = '''    // ── Resto: escuchar colección entera, actualizaciones incrementales ──────
    let _fsQuery = firestore.collection(colName);
    if (colName === 'facturas') {
      const _anioFact = window._facturaAnioActual || new Date().getFullYear().toString();
      const _mesFact = window._facturasMesActual || '';
      if (_anioFact) {
        let _fechaDesde, _fechaHasta;
        if (_mesFact) {
          _fechaDesde = _anioFact + '-' + _mesFact + '-01';
          const _d = new Date(parseInt(_anioFact), parseInt(_mesFact), 1);
          _fechaHasta = _d.getFullYear() + '-' + String(_d.getMonth()+1).padStart(2,'0') + '-01';
        } else {
          _fechaDesde = _anioFact + '-01-01';
          _fechaHasta = String(parseInt(_anioFact)+1) + '-01-01';
        }
        _fsQuery = _fsQuery.where('fecha', '>=', _fechaDesde).where('fecha', '<', _fechaHasta);
      }
    }
    unsub = _fsQuery.onSnapshot(snapshot => {'''

if old_listener in html:
    html = html.replace(old_listener, new_listener, 1)
    print('✅ Patch 1: query filtrada por año/mes aplicada')
else:
    print('❌ Patch 1: no encontrado')

# ── 2. Guardar unsub de facturas y agregar función _recargarFacturasAnio ──────
old_push = '  _syncUnsubscribers.push(unsub);\n}'
new_push = '''  if (colName === 'facturas') window._facturaYearUnsub = unsub;
  _syncUnsubscribers.push(unsub);
}

function _recargarFacturasFiltro(anio, mes) {
  if (window._facturaYearUnsub) {
    try { window._facturaYearUnsub(); } catch(e) {}
    const _idx = _syncUnsubscribers.indexOf(window._facturaYearUnsub);
    if (_idx >= 0) _syncUnsubscribers.splice(_idx, 1);
    window._facturaYearUnsub = null;
  }
  _listenersStarted.delete('facturas');
  _syncInitialized['facturas'] = false;
  db.facturas = [];
  window._facturaAnioActual = anio;
  window._facturasMesActual = mes || '';
  _startSingleCollectionListener('facturas');
}'''

if old_push in html:
    html = html.replace(old_push, new_push, 1)
    print('✅ Patch 2: _recargarFacturasFiltro agregada')
else:
    print('❌ Patch 2: no encontrado')

# ── 3. En filtrarFacturas(), detectar cambio de año/mes y recargar ──
old_filtrar = '''function filtrarFacturas(resetPage) {
  const filtro = {
    nombre: document.getElementById('f-nombre')?.value || '',
    folio:  document.getElementById('f-folio')?.value || '',
    mes:    document.getElementById('f-mes')?.value || '',
    anio:   document.getElementById('f-anio')?.value || '','''
new_filtrar = '''function filtrarFacturas(resetPage) {
  const _anioSel = document.getElementById('f-anio')?.value || '';
  const _mesSel  = document.getElementById('f-mes')?.value  || '';
  const _anioActual = window._facturaAnioActual !== undefined ? window._facturaAnioActual : new Date().getFullYear().toString();
  const _mesActual  = window._facturasMesActual !== undefined ? window._facturasMesActual : String(new Date().getMonth()+1).padStart(2,'0');
  if (_anioSel !== _anioActual || _mesSel !== _mesActual) {
    _recargarFacturasFiltro(_anioSel, _mesSel);
    return;
  }
  const filtro = {
    nombre: document.getElementById('f-nombre')?.value || '',
    folio:  document.getElementById('f-folio')?.value || '',
    mes:    _mesSel,
    anio:   _anioSel,'''

if old_filtrar in html:
    html = html.replace(old_filtrar, new_filtrar, 1)
    print('✅ Patch 3: filtrarFacturas con detección de cambio de año/mes')
else:
    print('❌ Patch 3: no encontrado')

# ── 4. En renderFacturas(), generar años fijos + inicializar filtros actuales ──
old_anios = "  const anios = [...new Set((db.facturas||[]).filter(f=>f.fecha).map(f=>f.fecha.substring(0,4)))].sort((a,b)=>b-a);"
new_anios = """  if (window._facturaAnioActual === undefined) { window._facturaAnioActual = new Date().getFullYear().toString(); }
  if (window._facturasMesActual === undefined) { window._facturasMesActual = String(new Date().getMonth()+1).padStart(2,'0'); }
  const _anioInicio = 2014;
  const _anioFin = new Date().getFullYear();
  const anios = [];
  for (let _y = _anioFin; _y >= _anioInicio; _y--) anios.push(String(_y));"""

if old_anios in html:
    html = html.replace(old_anios, new_anios, 1)
    print('✅ Patch 4: años fijos en renderFacturas')
else:
    print('❌ Patch 4: no encontrado')

# ── 5. Preseleccionar el año y mes actual en los selects ──────────────────────
old_anio_select = '''        <select id="f-anio" onchange="filtrarFacturas()" style="width:100%;padding:7px;border:1.5px solid var(--border);border-radius:8px;outline:none">
          <option value="">📅 Todos los años</option>
          ${anios.map(a=>`<option value="${a}">${a}</option>`).join('')}
        </select>'''
new_anio_select = '''        <select id="f-anio" onchange="filtrarFacturas()" style="width:100%;padding:7px;border:1.5px solid var(--border);border-radius:8px;outline:none">
          <option value="">📅 Todos los años</option>
          ${anios.map(a=>`<option value="${a}" ${a===window._facturaAnioActual?'selected':''}>${a}</option>`).join('')}
        </select>'''

if old_anio_select in html:
    html = html.replace(old_anio_select, new_anio_select, 1)
    print('✅ Patch 5: año preseleccionado en select')
else:
    print('❌ Patch 5: no encontrado')

old_mes_select = '''        <select id="f-mes" onchange="filtrarFacturas()" style="width:100%;padding:7px;border:1.5px solid var(--border);border-radius:8px;outline:none">
          <option value="">📅 Todos los meses</option>
          ${meses.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('')}
        </select>'''
new_mes_select = '''        <select id="f-mes" onchange="filtrarFacturas()" style="width:100%;padding:7px;border:1.5px solid var(--border);border-radius:8px;outline:none">
          <option value="">📅 Todos los meses</option>
          ${meses.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${String(i+1).padStart(2,'0')===window._facturasMesActual?'selected':''}>${m}</option>`).join('')}
        </select>'''

if old_mes_select in html:
    html = html.replace(old_mes_select, new_mes_select, 1)
    print('✅ Patch 6: mes preseleccionado en select')
else:
    print('❌ Patch 6: no encontrado')

with open('/sessions/rcw-01wtkkkpffefrpmgcmqxxhai/mnt/firebase-deploy/public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Done.')
