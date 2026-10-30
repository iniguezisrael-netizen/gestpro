/**
 * leer-versiones.js
 * Lee el historial de versiones de cualquier colección en Firestore.
 * Uso: node leer-versiones.js <coleccion> [--limit N]
 * Ejemplos:
 *   node leer-versiones.js consignacion
 *   node leer-versiones.js ventas
 *   node leer-versiones.js cobranza --limit 5
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const colName = process.argv[2];
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1]) || 20 : 20;

if (!colName) {
  console.error('Uso: node leer-versiones.js <coleccion> [--limit N]');
  console.error('Colecciones disponibles: ventas, consignacion, cobranza, productos, materia, cajas, cotizaciones, clientes, vehiculos...');
  process.exit(1);
}

function readToken() {
  for (const p of [
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
  ]) {
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return j.tokens?.refresh_token || j.refresh_token;
    }
  }
  throw new Error('firebase-tools.json no encontrado — ejecuta: firebase login');
}

function req(urlPath, token) {
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
    r.on('error', reject); r.end();
  });
}

function fsVal(f) {
  if (!f) return null;
  if ('nullValue'    in f) return null;
  if ('booleanValue' in f) return f.booleanValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue'  in f) return f.doubleValue;
  if ('stringValue'  in f) return f.stringValue;
  if ('arrayValue'   in f) return (f.arrayValue.values || []).map(fsVal);
  if ('mapValue'     in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k,v]) => [k, fsVal(v)]));
  return null;
}

function label(item) {
  return item.nombre || item.descripcion || item.articulo || item.cliente ||
         item.folioPedido || item.concepto || ('id:' + item.id);
}

async function main() {
  const rt = readToken();
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  }).toString();

  const tokRes = await new Promise((res, rej) => {
    const r = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res(JSON.parse(Buffer.concat(c).toString()))); });
    r.on('error', rej); r.write(payload); r.end();
  });
  if (!tokRes.access_token) throw new Error('Token fallido: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log(`✅ Token OK — leyendo historial de "${colName}" (últimas ${LIMIT} versiones)\n`);

  // Historial en: {col}/_history/_v/{ts}  (o {col}/data/_v/{ts} para array cols)
  const versUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}/_history/_v?pageSize=${LIMIT}&orderBy=ts+desc`;
  const r = await req(versUrl, token);

  if (r.status === 404) {
    // Intentar formato array (materia, catalogoMateriales)
    const versUrl2 = `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}/data/_v?pageSize=${LIMIT}&orderBy=ts+desc`;
    const r2 = await req(versUrl2, token);
    if (r2.status !== 200) {
      console.log(`No se encontró historial para "${colName}". ¿La colección existe y tiene VERSION_COLS?`);
      return;
    }
    processVersions(JSON.parse(r2.body).documents || []);
    return;
  }
  if (r.status !== 200) {
    console.log('HTTP', r.status, r.body.slice(0, 300));
    return;
  }

  processVersions(JSON.parse(r.body).documents || []);
}

function processVersions(docs) {
  console.log(`Versiones encontradas: ${docs.length}\n`);
  if (docs.length === 0) { console.log('Sin historial.'); return; }

  const resumen = {}; // id -> { label, bajaTs, archivaTs, ... }

  for (const doc of docs) {
    const fields = doc.fields || {};
    const ts     = fields.ts ? fsVal(fields.ts) : Number(doc.name.split('/').pop());
    const items  = fields.items ? fsVal(fields.items) : [];
    const fecha  = new Date(Number(ts)).toISOString().slice(0,19).replace('T', ' ');

    const notables = (items || []).filter(x => x && (x.baja || x.archivado));
    if (notables.length > 0) {
      console.log(`📌 ${fecha}`);
      notables.forEach(x => {
        const flags = [x.baja && 'baja:true', x.archivado && 'archivado:true'].filter(Boolean).join(', ');
        console.log(`   id:${x.id} | ${label(x)} | estado:${x.estado||'?'} | ${flags}`);
        if (!resumen[x.id]) resumen[x.id] = { label: label(x), ts: fecha, flags };
      });
      console.log();
    }
  }

  const ids = Object.keys(resumen);
  if (ids.length === 0) {
    console.log('ℹ️  No se encontraron registros con baja:true o archivado:true en el historial.');
  } else {
    console.log(`\n✅ Resumen — registros con flags especiales (${ids.length}):`);
    ids.forEach(id => {
      const e = resumen[id];
      console.log(`   id:${id} | ${e.label} | ${e.flags} | primera versión: ${e.ts}`);
    });

    const outFile = path.join(__dirname, `versiones-${process.argv[2]}-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ coleccion: process.argv[2], registros: resumen }, null, 2));
    console.log(`\nGuardado en: ${path.basename(outFile)}`);
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
