import sys
PATH = "/sessions/rcw-01x7kypw4b5ozpcxwbysps6c/mnt/firebase-deploy/public/index.html"
with open(PATH,'r',encoding='utf-8') as f: src = f.read()
errs = []

# ── 1. CSS Recordatorios Outlook ────────────────────────────────────────────
CSS_ANCHOR = "  .card-header > div, .card-header > span + div { display: flex; gap: 6px; flex-wrap: wrap; }"
CSS_NEW = """
  /* ── Recordatorios Outlook-style ───────────────────────────── */
  .rec-wrap { background:var(--card,#fff); border-radius:10px; padding:14px 16px; }
  .rec-search-bar { display:flex;align-items:center;gap:8px;margin-bottom:10px;background:var(--bg,#f8fafc);border:1px solid var(--border,#e2e8f0);border-radius:7px;padding:5px 10px; }
  .rec-search-bar input { flex:1;border:none;background:transparent;outline:none;font-size:0.82rem;color:var(--text,#1e293b); }
  .rec-search-bar input::placeholder { color:#94a3b8; }
  .rec-tabs { display:flex;gap:2px;margin-bottom:12px;border-bottom:2px solid var(--border,#e2e8f0);padding-bottom:0; }
  .rec-tab { padding:5px 14px;font-size:0.82rem;font-weight:600;border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;color:#64748b;transition:color .15s,border-color .15s; }
  .rec-tab.active { color:var(--primary,#2563eb);border-bottom-color:var(--primary,#2563eb); }
  .rec-tab:hover:not(.active) { color:var(--text,#1e293b); }
  .rec-group-hdr { display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:0.78rem;font-weight:700;color:#64748b;cursor:pointer;user-select:none;letter-spacing:.03em;text-transform:uppercase; }
  .rec-group-hdr:hover { color:var(--text,#1e293b); }
  .rec-row { display:flex;align-items:center;gap:0;border-radius:7px;margin-bottom:3px;position:relative;overflow:hidden;background:var(--bg,#f8fafc);transition:background .12s; }
  .rec-row:hover { background:#eff6ff; }
  .rec-stripe { width:4px;align-self:stretch;flex-shrink:0;border-radius:4px 0 0 4px; }
  .rec-body { flex:1;min-width:0;padding:9px 10px;font-size:0.85rem; }
  .rec-body .rec-title { font-weight:600;color:var(--text,#1e293b); }
  .rec-body .rec-meta { font-size:0.75rem;color:#64748b;margin-top:1px; }
  .rec-body .rec-nota { font-size:0.76rem;color:#94a3b8;font-style:italic;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px; }
  .rec-actions { display:flex;align-items:center;gap:4px;padding:0 8px;flex-shrink:0;opacity:0;transition:opacity .15s;pointer-events:none; }
  .rec-row:hover .rec-actions, .rec-row:focus-within .rec-actions { opacity:1;pointer-events:auto; }
  .rec-week-grid { display:grid;grid-template-columns:30px repeat(7,1fr);gap:0;border:1px solid var(--border,#e2e8f0);border-radius:8px;overflow:hidden;font-size:0.76rem; }
  .rec-wlabel { background:var(--bg,#f8fafc);padding:6px 4px;text-align:center;font-weight:700;font-size:0.7rem;color:#64748b;border-bottom:1px solid var(--border,#e2e8f0);border-right:1px solid var(--border,#e2e8f0); }
  .rec-wtime-col { background:var(--bg,#f8fafc);border-right:1px solid var(--border,#e2e8f0); }
  .rec-wcell { min-height:42px;border-right:1px solid var(--border,#e2e8f0);border-bottom:1px solid var(--border,#e2e8f0);padding:3px 4px;vertical-align:top;background:var(--card,#fff); }
  .rec-wcell.today-col { background:#eff6ff; }
  .rec-wcell .rec-chip { font-size:0.68rem;border-radius:4px;padding:2px 5px;margin-bottom:2px;cursor:pointer;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff; }
  .rec-month-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border,#e2e8f0);border-radius:8px;overflow:hidden;border:1px solid var(--border,#e2e8f0); }
  .rec-mcell { background:var(--card,#fff);min-height:70px;padding:4px 5px;font-size:0.72rem; }
  .rec-mcell.other-month { background:var(--bg,#f8fafc);color:#94a3b8; }
  .rec-mcell.today-cell { outline:2px solid var(--primary,#2563eb);outline-offset:-2px; }
  .rec-mcell .rec-day-num { font-weight:700;font-size:0.75rem;margin-bottom:2px;color:inherit; }
  .rec-mcell .rec-chip { font-size:0.62rem;border-radius:3px;padding:1px 4px;margin-bottom:1px;cursor:pointer;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff; }
  mark.rec-hl { background:#fef08a;border-radius:2px;color:inherit; }
  .dark-mode .rec-row { background:#1e293b; }
  .dark-mode .rec-row:hover { background:#1e3a5f; }
  .dark-mode .rec-wcell { background:#0f172a; }
  .dark-mode .rec-wcell.today-col { background:#1e3a5f; }
  .dark-mode .rec-mcell { background:#0f172a; }
  .dark-mode .rec-mcell.other-month { background:#090f1a; }
  .dark-mode .rec-search-bar { background:#0f172a; }
  .dark-mode .rec-search-bar input { color:#e2e8f0; }
  /* ─────────────────────────────────────────────────────────── */"""
