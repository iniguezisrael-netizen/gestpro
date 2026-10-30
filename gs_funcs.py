import os
path = os.path.join(os.environ['HOME'], 'mnt/firebase-deploy/public/index.html')
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

INSERT_BEFORE = "document.addEventListener('DOMContentLoaded', _updateDarkBtn);"

NEW_FUNCS = """
// ─────────────────────────────────────────────────────────────────────────────
// SCAN GLOBAL — escanear desde cualquier pantalla
// ─────────────────────────────────────────────────────────────────────────────
window._gsItems      = [];
window._gsDevolucion = false;

function _globalScanInit() {
  if (!session || !can(['admin','secretaria','auxiliar','almacen'])) return;
  let _gsBuf = '', _gsTimer = null;
  const _gsHandler = (e) => {
    if (document.getElementById('modal-entrega-rapida')) return;
    if (document.getElementById('modal-scan-global'))   return;
    const active = document.activeElement;
    const tag = active ? active.tagName.toLowerCase() : '';
    if (['input','textarea','select'].includes(tag)) return;
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (_gsBuf.length >= 3) { const cod=_gsBuf; _gsBuf=''; clearTimeout(_gsTimer); openScanGlobalModal(cod); }
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      _gsBuf += e.key;
      clearTimeout(_gsTimer);
      _gsTimer = setTimeout(() => {
        if (_gsBuf.length >= 5) { const cod=_gsBuf; _gsBuf=''; openScanGlobalModal(cod); }
        else { _gsBuf=''; }
      }, 120);
    }
  };
  document.addEventListener('keydown', _gsHandler);
  window._gsCleanup = () => { document.removeEventListener('keydown', _gsHandler); clearTimeout(_gsTimer); };
}

function openScanGlobalModal(codigoInicial) {
  if (!can(['admin','secretaria','auxiliar','almacen'])) return;
  if (document.getElementById('modal-scan-global')) return;
  window._gsItems = []; window._gsDevolucion = false;
  const pedidos = (db.ventas||[])
    .filter(v => v.esPedido && v.estado !== 'Cancelada' && v.estado !== 'Pagada' && v.estado !== 'Entregado' && !v.archivado)
    .slice().reverse()
    .map(v => ({ id: v.id, folio: v.folioPedido||('#'+v.id), cliente: v.cliente||'' }));
  const quien = (session && session.nombre) ? esc(session.nombre) : '';
  const opcionesPedido = pedidos.map(p=>'<option value="'+p.id+'">'+esc(p.folio)+(p.cliente?' — '+esc(p.cliente):''  )+'</option>').join('');
  const modal = document.createElement('div');
  modal.id = 'modal-scan-global';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML =
    '<div style="background:var(--bg);border-radius:14px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'
    +'<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
    +'<span style="font-weight:700;font-size:1rem">&#128230; Entrega / Devolución rápida</span>'
    +'<button onclick="_gsClose()" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-muted);line-height:1">&#x2715;</button>'
    +'</div>'
    +'<div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">'
    +'<div style="display:flex;gap:8px">'
    +'<button id="gs-btn-entregar" onclick="_gsTipo(false)" style="flex:1;padding:10px;border-radius:8px;border:2px solid var(--primary);background:var(--primary);color:white;font-weight:600;cursor:pointer;font-size:0.9rem">&#128228; Entregar</button>'
    +'<button id="gs-btn-devolver" onclick="_gsTipo(true)"  style="flex:1;padding:10px;border-radius:8px;border:2px solid var(--border);background:var(--bg-alt);color:var(--text);font-weight:600;cursor:pointer;font-size:0.9rem">&#128229; Devolver</button>'
    +'</div>'
    +'<div><label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Pedido *</label>'
    +'<select id="gs-pedido" style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.88rem">'
    +'<option value="">— Selecciona un pedido —</option>'+opcionesPedido+'</select></div>'
    +'<div><label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Escanear material</label>'
    +'<div style="display:flex;gap:6px">'
    +'<input type="text" id="gs-scan" placeholder="Código, nombre o escanea…" autocomplete="off"'
    +' style="flex:1;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--bg);color:var(--text)"'
    +' oninput="_gsScanHint(this.value)"'
    +' onkeydown="if(event.key===\'Enter\'){event.preventDefault();_gsAgregar();}">'
    +'<button onclick="abrirEscanerCamara(t=>{const s=document.getElementById(\'gs-scan\');if(s){s.value=t;_gsScanHint(t);setTimeout(_gsAgregar,80);}},\'barras\')"'
    +' style="padding:9px 13px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-alt);cursor:pointer;font-size:1.1rem" title="Cámara">&#128247;</button>'
    +'</div>'
    +'<div id="gs-scan-hint" style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;min-height:20px;display:flex;align-items:center;gap:6px">&nbsp;</div></div>'
    +'<div style="display:flex;gap:8px;align-items:flex-end">'
    +'<div style="flex:0 0 85px"><label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Cantidad</label>'
    +'<input type="number" id="gs-qty" value="1" min="0.01" step="any"'
    +' style="width:100%;padding:9px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--bg);color:var(--text)"'
    +' onkeydown="if(event.key===\'Enter\'){event.preventDefault();_gsAgregar();}"></div>'
    +'<div style="flex:1"><label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Unidad</label>'
    +'<input type="text" id="gs-uni" placeholder="pza, m, kg…"'
    +' style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--bg);color:var(--text)"'
    +' onkeydown="if(event.key===\'Enter\'){event.preventDefault();_gsAgregar();}"></div>'
    +'<button onclick="_gsAgregar()" style="padding:9px 14px;border:none;border-radius:8px;background:var(--primary);color:white;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">&#10133; Agregar</button>'
    +'</div>'
    +'<div><label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Entregado por</label>'
    +'<input type="text" id="gs-quien" value="'+quien+'"'
    +' style="width:100%;padding:9px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:0.88rem;background:var(--bg);color:var(--text)"></div>'
    +'<div id="gs-lista"></div>'
    +'<div style="display:flex;gap:8px;padding-top:4px">'
    +'<button onclick="_gsClose()" style="flex:1;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-alt);color:var(--text);font-weight:600;cursor:pointer">Cancelar</button>'
    +'<button onclick="_gsGuardar()" style="flex:2;padding:10px;border:none;border-radius:8px;background:var(--primary);color:white;font-weight:600;cursor:pointer;font-size:0.95rem">&#10003; Confirmar todo</button>'
    +'</div>'
    +'</div></div>';
  document.body.appendChild(modal);
  // HID dentro del modal
  let _gsHIDBuf='', _gsHIDTimer2=null;
  const _gsHIDHandler = (e) => {
    if (!document.getElementById('modal-scan-global')) { document.removeEventListener('keydown', _gsHIDHandler); return; }
    const active = document.activeElement;
    if (active && active.id === 'gs-scan') return;
    const safe = ['gs-qty','gs-uni','gs-quien'];
    const tag  = active ? active.tagName.toLowerCase() : '';
    if (['input','textarea','select'].includes(tag) && !safe.includes(active&&active.id)) return;
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (_gsHIDBuf.length >= 3) {
        const cod=_gsHIDBuf; clearTimeout(_gsHIDTimer2); _gsHIDBuf='';
        const s=document.getElementById('gs-scan');
        if (s) { s.value=cod; _gsScanHint(cod); setTimeout(_gsAgregar,60); }
      }
      return;
    }
    if (e.key.length===1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      _gsHIDBuf+=e.key; clearTimeout(_gsHIDTimer2);
      _gsHIDTimer2=setTimeout(()=>{ if(_gsHIDBuf.length>=5){const cod=_gsHIDBuf;_gsHIDBuf='';const s=document.getElementById('gs-scan');if(s){s.value=cod;_gsScanHint(cod);setTimeout(_gsAgregar,60);}}else{_gsHIDBuf='';} },120);
    }
  };
  document.addEventListener('keydown', _gsHIDHandler);
  modal._gsCleanupHID = () => { document.removeEventListener('keydown', _gsHIDHandler); clearTimeout(_gsHIDTimer2); };
  if (codigoInicial) {
    setTimeout(()=>{ const s=document.getElementById('gs-scan'); if(s){s.value=codigoInicial;_gsScanHint(codigoInicial);s.focus();} }, 80);
  } else {
    setTimeout(()=>{ const s=document.getElementById('gs-scan'); if(s) s.focus(); }, 80);
  }
  _gsRenderLista();
}

function _gsTipo(dev) {
  window._gsDevolucion = dev;
  const bE=document.getElementById('gs-btn-entregar'), bD=document.getElementById('gs-btn-devolver');
  if (!bE||!bD) return;
  const estilo_on  = 'flex:1;padding:10px;border-radius:8px;border:2px solid var(--primary);background:var(--primary);color:white;font-weight:600;cursor:pointer;font-size:0.9rem';
  const estilo_off = 'flex:1;padding:10px;border-radius:8px;border:2px solid var(--border);background:var(--bg-alt);color:var(--text);font-weight:600;cursor:pointer;font-size:0.9rem';
  bE.style.cssText = dev ? estilo_off : estilo_on;
  bD.style.cssText = dev ? estilo_on  : estilo_off;
}

function _gsScanHint(val) {
  const hint=document.getElementById('gs-scan-hint');
  if (!hint||!val.trim()) { if(hint) hint.innerHTML='&nbsp;'; return; }
  const item=(db.materia||[]).find(i=>
    (i.barcode&&i.barcode.trim().toLowerCase()===val.trim().toLowerCase())||
    (i.codigo &&i.codigo.trim().toLowerCase() ===val.trim().toLowerCase())||
    (i.nombre &&i.nombre.trim().toLowerCase() ===val.trim().toLowerCase()));
  if (item) {
    const u=document.getElementById('gs-uni'); if(u&&!u.value) u.value=item.unidad||'';
    const foto=item.fotos&&item.fotos[0]
      ?'<img src="'+esc(item.fotos[0])+'" style="width:34px;height:34px;object-fit:cover;border-radius:5px;border:1px solid var(--border);flex-shrink:0">'
      :'';
    hint.style.display='flex'; hint.style.alignItems='center';
    hint.innerHTML=foto+'<span>&#9989; <strong>'+esc(item.nombre)+'</strong> — stock: '+item.cantidad+' '+esc(item.unidad||'')+'</span>';
  } else {
    hint.style.display='';
    hint.innerHTML='<span style="color:#ef4444">&#9888; No encontrado — se registrará como texto libre</span>';
  }
}

function _gsAgregar() {
  const desc=(document.getElementById('gs-scan')?.value||'').trim();
  const qty=parseFloat(document.getElementById('gs-qty')?.value)||1;
  const uni=(document.getElementById('gs-uni')?.value||'').trim();
  if (!desc) return;
  const item=(db.materia||[]).find(i=>
    (i.barcode&&i.barcode.trim().toLowerCase()===desc.toLowerCase())||
    (i.codigo &&i.codigo.trim().toLowerCase() ===desc.toLowerCase())||
    (i.nombre &&i.nombre.trim().toLowerCase() ===desc.toLowerCase()));
  window._gsItems.push({descripcion:item?item.nombre:desc, cantidad:qty, unidad:item?(item.unidad||uni):uni, _materiaId:item?item.id:null});
  const s=document.getElementById('gs-scan'); if(s){s.value='';s.focus();}
  const u=document.getElementById('gs-uni');  if(u) u.value='';
  const h=document.getElementById('gs-scan-hint'); if(h) h.innerHTML='&nbsp;';
  const q=document.getElementById('gs-qty');  if(q) q.value=1;
  _gsRenderLista();
}

function _gsRenderLista() {
  const wrap=document.getElementById('gs-lista');
  if (!wrap) return;
  if (!window._gsItems.length) { wrap.innerHTML='<p style="color:#94a3b8;font-size:0.82rem;text-align:center;padding:4px 0">Sin materiales agregados aún.</p>'; return; }
  wrap.innerHTML='<div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:5px">'+window._gsItems.length+' material(es):</div>'+
    window._gsItems.map(function(it,i){
      const mat=it._materiaId?(db.materia||[]).find(function(m){return m.id===it._materiaId;}):null;
      const foto=mat&&mat.fotos&&mat.fotos[0]
        ?'<img src="'+esc(mat.fotos[0])+'" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid var(--border);flex-shrink:0">'
        :'<div style="width:36px;height:36px;border-radius:6px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:0.95rem;flex-shrink:0">&#128230;</div>';
      return '<div style="display:flex;align-items:center;gap:7px;padding:5px 8px;background:var(--bg-alt);border-radius:7px;margin-bottom:4px">'
        +foto
        +'<span style="flex:1;font-size:0.82rem">'+esc(it.cantidad+' '+(it.unidad||'')+' '+it.descripcion)+'</span>'
        +'<button onclick="window._gsItems.splice('+i+',1);_gsRenderLista()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1rem;padding:0 2px;line-height:1">&#x2715;</button>'
        +'</div>';
    }).join('');
}

function _gsClose() {
  const modal=document.getElementById('modal-scan-global');
  if (modal) { if(typeof modal._gsCleanupHID==='function') modal._gsCleanupHID(); modal.remove(); }
  window._gsItems=[]; window._gsDevolucion=false;
}

function _gsGuardar() {
  if (!window._gsItems.length) { _info('Agrega al menos un material antes de confirmar.'); return; }
  const selPed=document.getElementById('gs-pedido');
  const ventaId=selPed?(parseInt(selPed.value)||null):null;
  if (!ventaId) { _info('Selecciona un pedido.'); return; }
  const dev=window._gsDevolucion;
  const quien=(document.getElementById('gs-quien')?.value||'').trim();
  const hoy=today();
  (window._gsItems||[]).forEach(function(it){
    if (!it._materiaId) return;
    const mat=(db.materia||[]).find(function(m){return m.id===it._materiaId;});
    if (!mat) return;
    if (dev) mat.cantidad=(mat.cantidad||0)+(it.cantidad||1);
    else     mat.cantidad=Math.max(0,(mat.cantidad||0)-(it.cantidad||1));
  });
  if ((window._gsItems||[]).some(function(it){return it._materiaId;})) saveDb('materia');
  const v=(db.ventas||[]).find(function(x){return x.id===ventaId;});
  db.entregaInsumos=db.entregaInsumos||[];
  db.entregaInsumos.push({id:sid(), pedidoId:ventaId, folioPedido:v?(v.folioPedido||('#'+ventaId)):('#'+ventaId), cliente:v?(v.cliente||''):'', fecha:hoy, entregadoPor:quien, notas:'', materiales:window._gsItems, esDevolucion:dev});
  saveDb('entregaInsumos');
  _gsClose();
  if (typeof renderEntregaInsumos==='function') renderEntregaInsumos();
  showToast(dev?'&#9989; Devolución registrada.':'&#9989; Entrega registrada.','success');
}

"""

src = src.replace(INSERT_BEFORE, NEW_FUNCS + INSERT_BEFORE, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)

print("DONE —", len(src), "bytes")
