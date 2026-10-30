/**
 * restaurar-caja-343943.js
 * Restaura la caja chica de Secretaria (doc=343943) al estado correcto:
 *   - 20 movimientos del backup 2026-08-11 15:28
 *   - saldo = 3961
 *   - ventas = [] (vacío)
 *
 * Uso: node restaurar-caja-343943.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const TARGET_DOC_ID = '343943';

// Movimientos correctos (backup 2026-08-11 15:28 — calculan exactamente $3,961)
const MOVIMIENTOS_CORRECTOS = [
  {"fecha":"2026-08-05","hora":"09:04","ventaId":347730,"concepto":"Anticipo pedido NOTA DE VENTA-058 — Venta en mostrador","tipo":"entrada","monto":855,"id":353795},
  {"concepto":"Pago de pedido — Pepe Barba","id":369570,"tipo":"entrada","monto":48366,"hora":"11:11","usuario":"Secretaria"},
  {"monto":48366,"hora":"12:00","usuario":"Administrador","concepto":"pepe","id":344743,"tipo":"salida"},
  {"concepto":"Pago de pedido — Heriberto  Rubalcaba","monto":25000,"tipo":"entrada","id":377672,"hora":"14:49","usuario":"Secretaria"},
  {"id":396982,"concepto":"Insumo [Otro] — Raúl Ordeñador","tipo":"salida","monto":815,"usuario":"Secretaria","esInsumo":true,"proveedor":"","hora":"11:22","categoriaInsumo":"Otro"},
  {"esInsumo":true,"monto":150,"id":402147,"concepto":"Insumo [Materiales] — Envío paquete · Transportes Castellanos","tipo":"salida","categoriaInsumo":"Materiales","proveedor":"Transportes Castellanos","usuario":"Secretaria","hora":"11:22"},
  {"hora":"15:06","usuario":"Secretaria","tipo":"entrada","monto":26000,"concepto":"Pago de pedido — Enrique Velazco","id":438223},
  {"hora":"15:41","concepto":"Pago de pedido — Eduardo Solorzano","usuario":"Secretaria","tipo":"entrada","monto":2450,"id":443062},
  {"hora":"13:13","proveedor":"Saltec","monto":2025,"id":430040,"categoriaInsumo":"Materiales","esInsumo":true,"usuario":"Secretaria","concepto":"Insumo [Materiales] — Reparación de reguladores · Saltec","tipo":"salida"},
  {"hora":"15:37","usuario":"Secretaria","categoriaInsumo":"Materiales","id":442187,"monto":1606,"proveedor":"Dupont (Axalta)","tipo":"salida","concepto":"Insumo [Materiales] — Pintura · Dupont (Axalta)","esInsumo":true},
  {"id":420234,"monto":1000,"tipo":"entrada","ventaId":416799,"concepto":"Anticipo pedido NOTA DE VENTA-063 — Venta en mostrador","fecha":"2026-08-08","hora":"09:40"},
  {"id":450565,"tipo":"salida","monto":26000,"usuario":"Administrador","concepto":"caja","hora":"08:56"},
  {"hora":"11:16","esInsumo":true,"concepto":"Insumo [Otro] — Pintar camper · Gus","tipo":"salida","categoriaInsumo":"Otro","usuario":"Secretaria","proveedor":"Gus","id":452048,"monto":700},
  {"concepto":"Insumo [Materiales] — Cambio llanta Roy","tipo":"salida","proveedor":"","usuario":"Secretaria","esInsumo":true,"hora":"12:17","monto":20,"categoriaInsumo":"Materiales","id":459662},
  {"hora":"14:18","monto":6200,"tipo":"entrada","concepto":"Pago de pedido — Carlos Martín Ramírez","id":480042,"usuario":"Secretaria"},
  {"id":478395,"usuario":"Administrador","tipo":"salida","monto":6500,"concepto":"corte de caja","hora":"15:47"},
  {"usuario":"Administrador","monto":25000,"concepto":"corte de caja","hora":"15:47","id":478396,"tipo":"salida"},
  {"id":478397,"hora":"15:48","tipo":"entrada","concepto":"dinero para pagos en general","monto":2000,"usuario":"Administrador"},
  {"ventaId":479700,"hora":"09:18","concepto":"Anticipo pedido NOTA DE VENTA-065 — Venta en mostrador","monto":722,"id":483578,"fecha":"2026-08-10","tipo":"entrada"},
  {"concepto":"Cambio en monedas","hora":"09:19","tipo":"entrada","id":500955,"usuario":"Secretaria","monto":50}
];

const SALDO_CORRECTO = 3961;

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

  // Leer estado actual para confirmación
  const getUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${TARGET_DOC_ID}`;
  const getRes = await req('GET', getUrl, token);
  if (getRes.status !== 200) throw new Error('Error leyendo caja: ' + getRes.status + ' ' + getRes.body.slice(0, 200));

  const doc = JSON.parse(getRes.body);
  const f = doc.fields || {};
  const saldoActual = f.saldo?.integerValue ?? f.saldo?.doubleValue ?? '?';
  const movsActuales = f.movimientos?.arrayValue?.values?.length ?? 0;
  const ventasActuales = f.ventas?.arrayValue?.values?.length ?? 0;

  console.log('Estado actual en Firestore:');
  console.log(`  saldo = ${saldoActual}  (INCORRECTO)`);
  console.log(`  movimientos = ${movsActuales}`);
  console.log(`  ventas = ${ventasActuales}`);
  console.log('');
  console.log('Estado a restaurar:');
  console.log(`  saldo = ${SALDO_CORRECTO}  (CORRECTO)`);
  console.log(`  movimientos = ${MOVIMIENTOS_CORRECTOS.length}`);
  console.log(`  ventas = 0 (vacío)`);
  console.log('');

  // Patch: reemplazar movimientos, saldo y ventas
  const patchUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${TARGET_DOC_ID}` +
    `?updateMask.fieldPaths=movimientos&updateMask.fieldPaths=saldo&updateMask.fieldPaths=ventas`;

  const patchBody = {
    fields: {
      movimientos: toFirestoreValue(MOVIMIENTOS_CORRECTOS),
      saldo: toFirestoreValue(SALDO_CORRECTO),
      ventas: { arrayValue: {} }  // array vacío
    }
  };

  const pr = await req('PATCH', patchUrl, token, patchBody);

  if (pr.status === 200) {
    console.log(`✅ Caja restaurada correctamente.`);
    console.log(`   saldo = ${SALDO_CORRECTO}`);
    console.log(`   movimientos = ${MOVIMIENTOS_CORRECTOS.length}`);
    console.log(`   ventas = 0`);
    console.log('\n   Recarga la app para ver los cambios.');
  } else {
    console.error('❌ Error al patchear:', pr.status);
    console.error(pr.body.slice(0, 600));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
