/**
 * restaurar-vehiculos.js
 * Restaura la colección vehiculos al estado del backup 2026-08-11 15:28
 * (5 vehículos). Borra extras y escribe los correctos.
 * Uso: node restaurar-vehiculos.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

const VEHICULOS_CORRECTOS = [
  {"recAfinacionFecha":"2026-12-06","recPolizaHecho":true,"vencimiento":"2026-07-22","id":109,"recPoliza":true,"poliza":"1340410605","nombre":"Nissan pick-up larga 2002","afinacionFecha":"2026-03-01","recAfinacion":true,"usuario":"Secretaria (Secretaria Adm.)","kilometraje":36800,"recAfinacionHecho":false},
  {"poliza":"2190086342","recPoliza":true,"id":304,"recAfinacion":false,"vencimiento":"2027-07-18","kilometraje":0,"recAfinacionFecha":"","recPolizaHecho":false,"recAfinacionHecho":false,"usuario":"Secretaria","nombre":"Mercedes Benz Sprinter 515 Wagon toldo alto","afinacionFecha":""},
  {"recAfinacion":false,"poliza":"1340426599","id":331,"recPoliza":true,"afinacionFecha":"","nombre":"Toyota Sienna 2017","usuario":"Secretaria","kilometraje":0,"vencimiento":"2026-09-28","recAfinacionHecho":false,"recPolizaHecho":false,"recAfinacionFecha":""},
  {"recAfinacionFecha":"","recPolizaHecho":false,"recAfinacionHecho":false,"vencimiento":"2026-09-29","kilometraje":0,"usuario":"Secretaria","nombre":"Toyota Corolla 2013","afinacionFecha":"","recPoliza":true,"id":332,"poliza":"1340425738","recAfinacion":false},
  {"id":335,"recPoliza":true,"poliza":"2190083369","recAfinacion":false,"recAfinacionHecho":false,"recAfinacionFecha":"","recPolizaHecho":false,"kilometraje":0,"vencimiento":"2027-05-22","nombre":"Toyota Tacoma 2025","afinacionFecha":"","usuario":"Secretaria (Secretaria Adm.)"}
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

  // Leer docs actuales
  const listRes = await req('GET', `/v1/projects/${PROJECT}/databases/(default)/documents/vehiculos?pageSize=100`, token);
  if (listRes.status !== 200) throw new Error('Error listando vehiculos: ' + listRes.status);
  const docsActuales = JSON.parse(listRes.body).documents || [];
  const idsActuales = docsActuales.map(d => d.name.split('/').pop());
  const idsCorrectos = new Set(VEHICULOS_CORRECTOS.map(v => String(v.id)));

  console.log(`Firestore actual: ${docsActuales.length} registros — ${idsActuales.join(', ')}`);
  console.log(`Backup correcto:  ${VEHICULOS_CORRECTOS.length} registros — ${[...idsCorrectos].join(', ')}\n`);

  // Borrar extras
  for (const id of idsActuales.filter(id => !idsCorrectos.has(id))) {
    const delRes = await req('DELETE', `/v1/projects/${PROJECT}/databases/(default)/documents/vehiculos/${id}`, token);
    console.log(`🗑  Eliminado extra id=${id} → ${delRes.status === 200 ? 'OK' : 'Error ' + delRes.status}`);
  }

  // Escribir los 5 correctos
  for (const item of VEHICULOS_CORRECTOS) {
    const pr = await req('PATCH', `/v1/projects/${PROJECT}/databases/(default)/documents/vehiculos/${item.id}`, token, toFirestoreDoc(item));
    if (pr.status === 200) {
      console.log(`✅ Restaurado: ${item.nombre} (id=${item.id})`);
    } else {
      console.error(`❌ Error en ${item.nombre}: ${pr.status} ${pr.body.slice(0, 200)}`);
    }
  }

  console.log('\n✅ Vehículos restaurados. Recarga la app con Ctrl+Shift+R.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
