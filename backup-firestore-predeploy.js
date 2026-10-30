/**
 * backup-firestore-predeploy.js
 * Lee TODAS las colecciones de Firestore y guarda un JSON local
 * antes de cualquier deploy. Si algo sale mal, el deploy se aborta.
 * Uso: node backup-firestore-predeploy.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

const COLLECTIONS = [
  'ventas', 'cotizaciones', 'cajas', 'cobranza', 'consignacion',
  'vehiculos', 'reparaciones', 'clientes', 'clientesCredito',
  'materia', 'productos', 'catalogoMateriales', 'bodegas',
  'entregas', 'facturas', 'herramientas', 'herramientasAsignadas',
  'herramientasHistorial', 'ordenesCompra', 'proveedores',
  'checadas', 'checadorConfig', 'entregaInsumos',
  'reportesEntrega', 'reportesProduccion', 'produccion', 'agenda'
];

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
  throw new Error('firebase-tools.json no encontrado — ejecuta: firebase login');
}

function httpreq(method, urlPath, token) {
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: { Authorization: `Bearer ${token}` }
    }, res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', reject);
    r.end();
  });
}

function fsValToJs(f) {
  if (!f) return null;
  if ('nullValue' in f) return null;
  if ('booleanValue' in f) return f.booleanValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('stringValue' in f) return f.stringValue;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(fsValToJs);
  if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, fsValToJs(v)]));
  return null;
}

async function getAccessToken() {
  const rt = readToken();
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  }).toString();
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res(JSON.parse(Buffer.concat(c).toString()))); });
    r.on('error', rej); r.write(payload); r.end();
  });
}

async function readCollection(colName, token) {
  let docs = [];
  let pageToken = null;
  do {
    let url = `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await httpreq('GET', url, token);
    if (res.status === 404) return []; // colección vacía o no existe
    if (res.status !== 200) throw new Error(`Error leyendo ${colName}: HTTP ${res.status}`);
    const data = JSON.parse(res.body);
    for (const doc of (data.documents || [])) {
      const obj = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fsValToJs(v)]));
      docs.push(obj);
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

async function main() {
  console.log('📦 Backup de Firestore antes del deploy...\n');

  const tokRes = await getAccessToken();
  if (!tokRes.access_token) throw new Error('No se pudo obtener token: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;

  const backup = { _exportadoEn: new Date().toISOString(), _fuente: 'firestore-predeploy' };
  let totalDocs = 0;

  for (const col of COLLECTIONS) {
    process.stdout.write(`  ${col}... `);
    const docs = await readCollection(col, token);
    backup[col] = docs;
    totalDocs += docs.length;
    console.log(`${docs.length} docs`);
  }

  // Guardar con timestamp
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const outDir = path.join(os.homedir(), 'Downloads', 'campers-backups');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `firestore-predeploy-${ts}.json`);

  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2), 'utf8');

  console.log(`\n✅ Backup guardado: ${outFile}`);
  console.log(`   ${COLLECTIONS.length} colecciones, ${totalDocs} documentos en total.\n`);
}

main().catch(e => {
  console.error('\n❌ ERROR en backup:', e.message);
  console.error('   Deploy abortado para proteger los datos.');
  process.exit(1); // salir con error — el deploy no continúa
});
