const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
// Colecciones con documentos individuales (no FS_ARRAY_COLS actuales)
const ALL_COLS = ['ventas','cotizaciones','cajas','cobranza','consignacion','vehiculos',
  'reparaciones','clientes','materia','productos','catalogoMateriales','bodegas','entregas',
  'facturas','herramientas','herramientasAsignadas','herramientasHistorial','ordenesCompra',
  'proveedores','checadorConfig','entregaInsumos','reportesEntrega','reportesProduccion','produccion','agenda'];

function readToken() {
  for (const p of [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  ]) {
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return j.tokens?.refresh_token || j.refresh_token;
    }
  }
  throw new Error('No credentials');
}

function getAccessToken(rt) {
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  }).toString();
  return new Promise((res, rej) => {
    const r = https.request({ hostname:'oauth2.googleapis.com', path:'/token', method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(payload)}
    }, resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ const j=JSON.parse(d); if(j.error) rej(new Error(j.error)); else res(j.access_token); }); });
    r.on('error',rej); r.write(payload); r.end();
  });
}

function apiCall(token, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname:'firestore.googleapis.com', path:urlPath, method,
      headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'} };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, resp => {
      let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ try{resolve({status:resp.statusCode,body:d?JSON.parse(d):{}});}catch(e){resolve({status:resp.statusCode,body:d});} }); });
    req.on('error',reject);
    if (body) req.write(body);
    req.end();
  });
}

function kb(b){ return (b/1024).toFixed(1); }

async function main() {
  const token = await getAccessToken(readToken());
  console.log('Token OK.\n');

  const backupDir = path.join(os.homedir(),'Downloads','firebase-deploy','backup-data-docs');
  fs.mkdirSync(backupDir, {recursive:true});

  const legacyFound = [];

  // 1. Verificar cuáles colecciones tienen doc "data"
  console.log('=== Buscando documentos "data" legacy ===');
  for (const col of ALL_COLS) {
    const r = await apiCall(token, 'GET', `/v1/projects/${PROJECT}/databases/(default)/documents/${col}/data`);
    if (r.status === 200 && r.body.fields) {
      const raw = JSON.stringify(r.body);
      const size = Buffer.byteLength(raw);
      const hasItems = !!r.body.fields?.items;
      console.log(`  ${col}/data — ${kb(size)} KB ${hasItems ? '(tiene items[])' : '(sin items[])'}`);
      legacyFound.push({ col, size, hasItems, doc: r.body });
    }
  }

  if (!legacyFound.length) { console.log('  Ninguno encontrado.'); return; }

  // 2. Respaldar todos antes de borrar
  console.log('\n=== Guardando respaldo local ===');
  for (const { col, doc } of legacyFound) {
    const backupFile = path.join(backupDir, col + '_data_backup.json');
    fs.writeFileSync(backupFile, JSON.stringify(doc, null, 2));
    console.log(`  Respaldo: ${backupFile}`);
  }

  // 3. Borrar solo materia/data y catalogoMateriales/data (autorizados)
  const toDelete = ['materia', 'catalogoMateriales'];
  console.log('\n=== Borrando documentos legacy autorizados ===');
  for (const col of toDelete) {
    const found = legacyFound.find(x => x.col === col);
    if (!found) { console.log(`  ${col}/data — no existe, omitiendo`); continue; }
    const r = await apiCall(token, 'DELETE', `/v1/projects/${PROJECT}/databases/(default)/documents/${col}/data`);
    if (r.status === 200) {
      console.log(`  ✅ ${col}/data eliminado (${kb(found.size)} KB liberados)`);
    } else {
      console.log(`  ❌ Error borrando ${col}/data:`, r.status, r.body);
    }
  }

  // 4. Mostrar resumen de otros legacy encontrados (no borrados aún)
  const others = legacyFound.filter(x => !toDelete.includes(x.col));
  if (others.length) {
    console.log('\n=== Otros docs "data" encontrados (no borrados, requieren revisión) ===');
    for (const { col, size, hasItems } of others) {
      console.log(`  ${col}/data — ${kb(size)} KB ${hasItems?'con items[]':''}`);
    }
  }

  console.log('\n✅ Listo. Respaldos en:', backupDir);
}
main().catch(e => console.error('ERROR:', e.message));
