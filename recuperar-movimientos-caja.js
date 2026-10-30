/**
 * recuperar-movimientos-caja.js
 * Recupera los movimientos perdidos del 31/07/2026 en caja chica de la secretaria.
 * Movimientos a restaurar (tomados de captura de pantalla):
 *   - 12:56  Salida  $50    Insumo [Otro] — Minerales · Minerales Guiza
 *   - 13:04  Salida  $268   Insumo [Materiales] — Materiales varios · Uniferre
 *   - 13:04  Salida  $529   Insumo [Otro] — Medicamento veterinario · HP Agropecuaria
 *   - 13:12  Entrada $17300 Pago de pedido — Juan José Ramírez
 *   - 13:13  Salida  $17300 Corte del día (Autorizado por: admin)
 * Uso: node recuperar-movimientos-caja.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const FECHA = '2026-07-31';

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

function getFieldVal(f) {
  if (!f) return null;
  if (f.arrayValue) return f.arrayValue.values || [];
  if (f.mapValue) return f.mapValue.fields || {};
  return f.doubleValue ?? f.integerValue ?? f.stringValue ?? f.booleanValue ?? null;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFirestoreValue(val)])) } };
  return { stringValue: String(v) };
}

function sid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
  if (!tokRes.access_token) throw new Error('Token: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log('✅ Token OK\n');

  // Leer todas las cajas
  const r = await req('GET', `/v1/projects/${PROJECT}/databases/(default)/documents/cajas?pageSize=100`, token);
  if (r.status !== 200) throw new Error('Error leyendo cajas: ' + r.status);
  const docs = JSON.parse(r.body).documents || [];
  console.log(`${docs.length} cajas encontradas\n`);

  // Mostrar todas las cajas para identificar la activa de secretaria
  for (const d of docs) {
    const f = d.fields || {};
    const docId = d.name.split('/').pop();
    const usuario = getFieldVal(f.usuario) || getFieldVal(f.nombre) || '?';
    const abierta = getFieldVal(f.abierta);
    const movs = getFieldVal(f.movimientos) || [];
    console.log(`  doc=${docId}  usuario="${usuario}"  abierta=${abierta}  movimientos=${movs.length}`);
  }

  console.log('');

  // Caja activa de secretaria: doc=187 (identificada por tener más movimientos)
  const TARGET_DOC_ID = '187';
  const cajaDoc = docs.find(d => d.name.split('/').pop() === TARGET_DOC_ID);

  if (!cajaDoc) {
    console.error('❌ No se encontró la caja doc=' + TARGET_DOC_ID);
    return;
  }

  const docId = cajaDoc.name.split('/').pop();
  const f = cajaDoc.fields || {};
  const usuario = getFieldVal(f.usuario) || '?';
  const movsActuales = (getFieldVal(f.movimientos) || []).map(m => {
    const mf = m.mapValue?.fields || {};
    return {
      tipo: getFieldVal(mf.tipo),
      concepto: getFieldVal(mf.concepto),
      monto: getFieldVal(mf.monto),
      hora: getFieldVal(mf.hora),
    };
  });

  console.log(`Caja encontrada: doc=${docId}  usuario="${usuario}"  movimientos actuales=${movsActuales.length}`);
  console.log('Movimientos actuales:');
  movsActuales.forEach(m => console.log(`   ${m.tipo}  $${m.monto}  ${m.concepto}  ${m.hora}`));

  // Movimientos a restaurar (del 31/07/2026)
  const nuevosMovs = [
    { id: sid(), tipo: 'salida',  concepto: 'Insumo [Otro] — Minerales · Minerales Guiza',               monto: 50,    hora: '12:56', usuario, esInsumo: true, categoriaInsumo: 'Otro',       proveedor: 'Minerales Guiza',  fecha: FECHA },
    { id: sid(), tipo: 'salida',  concepto: 'Insumo [Materiales] — Materiales varios · Uniferre',        monto: 268,   hora: '13:04', usuario, esInsumo: true, categoriaInsumo: 'Materiales',  proveedor: 'Uniferre',         fecha: FECHA },
    { id: sid(), tipo: 'salida',  concepto: 'Insumo [Otro] — Medicamento veterinario · HP Agropecuaria', monto: 529,   hora: '13:04', usuario, esInsumo: true, categoriaInsumo: 'Otro',       proveedor: 'HP Agropecuaria',  fecha: FECHA },
    { id: sid(), tipo: 'entrada', concepto: 'Pago de pedido — Juan José Ramírez',                        monto: 17300, hora: '13:12', usuario, fecha: FECHA },
    { id: sid(), tipo: 'salida',  concepto: 'Corte del día',                                             monto: 17300, hora: '13:13', usuario, autorizadoPor: 'admin', fecha: FECHA },
  ];

  // Verificar que no estén ya agregados (evitar duplicados)
  const conceptosActuales = new Set(movsActuales.map(m => `${m.concepto}|${m.monto}`));
  const aAgregar = nuevosMovs.filter(m => !conceptosActuales.has(`${m.concepto}|${m.monto}`));

  if (!aAgregar.length) {
    console.log('\n✅ Todos los movimientos ya existen. No se requiere cambio.');
    return;
  }

  console.log(`\nAgregando ${aAgregar.length} movimiento(s):`);
  aAgregar.forEach(m => console.log(`   ${m.tipo}  $${m.monto}  ${m.concepto}`));

  // Combinar con los existentes
  const todosLosMovs = [...(getFieldVal(f.movimientos) || [])];
  for (const m of aAgregar) {
    todosLosMovs.push(toFirestoreValue(m));
  }

  // Patch solo el campo movimientos
  const patchUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${docId}?updateMask.fieldPaths=movimientos`;
  const patchBody = { fields: { movimientos: { arrayValue: { values: todosLosMovs } } } };
  const pr = await req('PATCH', patchUrl, token, patchBody);

  if (pr.status === 200) {
    console.log(`\n✅ Listo. ${aAgregar.length} movimiento(s) restaurado(s) en la caja de ${usuario}.`);
    console.log('   Recarga la app para ver los cambios.');
  } else {
    console.error('❌ Error:', pr.status, pr.body.slice(0, 400));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