if CSS_ANCHOR not in src: errs.append("CSS anchor")
else: src = src.replace(CSS_ANCHOR, CSS_ANCHOR + CSS_NEW, 1); print("1. CSS OK")

# ── 2. Recordatorios sections ────────────────────────────────────────────────
OLD_START = "  // ── SECCIÓN 2: RECORDATORIOS DE SEGUIMIENTO ─────────────────────────────"
OLD_END   = """  el.innerHTML = `
    ${_secDiv('📅 Citas de instalación')}
    ${_citasHTML}
    ${_secDiv('🔔 Seguimiento')}
    ${_seguimientoHTML}
    ${_secDiv('📝 Personales')}
    ${_personalesHTML}
  `;
  _updateAgendaBadge();
}"""
NEW_CODE = r"""  // ── SECCIONES 2+3: RECORDATORIOS (Outlook-style unificado) ───────────────
  const _recordatoriosHTML = (can(['admin','secretaria','auxiliar']) && session.rol !== 'almacenista') ? (()=>{
    if (window._recTabView === undefined) window._recTabView = 'lista';
    if (window._recWeekOff === undefined) window._recWeekOff = 0;
    if (window._recMonthOff === undefined) window._recMonthOff = 0;
    if (window._recSearchQ === undefined) window._recSearchQ = '';
    if (window._recAgAdminFilter === undefined) window._recAgAdminFilter = '';
    if (window._persAdminFilter === undefined) window._persAdminFilter = '';
    const _nowHHMM = new Date().toTimeString().slice(0,5);
    // ── Seguimiento ─────────────────────────────────────────────────────────
    const _allSeg = (db.cotizaciones||[]).filter(c => c.recFecha && !c.recHecho);
    const _mySeg  = _allSeg.filter(c => esAdmin ? (window._recAgAdminFilter ? c.usuario === window._recAgAdminFilter : true) : c.usuario === session.nombre);
    const _recUsuarios = esAdmin ? [...new Set(_allSeg.map(c=>c.usuario||'').filter(u=>u))].sort() : [];
    const segsV   = _mySeg.filter(c => !(c.recSnoozeHasta && c.recSnoozeHasta > Date.now()) && (c.recFecha < hoy || (c.recFecha === hoy && (!c.recHora || c.recHora <= _nowHHMM)))).sort((a,b)=>a.recFecha.localeCompare(b.recFecha)||(a.recHora||'').localeCompare(b.recHora||''));
    const segsP   = _mySeg.filter(c => !(c.recSnoozeHasta && c.recSnoozeHasta > Date.now()) && (c.recFecha > hoy || (c.recFecha === hoy && c.recHora && c.recHora > _nowHHMM))).sort((a,b)=>a.recFecha.localeCompare(b.recFecha)||(a.recHora||'').localeCompare(b.recHora||''));
    const segsSnz = _mySeg.filter(c => c.recSnoozeHasta && c.recSnoozeHasta > Date.now()).sort((a,b)=>(a.recSnoozeHasta||0)-(b.recSnoozeHasta||0));
    // ── Personales ──────────────────────────────────────────────────────────
    const _allPers = (db.recordatoriosPersonales||[]);
    const _myPers  = esAdmin ? (window._persAdminFilter ? _allPers.filter(p => p.usuarioId === window._persAdminFilter) : _allPers) : _allPers.filter(p => p.usuarioId === session.uid);
    const _persUsuariosMap = {};
    _allPers.forEach(p => { if (p.usuarioId && !_persUsuariosMap[p.usuarioId]) _persUsuariosMap[p.usuarioId] = p.usuarioNombre||p.usuarioId; });
    const _persUsuarios = Object.entries(_persUsuariosMap).map(([id,n]) => ({id,n}));
    const persV   = _myPers.filter(p => !p.completado && !(p.snoozeHasta && p.snoozeHasta > Date.now()) && p.fecha && (p.fecha < hoy || (p.fecha === hoy && (!p.hora || p.hora <= _nowHHMM)))).sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||''));
    const persP   = _myPers.filter(p => !p.completado && !(p.snoozeHasta && p.snoozeHasta > Date.now()) && p.fecha && (p.fecha > hoy || (p.fecha === hoy && p.hora && p.hora > _nowHHMM))).sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||''));
    const persSnz = _myPers.filter(p => !p.completado && p.snoozeHasta && p.snoozeHasta > Date.now()).sort((a,b)=>(a.snoozeHasta||0)-(b.snoozeHasta||0));
    // ── Helpers ─────────────────────────────────────────────────────────────
    function _fmtSnz(ts) {
      const mins = Math.round((ts - Date.now()) / 60000);
      if (mins < 1) return 'en menos de 1 min';
      if (mins < 60) return 'en ' + mins + ' min';
      const hrs = Math.floor(mins/60), rem = mins%60;
      if (hrs < 24) return 'en ' + hrs + 'h' + (rem ? ' ' + rem + 'min' : '');
      const d = new Date(ts);
      return 'el ' + d.toLocaleDateString('es-MX',{day:'numeric',month:'short'}) + (d.getHours() ? ' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0') : '');
    }
    function _strip(s) { return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
    function _hl(s, q) {
      if (!q) return esc(s);
      const n = (s||''), ns = _strip(n), qs = _strip(q);
      let out = '', i = 0;
      while (i < n.length) {
        const idx = ns.indexOf(qs, i);
        if (idx < 0) { out += esc(n.slice(i)); break; }
        out += esc(n.slice(i, idx)) + '<mark class="rec-hl">' + esc(n.slice(idx, idx+qs.length)) + '</mark>';
        i = idx + qs.length;
      }
      return out;
    }
    // ── Calendar array ──────────────────────────────────────────────────────
    const _calAll = [];
    _mySeg.forEach(c => _calAll.push({tipo:'seg',esV:segsV.includes(c),id:c.id,nombre:c.cliente||(c.ctEmpresa||''),fecha:c.recFecha||'',hora:c.recHora||'',nota:c.recNota||'',snooze:!!(c.recSnoozeHasta&&c.recSnoozeHasta>Date.now())}));
    _myPers.filter(p=>!p.completado).forEach(p => _calAll.push({tipo:'pers',esV:persV.includes(p),id:p.id,nombre:p.titulo||'',fecha:p.fecha||'',hora:p.hora||'',nota:p.descripcion||'',snooze:!!(p.snoozeHasta&&p.snoozeHasta>Date.now())}));
    // ── Row builders ────────────────────────────────────────────────────────
    const _q = window._recSearchQ || '';
    function _matches(texts) {
      if (!_q) return true;
      const qs = _strip(_q);
      return texts.some(t => _strip(t||'').includes(qs));
    }
    function _segRowV(c) {
      if (!_matches([c.cliente,c.ctEmpresa,String(c.id),c.recNota])) return '';
      return `<div class="rec-row"><div class="rec-stripe" style="background:#dc2626"></div><div class="rec-body"><div class="rec-title">${_hl(c.cliente,_q)}${c.ctEmpresa?` <span style="font-weight:400;color:#64748b;font-size:0.78rem">${_hl(c.ctEmpresa,_q)}</span>`:''}</div><div class="rec-meta">⚠️ ${c.recFecha===hoy?'<b style="color:#dc2626">Hoy</b>':fechaLarga(c.recFecha)}${c.recHora?' · '+fmtRecHora(c.recHora):''}  <span style="color:#94a3b8">#${c.id}</span></div>${c.recNota?`<div class="rec-nota">${_hl(c.recNota,_q)}</div>`:''}</div><div class="rec-actions"><select id="_rec-snz-cot-${c.id}" style="font-size:0.7rem;padding:2px 5px;border:1px solid #d1d5db;border-radius:5px;background:white;color:#374151"><option value="1">Mañana</option><option value="2">+2 días</option><option value="7">+1 sem</option><option value="14">+2 sem</option><option value="fecha">📅 Fecha</option></select><button onclick="_posponerRec(${c.id},'cotizacion')" style="font-size:0.7rem;padding:2px 8px;background:#1d4ed8;color:white;border:none;border-radius:5px;cursor:pointer">💤</button><button class="btn btn-outline btn-sm" onclick="verCotiz(${c.id})">Ver</button><button onclick="marcarRecHecho(${c.id});renderAgenda()" style="background:#16a34a;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:0.75rem;cursor:pointer">✓</button></div></div>`;
    }
    function _segRowP(c) {
      if (!_matches([c.cliente,c.ctEmpresa,String(c.id),c.recNota])) return '';
      return `<div class="rec-row"><div class="rec-stripe" style="background:#2563eb"></div><div class="rec-body"><div class="rec-title">${_hl(c.cliente,_q)}${c.ctEmpresa?` <span style="font-weight:400;color:#64748b;font-size:0.78rem">${_hl(c.ctEmpresa,_q)}</span>`:''}</div><div class="rec-meta">📅 ${fechaLarga(c.recFecha)}${c.recHora?' · '+fmtRecHora(c.recHora):''}  <span style="color:#94a3b8">#${c.id}</span></div>${c.recNota?`<div class="rec-nota">${_hl(c.recNota,_q)}</div>`:''}</div><div class="rec-actions"><button class="btn btn-outline btn-sm" onclick="editarRecordatorio(${c.id})">✏️</button><button class="btn btn-outline btn-sm" onclick="verCotiz(${c.id})">Ver</button></div></div>`;
    }
    function _segRowSnz(c) {
      if (!_matches([c.cliente,c.ctEmpresa,String(c.id),c.recNota])) return '';
      return `<div class="rec-row"><div class="rec-stripe" style="background:#7c3aed"></div><div class="rec-body"><div class="rec-title">${_hl(c.cliente,_q)}${c.ctEmpresa?` <span style="font-weight:400;color:#64748b;font-size:0.78rem">${_hl(c.ctEmpresa,_q)}</span>`:''}</div><div class="rec-meta">💤 ${_fmtSnz(c.recSnoozeHasta)}  <span style="color:#94a3b8">#${c.id}</span></div>${c.recNota?`<div class="rec-nota">${_hl(c.recNota,_q)}</div>`:''}</div><div class="rec-actions"><button class="btn btn-outline btn-sm" onclick="editarRecordatorio(${c.id})">✏️</button><button class="btn btn-outline btn-sm" onclick="verCotiz(${c.id})">Ver</button></div></div>`;
    }
    function _persRow(p, tipo) {
      if (!_matches([p.titulo,p.descripcion,p.usuarioNombre])) return '';
      const stripe = tipo==='v'?'#dc2626':tipo==='p'?'#7c3aed':'#64748b';
      const meta = tipo==='v'?`⚠️ ${p.fecha===hoy?'<b style="color:#dc2626">Hoy</b>':fechaLarga(p.fecha)}${p.hora?' · '+p.hora:''}`:tipo==='p'?`📅 ${fechaLarga(p.fecha)}${p.hora?' · '+p.hora:''}`:`💤 ${_fmtSnz(p.snoozeHasta)}`;
      return `<div class="rec-row"><div class="rec-stripe" style="background:${stripe}"></div><div class="rec-body"><div class="rec-title">${_hl(p.titulo,_q)}</div><div class="rec-meta">${meta}${esAdmin&&p.usuarioNombre?' · <span style="color:#94a3b8">'+esc(p.usuarioNombre)+'</span>':''}</div>${p.descripcion?`<div class="rec-nota">${_hl(p.descripcion,_q)}</div>`:''}</div><div class="rec-actions"><button class="btn btn-outline btn-sm" onclick="openPersonalRecModal('${p.id}')">✏️</button>${tipo==='v'?`<select id="_snz-pers-${p.id}" style="font-size:0.7rem;padding:2px 5px;border:1px solid #d1d5db;border-radius:5px;background:white;color:#374151"><option value="1">Mañana</option><option value="2">+2 días</option><option value="7">+1 sem</option><option value="14">+2 sem</option></select><button onclick="posponerPersonal('${p.id}')" style="font-size:0.7rem;padding:2px 8px;background:#1d4ed8;color:white;border:none;border-radius:5px;cursor:pointer">💤</button><button onclick="marcarPersonalHecho('${p.id}')" style="background:#16a34a;color:white;border:none;border-radius:5px;padding:3px 8px;font-size:0.75rem;cursor:pointer">✓</button>`:''}</div></div>`;
    }
    // ── Collapsible group ───────────────────────────────────────────────────
    let _gn = 0;
    function _grp(label, color, rows, openDefault) {
      const filled = rows.filter(r=>r);
      if (!filled.length) return '';
      const id = 'rg'+(++_gn);
      const open = openDefault !== false;
      return `<div style="margin-bottom:4px"><div class="rec-group-hdr" onclick="(function(){const c=document.getElementById('${id}');c.style.display=c.style.display==='none'?'block':'none';this.querySelector('.rgg-arr').textContent=c.style.display==='none'?'▶':'▼';}).call(this)"><span class="rgg-arr">${open?'▼':'▶'}</span><span style="color:${color}">●</span> ${label} <span style="font-weight:400;color:#94a3b8;font-size:0.72rem;text-transform:none">(${filled.length})</span></div><div id="${id}" style="display:${open?'block':'none'}">${filled.join('')}</div></div>`;
    }
    // ── Lista ───────────────────────────────────────────────────────────────
    const _segSec = [
      _grp('Vencidos · Seguimiento','#dc2626',segsV.map(c=>_segRowV(c)),true),
      _grp('Próximos · Seguimiento','#2563eb',segsP.map(c=>_segRowP(c)),segsV.length===0),
      _grp('Pospuestos · Seguimiento','#7c3aed',segsSnz.map(c=>_segRowSnz(c)),false)
    ].filter(Boolean).join('');
    const _persSec = [
      _grp('Vencidos · Personales','#dc2626',persV.map(p=>_persRow(p,'v')),true),
      _grp('Próximos · Personales','#7c3aed',persP.map(p=>_persRow(p,'p')),persV.length===0),
      _grp('Pospuestos · Personales','#64748b',persSnz.map(p=>_persRow(p,'s')),false)
    ].filter(Boolean).join('');
    const _listaHTML = (_segSec||_persSec)
      ? (_segSec+(_persSec?'<div style="margin-top:8px;border-top:1px solid var(--border,#e2e8f0);padding-top:8px">'+_persSec+'</div>':''))
      : '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:0.85rem">Sin recordatorios pendientes.</div>';
    // ── Semana ──────────────────────────────────────────────────────────────
    function _buildSemana() {
      const base = new Date(hoy+'T00:00:00');
      base.setDate(base.getDate()-((base.getDay()||7)-1)+(window._recWeekOff||0)*7);
      const days = Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(d.getDate()+i);return d;});
      const fmt = d => d.toISOString().slice(0,10);
      const dn = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
      const hdr = days.map((d,i)=>`<div class="rec-wlabel">${dn[i]}<br>${d.getDate()}</div>`).join('');
      const cells = days.map(d=>{
        const ds=fmt(d);
        const items=_calAll.filter(r=>r.fecha===ds);
        return `<div class="rec-wcell${ds===hoy?' today-col':''}">${items.map(r=>`<span class="rec-chip" style="background:${r.tipo==='seg'?(r.snooze?'#7c3aed':r.esV?'#dc2626':'#2563eb'):(r.snooze?'#64748b':r.esV?'#dc2626':'#7c3aed')}" title="${esc(r.nombre+(r.hora?' · '+r.hora:'')+(r.nota?' — '+r.nota:''))}" onclick="${r.tipo==='seg'?'verCotiz('+r.id+')':'openPersonalRecModal(\''+r.id+'\')'}">
          ${r.hora?`<b>${r.hora}</b> `:''}${esc((r.nombre||'').slice(0,20))}
        </span>`).join('')}</div>`;
      }).join('');
      const rl=days[0].toLocaleDateString('es-MX',{day:'numeric',month:'short'})+' – '+days[6].toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'});
      return `<div><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><button onclick="window._recWeekOff=(window._recWeekOff||0)-1;renderAgenda()" class="btn btn-outline btn-sm">‹</button><span style="font-size:0.82rem;font-weight:600;color:#64748b">${rl}</span><button onclick="window._recWeekOff=(window._recWeekOff||0)+1;renderAgenda()" class="btn btn-outline btn-sm">›</button>${window._recWeekOff?`<button onclick="window._recWeekOff=0;renderAgenda()" class="btn btn-outline btn-sm">Hoy</button>`:''}</div><div class="rec-week-grid"><div class="rec-wlabel rec-wtime-col"></div>${hdr}<div class="rec-wtime-col"></div>${cells}</div></div>`;
    }
    // ── Mes ─────────────────────────────────────────────────────────────────
    function _buildMes() {
      const ref=new Date(hoy+'T00:00:00');
      ref.setMonth(ref.getMonth()+(window._recMonthOff||0));ref.setDate(1);
      const year=ref.getFullYear(),month=ref.getMonth();
      const mn=ref.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
      const first=new Date(year,month,1);
      const start=new Date(first);start.setDate(start.getDate()-((start.getDay()||7)-1));
      const dn7=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
      const hdrRow=dn7.map(d=>`<div style="background:var(--bg,#f8fafc);padding:5px 0;text-align:center;font-size:0.7rem;font-weight:700;color:#64748b;border-bottom:1px solid var(--border,#e2e8f0)">${d}</div>`).join('');
      let cells='',cur=new Date(start);
      for(let i=0;i<42;i++){
        const ds=cur.toISOString().slice(0,10);
        const inM=cur.getMonth()===month,isT=ds===hoy;
        const items=_calAll.filter(r=>r.fecha===ds);
        cells+=`<div class="rec-mcell${!inM?' other-month':''}${isT?' today-cell':''}"><div class="rec-day-num">${cur.getDate()}</div>${items.slice(0,3).map(r=>`<span class="rec-chip" style="background:${r.tipo==='seg'?(r.snooze?'#7c3aed':r.esV?'#dc2626':'#2563eb'):(r.snooze?'#64748b':r.esV?'#dc2626':'#7c3aed')}" title="${esc(r.nombre)}" onclick="${r.tipo==='seg'?'verCotiz('+r.id+')':'openPersonalRecModal(\''+r.id+'\')'}">${esc((r.nombre||'').slice(0,18))}</span>`).join('')}${items.length>3?`<span style="font-size:0.6rem;color:#94a3b8">+${items.length-3} más</span>`:''}</div>`;
        cur.setDate(cur.getDate()+1);
      }
      return `<div><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><button onclick="window._recMonthOff=(window._recMonthOff||0)-1;renderAgenda()" class="btn btn-outline btn-sm">‹</button><span style="font-size:0.82rem;font-weight:600;color:#64748b;text-transform:capitalize">${mn}</span><button onclick="window._recMonthOff=(window._recMonthOff||0)+1;renderAgenda()" class="btn btn-outline btn-sm">›</button>${window._recMonthOff?`<button onclick="window._recMonthOff=0;renderAgenda()" class="btn btn-outline btn-sm">Hoy</button>`:''}</div><div class="rec-month-grid">${hdrRow}${cells}</div></div>`;
    }
    // ── Render ──────────────────────────────────────────────────────────────
    const _tab = window._recTabView || 'lista';
    const _tabContent = _tab==='semana'?_buildSemana():_tab==='mes'?_buildMes():_listaHTML;
    const _adminSeg = esAdmin?`<select onchange="window._recAgAdminFilter=this.value;renderAgenda()" style="font-size:0.72rem;padding:3px 7px;border:1px solid var(--border,#e2e8f0);border-radius:6px;background:var(--card,#fff);color:var(--text,#374151)"><option value="" ${!window._recAgAdminFilter?'selected':''}>🔔 Todos</option><option value="${session.nombre}" ${window._recAgAdminFilter===session.nombre?'selected':''}>Solo míos</option>${_recUsuarios.filter(u=>u!==session.nombre).map(u=>`<option value="${u}" ${window._recAgAdminFilter===u?'selected':''}>${u}</option>`).join('')}</select>`:'';
    const _adminPers = esAdmin?`<select onchange="window._persAdminFilter=this.value;renderAgenda()" style="font-size:0.72rem;padding:3px 7px;border:1px solid var(--border,#e2e8f0);border-radius:6px;background:var(--card,#fff);color:var(--text,#374151)"><option value="" ${!window._persAdminFilter?'selected':''}>📝 Todos</option><option value="${session.uid}" ${window._persAdminFilter===session.uid?'selected':''}>Solo míos</option>${_persUsuarios.filter(u=>u.id!==session.uid).map(u=>`<option value="${u.id}" ${window._persAdminFilter===u.id?'selected':''}>${esc(u.n)}</option>`).join('')}</select>`:'';
    return `<div class="rec-wrap"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="rec-search-bar" style="flex:1;min-width:180px"><span style="color:#94a3b8;font-size:0.8rem">🔍</span><input type="text" placeholder="Buscar recordatorio…" value="${esc(window._recSearchQ||'')}" oninput="window._recSearchQ=this.value;renderAgenda()" />${window._recSearchQ?`<button onclick="window._recSearchQ='';renderAgenda()" style="border:none;background:none;cursor:pointer;color:#94a3b8;font-size:0.85rem;padding:0 2px">✕</button>`:''}</div>${_adminSeg}${_adminPers}<button class="btn btn-primary btn-sm" onclick="openPersonalRecModal()">+ Personal</button><button class="btn btn-outline btn-sm" onclick="navigate('cotizaciones')">Ver seguimiento</button>${segsV.length?`<button onclick="_descartarTodosRecs()" style="background:#dc2626;color:white;border:none;padding:4px 9px;font-size:0.72rem;border-radius:6px;cursor:pointer">✕ Descartar todos</button>`:''}</div><div class="rec-tabs"><button class="rec-tab${_tab==='lista'?' active':''}" onclick="window._recTabView='lista';renderAgenda()">☰ Lista</button><button class="rec-tab${_tab==='semana'?' active':''}" onclick="window._recTabView='semana';renderAgenda()">📅 Semana</button><button class="rec-tab${_tab==='mes'?' active':''}" onclick="window._recTabView='mes';renderAgenda()">📆 Mes</button></div><div id="rec-tab-content">${_tabContent}</div></div>`;
  })() : `<div class="card" style="text-align:center;padding:30px;color:#94a3b8">Sin acceso a recordatorios.</div>`;

  el.innerHTML = `
    ${_secDiv('📅 Citas de instalación')}
    ${_citasHTML}
    ${_secDiv('🔔 Recordatorios')}
    ${_recordatoriosHTML}
  `;
  _updateAgendaBadge();
}"""
if OLD_START not in src: errs.append("Sec2 start")
elif OLD_END not in src: errs.append("el.innerHTML end")
else:
    idx_s = src.index(OLD_START)
    idx_e = src.index(OLD_END) + len(OLD_END)
    src = src[:idx_s] + NEW_CODE + src[idx_e:]
    print("2. Recordatorios sections OK")

