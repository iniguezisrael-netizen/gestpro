import re

import os
F = os.path.expanduser('~/mnt/firebase-deploy/public/index.html')
with open(F, 'r', encoding='utf-8') as fh:
    src = fh.read()

errors = []

# ─────────────────────────────────────────────────────────────────────────────
# CAMBIO 1: Agregar 'recordatoriosPersonales' a FS_COLLECTIONS
# ─────────────────────────────────────────────────────────────────────────────
OLD1 = "'catConsig'];"
NEW1 = "'catConsig','recordatoriosPersonales'];"
if OLD1 in src:
    src = src.replace(OLD1, NEW1, 1)
    print("✓ C1: recordatoriosPersonales añadido a FS_COLLECTIONS")
else:
    errors.append("C1: no encontré catConsig en FS_COLLECTIONS")

# ─────────────────────────────────────────────────────────────────────────────
# CAMBIO 2: buildNav — añadir _updateAgendaBadge y badge en nav Agenda
# ─────────────────────────────────────────────────────────────────────────────
OLD2 = (
    "function buildNav() {\n"
    "  const nav = document.getElementById('sidebar-nav');\n"
    "  nav.innerHTML = '';\n"
    "  (MENUS[session.rol] || []).forEach(item => {\n"
    "    if (item.section) {\n"
    "      nav.innerHTML += `<div class=\"nav-section\">${item.section}</div>`;\n"
    "    } else {\n"
    "      nav.innerHTML += `<div class=\"nav-item\" id=\"nav-${item.id}\" onclick=\"navigate('${item.id}')\">\n"
    "        <span class=\"nav-icon\">${item.icon}</span>${item.label}</div>`;\n"
    "    }\n"
    "  });\n"
    "}"
)
NEW2 = (
    "function _updateAgendaBadge() {\n"
    "  const badge = document.getElementById('agenda-nav-badge');\n"
    "  if (!badge || !session) return;\n"
    "  const hoy = new Date().toISOString().slice(0,10);\n"
    "  const _nowHHMM = new Date().toTimeString().slice(0,5);\n"
    "  const recCount = can(['admin','secretaria','auxiliar']) && session.rol !== 'almacenista'\n"
    "    ? (db.cotizaciones||[]).filter(c => c.recFecha && !c.recHecho && !(c.recSnoozeHasta && c.recSnoozeHasta > Date.now()) && (c.recFecha < hoy || (c.recFecha === hoy && (!c.recHora || c.recHora <= _nowHHMM))) && (session.rol === 'admin' ? true : c.usuario === session.nombre)).length\n"
    "    : 0;\n"
    "  const persCount = (db.recordatoriosPersonales||[]).filter(p => !p.completado && p.fecha && p.fecha <= hoy && !(p.snoozeHasta && p.snoozeHasta > Date.now()) && p.usuarioId === session.uid).length;\n"
    "  const total = recCount + persCount;\n"
    "  badge.textContent = total;\n"
    "  badge.style.display = total > 0 ? 'inline-block' : 'none';\n"
    "}\n"
    "function buildNav() {\n"
    "  const nav = document.getElementById('sidebar-nav');\n"
    "  nav.innerHTML = '';\n"
    "  (MENUS[session.rol] || []).forEach(item => {\n"
    "    if (item.section) {\n"
    "      nav.innerHTML += `<div class=\"nav-section\">${item.section}</div>`;\n"
    "    } else {\n"
    "      const _agBadge = item.id === 'agenda' ? `<span id=\"agenda-nav-badge\" style=\"display:none;background:#dc2626;color:white;border-radius:10px;padding:0 7px;font-size:0.7rem;margin-left:auto;font-weight:700;line-height:1.6\">0</span>` : '';\n"
    "      nav.innerHTML += `<div class=\"nav-item\" id=\"nav-${item.id}\" onclick=\"navigate('${item.id}')\"${item.id==='agenda'?' style=\"display:flex;align-items:center\"':''}>\n"
    "        <span class=\"nav-icon\">${item.icon}</span>${item.label}${_agBadge}</div>`;\n"
    "    }\n"
    "  });\n"
    "  _updateAgendaBadge();\n"
    "}"
)
if OLD2 in src:
    src = src.replace(OLD2, NEW2, 1)
    print("✓ C2: buildNav + _updateAgendaBadge añadidos")
else:
    errors.append("C2: no encontré el bloque exacto de buildNav")

