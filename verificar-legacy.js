const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const COLS_TO_CHECK = ['ventas','cotizaciones','cajas','cobranza','consignacion','vehiculos',
  'reparaciones','clientes','productos','bodegas','entregas','facturas','herramientas',
  'herramientasAsignadas','herramientasHistorial','ordenesCompra','proveedores',
  'checadorConfig','entregaInsumos','reportesProduccion','produccion','agenda'];

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

function getDoc(token, col, docId) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname:'firestore.googleapis.com',
      path:`/v1/projects/${PROJECT}/databases/(default)/documents/${col}/${docId}`,
      method:'GET', headers:{'Authorization':'Bearer '+token} },
      resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); });
    req.on('error',reject); req.end();
  });
}

function listAllDocs(token, col) {
  return new Promise(async (resolve, reject) => {
    let all=[], pt=null;
    do {
      await new Promise((res2, rej2) => {
        let url = `/v1/projects/${PROJECT}/databases/(default)/documents/${col}?pageSize=300`;
        if (pt) url += '&pageToken=' + encodeURIComponent(pt);
        const req = https.request({ hostname:'firestore.googleapis.com', path:url, method:'GET',
          headers:{'Authorization':'Bearer '+token} },
          resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ try{ const r=JSON.parse(d); all=all.concat(r.documents||[]); pt=r.nextPageToken; res2(); }catch(e){rej2(e);} }); });
        req.on('error',rej2); req.end();
      });
    } while(pt);
    resolve(all);
  });
}

// Extraer valor de campo Firestore
function fsVal(f) {
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('nullValue' in f) return null;
  return null;
}

async function main() {
  const token = await getAccessToken(readToken());
  console.log('Token OK. Verificando colecciones...\n');

  const safeToDelete = [];
  const hasOrphans = [];

  for (const col of COLS_TO_CHECK) {
    // Leer doc "data"
    const dataDoc = await getDoc(token, col, 'data');
    if (dataDoc.error || !dataDoc.fields) continue; // no existe

    // Extraer items del doc data
    const itemsField = dataDoc.fields?.items;
    let dataItems = [];
    if (itemsField?.arrayValue?.values) {
      dataItems = itemsField.arrayValue.values.map(v => {
        const fields = v.mapValue?.fields || {};
        return { id: fsVal(fields.id) };
      }).filter(x => x.id != null);
    }

    // Leer docs individuales (excluir "data")
    const allDocs = await listAllDocs(token, col);
    const individualIds = new Set(
      allDocs
        .filter(d => d.name.split('/').pop() !== 'data')
        .map(d => {
          const idField = d.fields?.id;
          return idField ? fsVal(idField) : null;
        })
        .filter(x => x != null)
    );

    // Comparar: ¿hay items en "data" que NO están como docs individuales?
    const orphans = dataItems.filter(item => !individualIds.has(item.id));

    if (orphans.length === 0) {
      console.log(`  ✅ ${col}/data — SEGURO borrar (${dataItems.length} items todos presentes como docs individuales)`);
      safeToDelete.push(col);
    } else {
      console.log(`  ⚠️  ${col}/data — ${orphans.length} items HUÉRFANOS no están en docs individuales (IDs: ${orphans.slice(0,5).map(x=>x.id).join(', ')}${orphans.length>5?'...':''})`);
      hasOrphans.push({ col, orphans });
    }
  }

  const outPath = path.join(os.homedir(),'Downloads','firebase-deploy','verificacion-resultado.json');
  fs.writeFileSync(outPath, JSON.stringify({ safeToDelete, hasOrphans }, null, 2));
  console.log('\n=== RESUMEN ===');
  console.log(`  Seguros para borrar: ${safeToDelete.join(', ') || 'ninguno'}`);
  console.log(`  Con huérfanos (NO borrar): ${hasOrphans.map(x=>x.col).join(', ') || 'ninguno'}`);
  console.log('\nResultado guardado en:', outPath);
}
main().catch(e => console.error('ERROR:', e.message));