# ── 3. Agenda default: semana_cal ───────────────────────────────────────────
OLD3 = "  const filtro = window._agendaFiltro || 'proximas';"
NEW3 = "  const filtro = window._agendaFiltro || 'semana_cal';"
if OLD3 not in src: errs.append("agenda default")
else: src = src.replace(OLD3, NEW3, 1); print("3. Agenda default semana_cal OK")

# ── 4. Pasadas: solo 2 semanas ──────────────────────────────────────────────
OLD4 = "          ? todas.filter(c => c.fecha < hoy || c.estado === 'Completada').reverse()"
NEW4 = "          ? (()=>{ const _2w=new Date(hoy+'T00:00:00'); _2w.setDate(_2w.getDate()-14); const _2ws=_2w.toISOString().slice(0,10); return todas.filter(c=>(c.fecha<hoy||c.estado==='Completada')&&c.fecha>=_2ws).reverse(); })()"
if OLD4 not in src: errs.append("pasadas 2sem")
else: src = src.replace(OLD4, NEW4, 1); print("4. Pasadas 2 semanas OK")

# ── 5. Todas: de hoy en adelante ─────────────────────────────────────────────
OLD5 = "          : todas.slice().reverse();"
NEW5 = "          : todas.filter(c => c.fecha >= hoy);"
if OLD5 not in src: errs.append("todas hoy+")
else: src = src.replace(OLD5, NEW5, 1); print("5. Todas hoy+ OK")

if errs:
    print("ERRORES:", errs); sys.exit(1)

with open(PATH,'w',encoding='utf-8') as f: f.write(src)
print("Archivo guardado — tamaño:", len(src))
