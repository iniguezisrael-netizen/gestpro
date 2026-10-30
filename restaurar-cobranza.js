/**
 * restaurar-cobranza.js
 * Restaura la colección cobranza al estado del backup 2026-08-11 15:28
 * (4 registros: Gabriel Valencia, Pepe, Rafa, Esmeralda).
 * Borra cualquier registro extra en Firestore y escribe los 4 correctos.
 * Uso: node restaurar-cobranza.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

const COBRANZA_CORRECTA = [
  {
    "id": 144349, "recNota": "", "tel": "", "total": 25020, "recFecha": "",
    "fecha": "2026-07-27", "usuario": "Administrador", "pedido": "NOTA DE VENTA-044",
    "credito": "1 semana", "recHecho": false, "encargado": "Administrador",
    "cliente": "Gabriel  Valencia", "estado": "Pendiente",
    "abonos": [{ "fecha": "2026-07-27", "nota": "Anticipo del pedido (previo a cobranza)", "monto": 22500 }]
  },
  {
    "estado": "Pendiente", "tel": "", "credito": "30 dias", "pedido": "NOTA DE VENTA-049",
    "fecha": "2026-07-30", "recFecha": "", "recHecho": false, "cliente": "Pepe",
    "abonos": [], "total": 1532.17, "encargado": "Administrador",
    "usuario": "Administrador", "id": 236311, "recNota": ""
  },
  {
    "usuario": "Secretaria", "abonos": [], "credito": "30 días", "id": 250765,
    "estado": "Pendiente", "total": 3600, "encargado": "Deysi", "tel": "348 131 4169",
    "recNota": "", "recHecho": false, "recFecha": "", "fecha": "2026-07-30",
    "cliente": "Rafa", "pedido": "NOTA DE VENTA-040"
  },
  {
    "usuario": "Secretaria", "recFecha": "2026-07-31", "estado": "Pendiente",
    "recNota": "", "id": 55217, "total": 2415.58, "abonos": [], "cliente": "Esmeralda",
    "recHecho": true, "fecha": "2026-07-17", "credito": "", "pedido": "NOTA DE VENTA-018",
    "tel": "", "encargado": "Esmeralda"
  }
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
  throw new Error('firebase-tools.json no encontrado');
}

function req(method, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) }
    }, res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFirestoreValue(val)])) } };
  return { stringValue: String(v) };
}

function toFirestoreDoc(obj) {
  return { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)])) };
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
  console.log('✅ Token OK\n');

  // Leer docs actuales en cobranza
  const listRes = await req('GET', `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza?pageSize=100`, token);
  if (listRes.status !== 200) throw new Error('Error listando cobranza: ' + listRes.status);
  const docsActuales = JSON.parse(listRes.body).documents || [];
  const idsActuales = docsActuales.map(d => d.name.split('/').pop());
  const idsCorrectos = new Set(COBRANZA_CORRECTA.map(c => String(c.id)));

  console.log(`Firestore actual: ${docsActuales.length} registros — ${idsActuales.join(', ')}`);
  console.log(`Backup correcto: ${COBRANZA_CORRECTA.length} registros — ${[...idsCorrectos].join(', ')}\n`);

  // Borrar registros extra (que no están en el backup)
  const aEliminar = idsActuales.filter(id => !idsCorrectos.has(id));
  for (const id of aEliminar) {
    const delRes = await req('DELETE', `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza/${id}`, token);
    console.log(`🗑  Eliminado registro extra id=${id} → ${delRes.status === 200 ? 'OK' : 'Error ' + delRes.status}`);
  }

  // Escribir/actualizar los 4 correctos
  for (const item of COBRANZA_CORRECTA) {
    const docId = String(item.id);
    const patchUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza/${docId}`;
    const pr = await req('PATCH', patchUrl, token, toFirestoreDoc(item));
    if (pr.status === 200) {
      console.log(`✅ Restaurado: ${item.cliente} (id=${docId})`);
    } else {
      console.error(`❌ Error en ${item.cliente}: ${pr.status} ${pr.body.slice(0, 200)}`);
    }
  }

  console.log('\n✅ Cobranza restaurada. Recarga la app con Ctrl+Shift+R.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