# ─────────────────────────────────────────────────────────────────────────────
# CAMBIO 3: Reemplazar bloque seguimiento en renderDashboard con chip
# ─────────────────────────────────────────────────────────────────────────────
OLD3_START = (
    "    ${can(['admin','secretaria','auxiliar']) && session.rol !== 'almacenista' ? (()=>{\n"
    "      const esAdmin = session.rol === 'admin';\n"
    "      if (!window._recAdminFilter) window._recAdminFilter = '';\n"
    "      const _nowHHMM = new Date().toTimeString().slice(0,5);\n"
    "      const allActivos = (db.cotizaciones||[]).filter(c => c.recFecha && !c.recHecho && !(c.recSnoozeHasta && c.recSnoozeHasta > Date.now()) && (c.recFecha < today() || (c.recFecha === today() && (!c.recHora || c.recHora <= _nowHHMM))));\n"
    "      const recs = allActivos.filter(c =>\n"
    "        esAdmin\n"
    "          ? (window._recAdminFilter ? c.usuario === window._recAdminFilter : true)\n"
    "          : c.usuario === session.nombre\n"
    "      ).sort((a,b)=>a.recFecha.localeCompare(b.recFecha));\n"
    "      if (!recs.length && !esAdmin) return '';"
)
OLD3_END = (
    "      </div>`;\n"
    "    })() : ''}\n"
    "    ${can(['admin']) ? (()=>{"
)

if OLD3_START in src and OLD3_END in src:
    idx_start = src.index(OLD3_START)
    idx_end = src.index(OLD3_END, idx_start)
    old_block = src[idx_start:idx_end + len(OLD3_END)]
    NEW3 = (
        "    ${can(['admin','secretaria','auxiliar']) && session.rol !== 'almacenista' ? (()=>{\n"
        "      const esAdmin = session.rol === 'admin';\n"
        "      const _nowHHMM = new Date().toTimeString().slice(0,5);\n"
        "      const recCount = (db.cotizaciones||[]).filter(c => c.recFecha && !c.recHecho && !(c.recSnoozeHasta && c.recSnoozeHasta > Date.now()) && (c.recFecha < today() || (c.recFecha === today() && (!c.recHora || c.recHora <= _nowHHMM))) && (esAdmin ? true : c.usuario === session.nombre)).length;\n"
        "      const persCount = (db.recordatoriosPersonales||[]).filter(p => !p.completado && p.fecha && p.fecha <= today() && !(p.snoozeHasta && p.snoozeHasta > Date.now()) && p.usuarioId === session.uid).length;\n"
        "      const total = recCount + persCount;\n"
        "      if (!total) return '';\n"
        "      return `<div onclick=\"navigate('agenda')\" style=\"cursor:pointer;display:inline-flex;align-items:center;gap:8px;background:#fff1f2;border:1.5px solid #fca5a5;border-radius:20px;padding:6px 16px;margin-bottom:16px;font-size:0.85rem;font-weight:600;color:#dc2626;user-select:none\" onmouseover=\"this.style.background='#ffe4e6'\" onmouseout=\"this.style.background='#fff1f2'\">\n"
        "        \U0001F514 Tienes ${total} recordatorio${total!==1?'s':''} pendiente${total!==1?'s':''} — ver en Agenda →\n"
        "      </div>`;\n"
        "    })() : ''}\n"
        "    ${can(['admin']) ? (()=>{"
    )
    src = src.replace(old_block, NEW3, 1)
    print("✓ C3: Chip de recordatorios reemplazó el bloque en dashboard")
else:
    if OLD3_START not in src:
        errors.append("C3: no encontré OLD3_START")
    if OLD3_END not in src:
        errors.append("C3: no encontré OLD3_END")

# ─────────────────────────────────────────────────────────────────────────────
# CAMBIO 4: Reescribir renderAgenda() con 3 secciones
# ─────────────────────────────────────────────────────────────────────────────
OLD4_START = (
    "function renderAgenda() {\n"
    "  const el = document.getElementById('page-agenda');\n"
    "  const isAdmin = can(['admin']);\n"
    "  const canEdit = can(['admin','secretaria','auxiliar']);\n"
    "  const hoy = new Date().toISOString().slice(0,10);\n"
    "  const filtro = window._agendaFiltro || 'proximas';\n"
    "\n"
    "  const todas = (db.agenda||[]).filter(c => c.estado !== 'Cancelada').sort((a,b) => (a.fecha+a.hora).localeCompare(b.fecha+b.hora));"
)
OLD4_END = (
    "    </div>`;\n"
    "}\n"
    "\n"
    "function openAgendaModal"
)

