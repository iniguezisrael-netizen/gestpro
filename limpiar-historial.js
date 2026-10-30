/**
 * limpiar-historial.js
 * Elimina todos los documentos de historial de versiones en Firestore
 * (coleccion/_history/_v/ y coleccion/data/_v/)
 * Esto libera el almacenamiento de Firestore (>1 GB) y reduce cobros de Google.
 *
 * Uso: node limpiar-historial.js
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

// Colecciones que tenían historial (las que estaban en VERSION_COLS)
const VERSION_COLS = [
  'productos','consignacion','ventas','cotizaciones','clientes','vehiculos',
  'cajas','cobranza','materia','reparaciones','bodegas','entregas','facturas',
  'produccion','catalogoMateriales','clientesCredito','herramientas',
  'herramientasHistorial','ordenesCompra'
];
// Estas usan {col}/data/_v/ en lugar de {col}/_history/_v/
const ARRAY_COLS = ['clientesCredito'];

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

function apiReq(method, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function getAccessToken() {
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
  return tokRes.access_token;
}

async function listDocs(token, colPath) {
  const url = `/v1/projects/${PROJECT}/databases/(default)/documents/${colPath}?pageSize=100`;
  const r = await apiReq('GET', url, token);
  if (r.status === 404) return [];
  if (r.status !== 200) { console.warn(`  Lista ${colPath}: HTTP ${r.status}`); return []; }
  const body = JSON.parse(r.body);
  return (body.documents || []).map(d => d.name);
}

async function deleteDoc(token, docName) {
  // docName es el nombre completo: projects/.../databases/(default)/documents/...
  const url = `/v1/${docName}`;
  const r = await apiReq('DELETE', url, token);
  return r.status === 200 || r.status === 204 || r.status === 404;
}

async function main() {
  console.log('🔑 Obteniendo token...');
  const token = await getAccessToken();
  console.log('✅ Token OK\n');

  let totalDeleted = 0;
  let totalErrors = 0;

  for (const col of VERSION_COLS) {
    const isArray = ARRAY_COLS.includes(col);
    // Ruta del historial
    const histPath = isArray
      ? `${col}/data/_v`
      : `${col}/_history/_v`;

    process.stdout.write(`📁 ${col} (${histPath}) ... `);
    const docs = await listDocs(token, histPath);

    if (docs.length === 0) {
      console.log('sin historial');
      continue;
    }

    console.log(`${docs.length} docs — eliminando...`);
    let deleted = 0;
    for (const docName of docs) {
      const ok = await deleteDoc(token, docName);
      if (ok) { deleted++; totalDeleted++; }
      else { totalErrors++; console.warn(`  ❌ Error eliminando: ${docName}`); }
    }
    console.log(`  ✅ Eliminados: ${deleted}/${docs.length}`);
  }

  console.log(`\n✅ Limpieza completa — ${totalDeleted} documentos eliminados, ${totalErrors} errores`);
  console.log('El almacenamiento de Firestore se reducirá en los próximos minutos.');
  console.log('Los respaldos siguen en R2 y en tu laptop (~Downloads/GestPro-Backups/)');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
