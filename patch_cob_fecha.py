import re, shutil, datetime, os

path = os.path.expanduser('~') + '/mnt/firebase-deploy/public/index.html'
bak  = path + '.bak_cobfecha_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
shutil.copy2(path, bak)
print('Backup:', bak)

with open(path, encoding='utf-8') as f:
    src = f.read()

# CHANGE 1: add _cobFechaSort variable after _cobEstadoFiltro line
old1 = "  const _cobEstadoFiltro = window._cobEstadoFiltro || '';"
new1 = old1 + "\n  const _cobFechaSort = window._cobFechaSort || '';"
assert src.count(old1) == 1, f"old1 count={src.count(old1)}"
src = src.replace(old1, new1, 1)
print('Change 1 OK')

# CHANGE 2: replace .slice().reverse() with conditional sort
old2 = "  const cs = db.cobranza.slice().reverse()"
new2 = ("  const cs = (()=>{\n"
        "    const _base = db.cobranza.slice();\n"
        "    if (_cobFechaSort === 'asc') _base.sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));\n"
        "    else if (_cobFechaSort === 'desc') _base.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));\n"
        "    else _base.reverse();\n"
        "    return _base;\n"
        "  })()")
assert src.count(old2) == 1, f"old2 count={src.count(old2)}"
src = src.replace(old2, new2, 1)
print('Change 2 OK')

# CHANGE 3: make Fecha header sortable (only in cobranza table)
old3 = '<th>Factura y/o Nota</th><th>Fecha</th><th>Vence</th><th>Saldo</th>'
new3 = ('<th>Factura y/o Nota</th>'
        '<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="_cobToggleFechaSort()" title="Ordenar por fecha">'
        "${_cobFechaSort==='asc'?'Fecha ↑':_cobFechaSort==='desc'?'Fecha ↓':'Fecha <span style=\"font-size:0.75em;color:#94a3b8\">⇅</span>'}"
        '</th>'
        '<th>Vence</th><th>Saldo</th>')
assert src.count(old3) == 1, f"old3 count={src.count(old3)}"
src = src.replace(old3, new3, 1)
print('Change 3 OK')

# CHANGE 4: add sort pill between search bar and table
old4 = '      <div class="table-wrap"><table id="tbl-cob">'
pill = (
    "      ${_cobFechaSort ? `<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:10px\">\n"
    "        <span style=\"display:inline-flex;align-items:center;gap:6px;background:#dbeafe;color:#1d4ed8;border:1.5px solid #93c5fd;border-radius:20px;padding:4px 12px;font-size:0.8rem;font-weight:600\">\n"
    "          \U0001F4C5 Fecha: ${_cobFechaSort==='asc'?'más vieja primero ↑':'más nueva primero ↓'}\n"
    "          <span onclick=\"window._cobFechaSort='';renderCobranza()\" style=\"cursor:pointer;margin-left:4px;opacity:.7;font-size:1rem;line-height:1\" title=\"Quitar orden\">×</span>\n"
    "        </span>\n"
    "      </div>` : ''}\n"
    '      <div class="table-wrap"><table id="tbl-cob">'
)
assert src.count(old4) == 1, f"old4 count={src.count(old4)}"
src = src.replace(old4, pill, 1)
print('Change 4 OK')

# CHANGE 5: add _cobToggleFechaSort function near renderCobranza
old5 = "function openCobranzaDetalle(id) {"
new5 = ("function _cobToggleFechaSort() {\n"
        "  const cur = window._cobFechaSort || '';\n"
        "  window._cobFechaSort = cur === '' ? 'asc' : cur === 'asc' ? 'desc' : '';\n"
        "  renderCobranza();\n"
        "}\n"
        "window['_cobToggleFechaSort'] = _cobToggleFechaSort;\n\n"
        "function openCobranzaDetalle(id) {")
assert src.count(old5) == 1, f"old5 count={src.count(old5)}"
src = src.replace(old5, new5, 1)
print('Change 5 OK')

with open(path, 'w', encoding='utf-8') as f:
    f.write(src)
print('All done. Lines:', src.count('\n') + 1)