if OLD4_START in src and OLD4_END in src:
    idx_start = src.index(OLD4_START)
    idx_end = src.index(OLD4_END, idx_start)
    old_ra = src[idx_start:idx_end + len(OLD4_END)]

    NEW4 = r"""function renderAgenda() {
  const el = document.getElementById('page-agenda');
  const isAdmin = can(['admin']);
  const canEdit = can(['admin','secretaria','auxiliar']);
  const esAdmin = session.rol === 'admin';
  const hoy = new Date().toISOString().slice(0,10);

  // ── Divisor de sección ─────────────────────────────────────────────────
  const _secDiv = (label) => `<div style="display:flex;align-items:center;gap:10px;margin:20px 0 12px"><div style="flex:1;height:1px;background:var(--border)"></div><span style="font-size:0.75rem;font-weight:700;color:var(--text-light);letter-spacing:0.8px;text-transform:uppercase;white-space:nowrap;padding:0 4px">${label}</span><div style="flex:1;height:1px;background:var(--border)"></div></div>`;

  // ── SECCIÓN 1: CITAS DE INSTALACIÓN ────────────────────────────────────
  const filtro = window._agendaFiltro || 'proximas';
  const todas = (db.agenda||[]).filter(c => c.estado !== 'Cancelada').sort((a,b) => (a.fecha+a.hora).localeCompare(b.fecha+b.hora));
  const items = filtro === 'proximas'
    ? todas.filter(c => c.fecha >= hoy)
    : filtro === 'hoy'
      ? todas.filter(c => c.fecha === hoy)
      : filtro === 'pasadas'
        ? todas.filter(c => c.fecha < hoy || c.estado === 'Completada').reverse()
        : todas.slice().reverse();

  const _citasHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">📅 Agenda de Citas</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${isAdmin && (filtro==='pasadas'||filtro==='todas') ? `<button class="btn btn-sm btn-secondary" style="border:1.5px solid #cbd5e1" onclick="_agToggleSelectAll(this)">☐ Seleccionar todas</button>` : ''}
          ${isAdmin ? `<button class="btn btn-sm btn-danger" style="background:#7f1d1d;border-color:#7f1d1d" onclick="eliminarCitasSeleccionadas()">🗑️ Eliminar seleccionadas</button>` : ''}
          ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="openAgendaModal()">+ Nueva Cita</button>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${['proximas','hoy','pasadas','todas'].map(f => `
          <button class="btn btn-sm" style="background:${filtro===f?'var(--primary)':'#e2e8f0'};color:${filtro===f?'white':'#475569'}"
            onclick="window._agendaFiltro='${f}';renderAgenda()">
            ${{proximas:'📆 Próximas',hoy:'📍 Hoy',pasadas:'✅ Pasadas',todas:'📋 Todas'}[f]}
          </button>`).join('')}
      </div>

      ${items.length ? `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${items.map(c => {
            const esHoy = c.fecha === hoy;
            const esPasada = c.fecha < hoy;
            const badgeColor = c.estado==='Completada'?'badge-green':c.estado==='Cancelada'?'badge-red':esHoy?'badge-blue':'badge-yellow';
            return `
            <div style="border:1.5px solid ${esHoy?'var(--primary)':esPasada&&c.estado!=='Completada'?'#fca5a5':'var(--border)'};border-radius:10px;padding:14px 16px;background:${esHoy?'#eff6ff':esPasada&&c.estado!=='Completada'?'#fff7f7':'white'};display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
              ${isAdmin && (c.estado==='Completada' || esPasada) ? `<input type="checkbox" class="ag-chk" data-id="${c.id}" style="margin-top:4px;width:16px;height:16px;flex-shrink:0;cursor:pointer" />` : ''}
              <div style="flex:1;min-width:200px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                  <strong style="font-size:0.95rem">${esc(c.cliente)}</strong>
                  ${c.pedido?`<span style="font-size:0.78rem;font-weight:600;color:#2563eb;background:#eff6ff;padding:1px 7px;border-radius:6px;white-space:nowrap">${esc((c.pedido||'').replace(/^NOTA DE VENTA-(\d+)$/i,'NV $1'))}</span>`:''}
                  <span class="badge ${badgeColor}">${c.estado}</span>
                  ${esHoy?'<span class="badge badge-blue">Hoy</span>':''}
                </div>
                <div style="font-size:0.85rem;color:var(--text-light);display:flex;flex-wrap:wrap;gap:12px;margin-top:4px">
                  <span>📅 ${fechaLarga(c.fecha)} ${c.hora?'⏰ '+c.hora:''}</span>
                  <span>🔧 ${esc(c.tipo||'Instalación')}</span>
                  ${c.asignado?`<span>👤 Por: ${esc(c.asignado)}</span>`:''}
                  ${c.telefono?`<span>📞 ${esc(c.telefono)}</span>`:''}
                </div>
                ${c.notas?`<div style="margin-top:6px;font-size:0.83rem;color:#64748b;background:#f8fafc;padding:6px 10px;border-radius:6px">${esc(c.notas)}</div>`:''}
                <div style="margin-top:5px;font-size:0.75rem;color:#94a3b8">Programado por: ${esc(c.creadoPor||'—')}</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button class="btn btn-outline btn-sm" onclick="verCita(${c.id})">⋯</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : `<div style="text-align:center;padding:40px;color:#94a3b8">
          ${filtro==='hoy'?'No hay citas para hoy.':filtro==='proximas'?'No hay citas próximas pendientes.':'Sin registros.'}
        </div>`}
    </div>`;

  // ── SECCIÓN 2: RECORDATORIOS DE SEGUIMIENTO ─────────────────────────────
  const _seguimientoHTML = (can(['admin','secretaria','auxiliar']) && session.rol !== 'almacenista') ? (()=>{
    if (window._recAgAdminFilter === undefined) window._recAgAdminFilter = '';
    const _nowHHMM = new Date().toTimeString().slice(0,5);
    const allActivos = (db.cotizaciones||[]).filter(c => c.recFecha && !c.recHecho && !(c.recSnoozeHasta && c.recSnoozeHasta > Date.now()) && (c.recFecha < hoy || (c.recFecha === hoy && (!c.recHora || c.recHora <= _nowHHMM))));
    const recs = allActivos.filter(c =>
      esAdmin
        ? (window._recAgAdminFilter ? c.usuario === window._recAgAdminFilter : true)
        : c.usuario === session.nombre
    ).sort((a,b)=>a.recFecha.localeCompare(b.recFecha));
    const _recUsuarios = esAdmin ? [...new Set(allActivos.map(c=>c.usuario||'').filter(u=>u))].sort() : [];
    const _recsAbiertoInit = recs.length <= 5 ? 'flex' : 'none';
    const _recsArrowInit   = _recsAbiertoInit === 'flex' ? '▼' : '▶';
    const proximos = (db.cotizaciones||[]).filter(c => c.recFecha && !c.recHecho && !(c.recSnoozeHasta && c.recSnoozeHasta > Date.now()) && (c.recFecha > hoy || (c.recFecha === hoy && c.recHora && c.recHora > _nowHHMM))).filter(c => esAdmin ? (window._recAgAdminFilter ? c.usuario === window._recAgAdminFilter : true) : c.usuario === session.nombre).sort((a,b)=>a.recFecha!==b.recFecha?a.recFecha.localeCompare(b.recFecha):(a.recHora||'').localeCompare(b.recHora||''));
    const pospuestos = (db.cotizaciones||[]).filter(c => c.recFecha && !c.recHecho && c.recSnoozeHasta && c.recSnoozeHasta > Date.now()).filter(c => esAdmin ? (window._recAgAdminFilter ? c.usuario === window._recAgAdminFilter : true) : c.usuario === session.nombre).sort((a,b)=>(a.recSnoozeHasta||0)-(b.recSnoozeHasta||0));
    function _fmtSnooze(ts) {
      const mins = Math.round((ts - Date.now()) / 60000);
      if (mins < 1) return 'en menos de 1 min';
      if (mins < 60) return 'en ' + mins + ' min';
      const hrs = Math.floor(mins / 60), rem = mins % 60;
      if (hrs < 24) return 'en ' + hrs + 'h' + (rem ? ' ' + rem + 'min' : '');
      const d = new Date(ts);
      return 'el ' + d.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) + (d.getHours() ? ' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0') : '');
    }
    return `<div class="card" style="border-left:4px solid var(--danger)">
      <div class="card-header" onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'flex':'none';this.querySelector('.recag-arrow').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer;user-select:none">
        <span class="card-title">🔔 Recordatorios de Seguimiento <span style="font-size:0.8rem;color:#64748b">(${recs.length})</span></span>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${esAdmin ? `<select onclick="event.stopPropagation()" onchange="event.stopPropagation();window._recAgAdminFilter=this.value;renderAgenda()" style="font-size:0.72rem;padding:3px 7px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151">
            <option value="" ${!window._recAgAdminFilter?'selected':''}>Todos los usuarios</option>
            <option value="${session.nombre}" ${window._recAgAdminFilter===session.nombre?'selected':''}>Solo míos</option>
            ${_recUsuarios.filter(u=>u!==session.nombre).map(u=>`<option value="${u}" ${window._recAgAdminFilter===u?'selected':''}>${u}</option>`).join('')}
          </select>` : ''}
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();navigate('cotizaciones')">Ver todos</button>
          <button class="btn btn-sm" onclick="event.stopPropagation();_descartarTodosRecs()" style="background:#dc2626;color:white;border:none;padding:4px 9px;font-size:0.72rem;border-radius:6px;cursor:pointer">✕ Descartar todos</button>
          <span class="recag-arrow" style="font-size:0.85rem;color:#94a3b8">${_recsArrowInit}</span>
        </div>
      </div>
      <div style="display:${_recsAbiertoInit};flex-direction:column;gap:8px">
        ${recs.length ? recs.map(c=>`<div style="background:#fff1f2;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <span style="font-size:0.75rem;color:#94a3b8;margin-right:6px">#${c.id}</span>
            <strong>${esc(c.cliente)}</strong>
            ${c.ctEmpresa?`<span style="font-size:0.78rem;color:#64748b;margin-left:6px">${esc(c.ctEmpresa)}</span>`:''}
            <span style="font-size:0.78rem;color:#dc2626;margin-left:8px;font-weight:600">${c.recFecha===hoy?'📅 Hoy':'⚠️ '+fechaLarga(c.recFecha)}${c.recHora?' · '+fmtRecHora(c.recHora):''}</span>
            ${c.recNota?`<div style="font-size:0.78rem;color:#64748b;font-style:italic;margin-top:2px">${esc(c.recNota)}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <div style="display:flex;gap:4px">
              <button class="btn btn-outline btn-sm" onclick="verCotiz(${c.id})">Ver</button>
              <button onclick="marcarRecHecho(${c.id});renderAgenda()" style="background:#16a34a;color:white;border:none;border-radius:6px;padding:5px 10px;font-size:0.78rem;cursor:pointer">✓ Hecho</button>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <select id="_rec-snz-cot-${c.id}" style="font-size:0.72rem;padding:3px 5px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151">
                <option value="1">Mañana</option>
                <option value="2">+2 días</option>
                <option value="7">+1 semana</option>
                <option value="14">+2 semanas</option>
                <option value="fecha">📅 Fecha específica</option>
              </select>
              <button onclick="_posponerRec(${c.id},'cotizacion')" style="font-size:0.72rem;padding:3px 9px;background:#1d4ed8;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap">Posponer</button>
            </div>
          </div>
        </div>`).join('') : '<div style="color:#94a3b8;font-size:0.85rem;padding:4px 0">Sin recordatorios vencidos.</div>'}
      </div>
      ${proximos.length ? `<div style="margin-top:8px;border-top:1px solid #f1f5f9;padding-top:8px">
        <div onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';this.querySelector('.prox-ag-arrow').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:4px 0;color:#2563eb;font-size:0.8rem;font-weight:600;user-select:none">
          <span class="prox-ag-arrow">▶</span>
          🔜 Próximos recordatorios (${proximos.length})
        </div>
        <div style="display:none;flex-direction:column;gap:6px;margin-top:6px">
          ${proximos.map(c=>`<div style="background:#eff6ff;border-radius:8px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div>
              <span style="font-size:0.75rem;color:#94a3b8;margin-right:5px">#${c.id}</span>
              <strong>${esc(c.cliente)}</strong>
              ${c.ctEmpresa?`<span style="font-size:0.78rem;color:#64748b;margin-left:5px">${esc(c.ctEmpresa)}</span>`:''}
              <span style="font-size:0.78rem;color:#2563eb;margin-left:8px;font-weight:600">📅 ${fechaLarga(c.recFecha)}${c.recHora?' · '+fmtRecHora(c.recHora):''}</span>
              ${c.recNota?`<div style="font-size:0.78rem;color:#64748b;font-style:italic;margin-top:2px">${esc(c.recNota)}</div>`:''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-outline btn-sm" onclick="editarRecordatorio(${c.id})" title="Editar recordatorio">✏️</button>
              <button class="btn btn-outline btn-sm" onclick="verCotiz(${c.id})">Ver</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}
      ${pospuestos.length ? `<div style="margin-top:8px;border-top:1px solid #f1f5f9;padding-top:8px">
        <div onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';this.querySelector('.posps-ag-arrow').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:4px 0;color:#7c3aed;font-size:0.8rem;font-weight:600;user-select:none">
          <span class="posps-ag-arrow">▶</span>
          💤 Pospuestos (${pospuestos.length})
        </div>
        <div style="display:none;flex-direction:column;gap:6px;margin-top:6px">
          ${pospuestos.map(c=>`<div style="background:#f5f3ff;border-radius:8px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div>
              <span style="font-size:0.75rem;color:#94a3b8;margin-right:5px">#${c.id}</span>
              <strong>${esc(c.cliente)}</strong>
              ${c.ctEmpresa?`<span style="font-size:0.78rem;color:#64748b;margin-left:5px">${esc(c.ctEmpresa)}</span>`:''}
              <span style="font-size:0.78rem;color:#7c3aed;margin-left:8px;font-weight:600">💤 Se activa ${_fmtSnooze(c.recSnoozeHasta)}</span>
              ${c.recNota?`<div style="font-size:0.78rem;color:#64748b;font-style:italic;margin-top:2px">${esc(c.recNota)}</div>`:''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-outline btn-sm" onclick="editarRecordatorio(${c.id})" title="Editar recordatorio">✏️</button>
              <button class="btn btn-outline btn-sm" onclick="verCotiz(${c.id})">Ver</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;
  })() : `<div class="card" style="text-align:center;padding:30px;color:#94a3b8">No tienes acceso a recordatorios de seguimiento.</div>`;

  // ── SECCIÓN 3: RECORDATORIOS PERSONALES ────────────────────────────────
  const _personalesHTML = (()=>{
    if (window._persAdminFilter === undefined) window._persAdminFilter = '';
    const _nowHHMM = new Date().toTimeString().slice(0,5);
    const todasPers = (db.recordatoriosPersonales||[]);
    const misPers = esAdmin
      ? (window._persAdminFilter ? todasPers.filter(p => p.usuarioId === window._persAdminFilter) : todasPers)
      : todasPers.filter(p => p.usuarioId === session.uid);
    const _persUsuariosMap = {};
    todasPers.forEach(p => { if (p.usuarioId && !_persUsuariosMap[p.usuarioId]) _persUsuariosMap[p.usuarioId] = p.usuarioNombre||p.usuarioId; });
    const _persUsuarios = Object.entries(_persUsuariosMap).map(([id,n]) => ({id,n}));

    const activos = misPers.filter(p => !p.completado && !(p.snoozeHasta && p.snoozeHasta > Date.now()) && p.fecha && (p.fecha < hoy || (p.fecha === hoy && (!p.hora || p.hora <= _nowHHMM)))).sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||''));
    const proxPers = misPers.filter(p => !p.completado && !(p.snoozeHasta && p.snoozeHasta > Date.now()) && p.fecha && (p.fecha > hoy || (p.fecha === hoy && p.hora && p.hora > _nowHHMM))).sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||''));
    const snoozeados = misPers.filter(p => !p.completado && p.snoozeHasta && p.snoozeHasta > Date.now()).sort((a,b)=>(a.snoozeHasta||0)-(b.snoozeHasta||0));

    function _fmtSnzP(ts) {
      const mins = Math.round((ts - Date.now()) / 60000);
      if (mins < 1) return 'en menos de 1 min';
      if (mins < 60) return 'en ' + mins + ' min';
      const hrs = Math.floor(mins / 60), rem = mins % 60;
      if (hrs < 24) return 'en ' + hrs + 'h' + (rem ? ' ' + rem + 'min' : '');
      const d = new Date(ts);
      return 'el ' + d.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) + (d.getHours() ? ' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0') : '');
    }

    const _persAbiertoInit = activos.length <= 5 ? 'flex' : 'none';
    const _persArrowInit   = _persAbiertoInit === 'flex' ? '▼' : '▶';

    return `<div class="card" style="border-left:4px solid #7c3aed">
      <div class="card-header" onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'flex':'none';this.querySelector('.pers-arrow').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer;user-select:none">
        <span class="card-title">📝 Recordatorios Personales <span style="font-size:0.8rem;color:#64748b">(${activos.length})</span></span>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${esAdmin ? `<select onclick="event.stopPropagation()" onchange="event.stopPropagation();window._persAdminFilter=this.value;renderAgenda()" style="font-size:0.72rem;padding:3px 7px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151">
            <option value="" ${!window._persAdminFilter?'selected':''}>Todos los usuarios</option>
            <option value="${session.uid}" ${window._persAdminFilter===session.uid?'selected':''}>Solo míos</option>
            ${_persUsuarios.filter(u=>u.id!==session.uid).map(u=>`<option value="${u.id}" ${window._persAdminFilter===u.id?'selected':''}>${esc(u.n)}</option>`).join('')}
          </select>` : ''}
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openPersonalRecModal()">+ Nuevo</button>
          <span class="pers-arrow" style="font-size:0.85rem;color:#94a3b8">${_persArrowInit}</span>
        </div>
      </div>
      <div style="display:${_persAbiertoInit};flex-direction:column;gap:8px">
        ${activos.length ? activos.map(p=>`<div style="background:#faf5ff;border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="flex:1;min-width:0">
            <strong style="font-size:0.9rem">${esc(p.titulo)}</strong>
            <span style="font-size:0.78rem;color:#dc2626;margin-left:8px;font-weight:600">${p.fecha===hoy?'📅 Hoy':'⚠️ '+fechaLarga(p.fecha)}${p.hora?' · '+p.hora:''}</span>
            ${p.descripcion?`<div style="font-size:0.78rem;color:#64748b;font-style:italic;margin-top:2px">${esc(p.descripcion)}</div>`:''}
            ${esAdmin&&p.usuarioNombre?`<div style="font-size:0.72rem;color:#94a3b8;margin-top:2px">👤 ${esc(p.usuarioNombre)}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <div style="display:flex;gap:4px">
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openPersonalRecModal('${p.id}')">✏️</button>
              <button onclick="marcarPersonalHecho('${p.id}')" style="background:#16a34a;color:white;border:none;border-radius:6px;padding:5px 10px;font-size:0.78rem;cursor:pointer">✓ Hecho</button>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              <select id="_snz-pers-${p.id}" style="font-size:0.72rem;padding:3px 5px;border:1px solid #d1d5db;border-radius:6px;background:white;color:#374151">
                <option value="1">Mañana</option>
                <option value="2">+2 días</option>
                <option value="7">+1 semana</option>
                <option value="14">+2 semanas</option>
              </select>
              <button onclick="posponerPersonal('${p.id}')" style="font-size:0.72rem;padding:3px 9px;background:#1d4ed8;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap">Posponer</button>
            </div>
          </div>
        </div>`).join('') : '<div style="color:#94a3b8;font-size:0.85rem;padding:4px 0">Sin recordatorios vencidos.</div>'}
      </div>
      ${proxPers.length ? `<div style="margin-top:8px;border-top:1px solid #f1f5f9;padding-top:8px">
        <div onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';this.querySelector('.proxp-arrow').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:4px 0;color:#7c3aed;font-size:0.8rem;font-weight:600;user-select:none">
          <span class="proxp-arrow">▶</span>
          🔜 Próximos (${proxPers.length})
        </div>
        <div style="display:none;flex-direction:column;gap:6px;margin-top:6px">
          ${proxPers.map(p=>`<div style="background:#f5f3ff;border-radius:8px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div style="flex:1;min-width:0">
              <strong>${esc(p.titulo)}</strong>
              <span style="font-size:0.78rem;color:#7c3aed;margin-left:8px;font-weight:600">📅 ${fechaLarga(p.fecha)}${p.hora?' · '+p.hora:''}</span>
              ${p.descripcion?`<div style="font-size:0.78rem;color:#64748b;font-style:italic;margin-top:2px">${esc(p.descripcion)}</div>`:''}
              ${esAdmin&&p.usuarioNombre?`<div style="font-size:0.72rem;color:#94a3b8;margin-top:2px">👤 ${esc(p.usuarioNombre)}</div>`:''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-outline btn-sm" onclick="openPersonalRecModal('${p.id}')">✏️</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}
      ${snoozeados.length ? `<div style="margin-top:8px;border-top:1px solid #f1f5f9;padding-top:8px">
        <div onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';this.querySelector('.snzp-arrow').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:4px 0;color:#64748b;font-size:0.8rem;font-weight:600;user-select:none">
          <span class="snzp-arrow">▶</span>
          💤 Pospuestos (${snoozeados.length})
        </div>
        <div style="display:none;flex-direction:column;gap:6px;margin-top:6px">
          ${snoozeados.map(p=>`<div style="background:#f8fafc;border-radius:8px;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div style="flex:1;min-width:0">
              <strong>${esc(p.titulo)}</strong>
              <span style="font-size:0.78rem;color:#64748b;margin-left:8px;font-weight:600">💤 ${_fmtSnzP(p.snoozeHasta)}</span>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="btn btn-outline btn-sm" onclick="openPersonalRecModal('${p.id}')">✏️</button>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;
  })();

  el.innerHTML = `
    ${_secDiv('📅 Citas de instalación')}
    ${_citasHTML}
    ${_secDiv('🔔 Seguimiento')}
    ${_seguimientoHTML}
    ${_secDiv('📝 Personales')}
    ${_personalesHTML}
  `;
  _updateAgendaBadge();
}

function openAgendaModal"""

    src = src.replace(old_ra, NEW4, 1)
    print("✓ C4: renderAgenda() reescrita con 3 secciones")
