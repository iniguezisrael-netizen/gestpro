/**
 * recuperar-84-julio29.js
 * Agrega el movimiento de salida de $84 del 29 de julio a la caja de secretaria (doc=187).
 * Si recuerdas el concepto, edita la línea `concepto:` antes de ejecutar.
 * Uso: node recuperar-84-julio29.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const TARGET_DOC_ID = '187';

const MOV_CONCEPTO        = 'Insumo [Limpieza] — Pinol, glicerina y coca · Tienda';
const MOV_HORA            = '17:18';
const MOV_PROVEEDOR       = 'Tienda';
const MOV_CATEGORIA       = 'Limpieza';
const MOV_ES_INSUMO       = true;

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

function toFsVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsVal) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFsVal(val)])) } };
  return { stringValue: String(v) };
}

function getVal(f) {
  if (!f) return null;
  if (f.arrayValue) return f.arrayValue.values || [];
  if (f.mapValue) return f.mapValue.fields || {};
  return f.doubleValue ?? f.integerValue ?? f.stringValue ?? f.booleanValue ?? null;
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

  // Leer la caja doc=187
  const r = await req('GET',
    `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${TARGET_DOC_ID}`,
    token);
  if (r.status !== 200) throw new Error('Error leyendo caja: ' + r.status + ' ' + r.body.slice(0,300));

  const doc = JSON.parse(r.body);
  const f = doc.fields || {};
  const usuario = getVal(f.usuario) || getVal(f.nombre) || 'secretaria';
  const movsActuales = getVal(f.movimientos) || [];

  console.log(`Caja doc=${TARGET_DOC_ID}  usuario="${usuario}"  movimientos actuales: ${movsActuales.length}`);

  // Revisar si ya existe un mov de $84 el 29 de julio para evitar duplicado
  const yaExiste = movsActuales.some(m => {
    const mf = m.mapValue?.fields || {};
    const monto = getVal(mf.monto);
    const fecha  = getVal(mf.fecha);
    const tipo   = getVal(mf.tipo);
    return tipo === 'salida' && monto == 84 && fecha === '2026-07-29';
  });

  if (yaExiste) {
    console.log('\n✅ El movimiento de $84 del 29 de julio ya existe. No se requiere cambio.');
    return;
  }

  // Movimiento a agregar
  const nuevoMov = {
    id:              sid(),
    tipo:            'salida',
    monto:           84,
    concepto:        MOV_CONCEPTO,
    hora:            MOV_HORA,
    fecha:           '2026-07-29',
    usuario,
    esInsumo:        MOV_ES_INSUMO,
    categoriaInsumo: MOV_CATEGORIA,
    proveedor:       MOV_PROVEEDOR,
  };

  console.log(`\nAgregando: salida $84  "${MOV_CONCEPTO}"  2026-07-29 ${MOV_HORA}`);

  const todosLosMovs = [...movsActuales, toFsVal(nuevoMov)];

  // Patch solo el campo movimientos
  const patchUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${TARGET_DOC_ID}?updateMask.fieldPaths=movimientos`;
  const patchBody = { fields: { movimientos: { arrayValue: { values: todosLosMovs } } } };
  const pr = await req('PATCH', patchUrl, token, patchBody);

  if (pr.status === 200) {
    console.log(`\n✅ Listo. Movimiento de $84 restaurado en la caja de ${usuario}.`);
    console.log('   Recarga la app para ver los cambios.');
  } else {
    console.error('❌ Error:', pr.status, pr.body.slice(0, 400));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