else:
    if OLD4_START not in src:
        errors.append("C4: no encontré OLD4_START")
    if OLD4_END not in src:
        errors.append("C4: no encontré OLD4_END")

# ─────────────────────────────────────────────────────────────────────────────
# CAMBIO 5: Agregar funciones CRUD de recordatorios personales
# ─────────────────────────────────────────────────────────────────────────────
CRUD_MARKER = "function openAgendaModal(id, prefill) {"
CRUD_FUNCS = """// ════════════════════════════════════════════════════════════════════════
// RECORDATORIOS PERSONALES — CRUD
// ════════════════════════════════════════════════════════════════════════
function openPersonalRecModal(id) {
  const p = id ? (db.recordatoriosPersonales||[]).find(x => x.id === id) : null;
  const hoy = new Date().toISOString().slice(0,10);
  showModal(p ? 'Editar Recordatorio Personal' : 'Nuevo Recordatorio Personal', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="form-group">
        <label>Título *</label>
        <input id="pr-titulo" class="form-control" value="${esc(p?.titulo||'')}" placeholder="¿Qué necesitas hacer?" autocomplete="off" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group">
          <label>Fecha *</label>
          <input id="pr-fecha" type="date" class="form-control" value="${p?.fecha||hoy}" />
        </div>
        <div class="form-group">
          <label>Hora (opcional)</label>
          <input id="pr-hora" type="time" class="form-control" value="${p?.hora||''}" />
        </div>
      </div>
      <div class="form-group">
        <label>Descripción (opcional)</label>
        <textarea id="pr-desc" class="form-control" rows="2" placeholder="Detalles adicionales...">${esc(p?.descripcion||'')}</textarea>
      </div>
    </div>
  `, [
    {label:'Cancelar', class:'btn-outline', onclick:'closeModal()'},
    ...(p ? [{label:'🗑️ Eliminar', class:'btn-danger', onclick:`_eliminarPersonalRec('${p.id}')`}] : []),
    {label: p ? '💾 Guardar' : '+ Crear', class:'btn-primary', onclick:`savePersonalRec(${p?`'${p.id}'`:'null'})`}
  ]);
  setTimeout(() => document.getElementById('pr-titulo')?.focus(), 50);
}

async function savePersonalRec(id) {
  const titulo = (document.getElementById('pr-titulo')?.value||'').trim();
  const fecha = document.getElementById('pr-fecha')?.value||'';
  const hora = (document.getElementById('pr-hora')?.value||'').trim();
  const descripcion = (document.getElementById('pr-desc')?.value||'').trim();
  if (!titulo) { _info('El título es obligatorio.'); return; }
  if (!fecha) { _info('La fecha es obligatoria.'); return; }
  const existing = db.recordatoriosPersonales || [];
  let updated;
  if (id) {
    updated = existing.map(p => p.id === id ? {...p, titulo, fecha, hora:hora||null, descripcion:descripcion||null} : p);
  } else {
    const newId = 'pr_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    updated = [...existing, {id:newId, titulo, fecha, hora:hora||null, descripcion:descripcion||null, usuarioId:session.uid, usuarioNombre:session.nombre, completado:false, snoozeHasta:null, creadoEn:Date.now()}];
  }
  closeModal();
  await fsWriteCollection('recordatoriosPersonales', updated);
  renderAgenda();
}

async function marcarPersonalHecho(id) {
  const updated = (db.recordatoriosPersonales||[]).map(p => p.id === id ? {...p, completado:true} : p);
  await fsWriteCollection('recordatoriosPersonales', updated);
  renderAgenda();
}

async function posponerPersonal(id) {
  const sel = document.getElementById('_snz-pers-' + id);
  const dias = sel ? parseInt(sel.value) || 1 : 1;
  const ts = Date.now() + dias * 86400000;
  const updated = (db.recordatoriosPersonales||[]).map(p => p.id === id ? {...p, snoozeHasta:ts} : p);
  await fsWriteCollection('recordatoriosPersonales', updated);
  renderAgenda();
}

async function _eliminarPersonalRec(id) {
  closeModal();
  if (!confirm('¿Eliminar este recordatorio personal?')) return;
  const updated = (db.recordatoriosPersonales||[]).filter(p => p.id !== id);
  await fsWriteCollection('recordatoriosPersonales', updated);
  renderAgenda();
}

"""

if CRUD_MARKER in src:
    src = src.replace(CRUD_MARKER, CRUD_FUNCS + CRUD_MARKER, 1)
    print("✓ C5: Funciones CRUD de recordatorios personales añadidas")
else:
    errors.append("C5: no encontré function openAgendaModal(id, prefill)")

# ─────────────────────────────────────────────────────────────────────────────
# CAMBIO 6: renderDashboard llama _updateAgendaBadge al inicio
# ─────────────────────────────────────────────────────────────────────────────
OLD6 = "function renderDashboard() {"
NEW6 = "function renderDashboard() {\n  if (typeof _updateAgendaBadge === 'function') _updateAgendaBadge();"
if OLD6 in src:
    src = src.replace(OLD6, NEW6, 1)
    print("✓ C6: renderDashboard actualiza badge Agenda")
else:
    errors.append("C6: no encontré function renderDashboard()")

# ─────────────────────────────────────────────────────────────────────────────
if errors:
    print("\n❌ ERRORES encontrados — archivo NO modificado:")
    for e in errors:
        print("  -", e)
else:
    with open(F, 'w', encoding='utf-8') as fh:
        fh.write(src)
    print(f"\n✅ Todos los cambios aplicados. Líneas totales: {src.count(chr(10))}")
