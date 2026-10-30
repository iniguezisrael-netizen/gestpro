/**
 * diagnostico-caja.js
 * Lee Firestore y muestra el estado actual de la caja 343943
 * y todas las ventas con cajaSesion=343943.
 * Uso: node diagnostico-caja.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const TARGET_CAJA = '343943';

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

function req(method, urlPath, token) {
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: { Authorization: `Bearer ${token}` }
    }, res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', reject);
    r.end();
  });
}

function getVal(f) {
  if (!f) return null;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  if (f.doubleValue !== undefined) return f.doubleValue;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.arrayValue) return (f.arrayValue.values || []);
  if (f.mapValue) return f.mapValue.fields || {};
  return null;
}

async function getToken() {
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

async function main() {
  const tokRes = await getToken();
  if (!tokRes.access_token) throw new Error('Token fallido: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log('✅ Token OK\n');

  // 1. Leer caja 343943
  const cajaRes = await req('GET', `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${TARGET_CAJA}`, token);
  if (cajaRes.status !== 200) throw new Error('Error leyendo caja: ' + cajaRes.status);
  const caja = JSON.parse(cajaRes.body);
  const cf = caja.fields || {};
  const saldo = getVal(cf.saldo);
  const fondo = getVal(cf.fondo);
  const movs = getVal(cf.movimientos) || [];
  const entradas = movs.filter(m => getVal((m.mapValue?.fields||{}).tipo) === 'entrada').reduce((s,m) => s + (getVal((m.mapValue?.fields||{}).monto)||0), 0);
  const salidas  = movs.filter(m => getVal((m.mapValue?.fields||{}).tipo) === 'salida').reduce((s,m)  => s + (getVal((m.mapValue?.fields||{}).monto)||0), 0);

  console.log('=== CAJA 343943 ===');
  console.log(`  saldo almacenado: $${saldo}`);
  console.log(`  fondo: $${fondo}`);
  console.log(`  movimientos: ${movs.length}`);
  console.log(`  entradas (movs): $${entradas}`);
  console.log(`  salidas  (movs): $${salidas}`);
  console.log(`  net movimientos: $${entradas - salidas}`);
  console.log(`  saldo calculado (solo movs): $${(fondo||0) + entradas - salidas}`);

  // 2. Leer ventas con cajaSesion=343943
  console.log('\n=== VENTAS cajaSesion=343943 ===');

  // Firestore REST no soporta query fácil, leer todas las ventas
  let allVentas = [];
  let pageToken = null;
  do {
    let url = `/v1/projects/${PROJECT}/databases/(default)/documents/ventas?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const vRes = await req('GET', url, token);
    if (vRes.status !== 200) { console.error('Error ventas:', vRes.status); break; }
    const vData = JSON.parse(vRes.body);
    allVentas = allVentas.concat(vData.documents || []);
    pageToken = vData.nextPageToken;
  } while (pageToken);

  console.log(`  Total ventas en Firestore: ${allVentas.length}`);

  const ventasCaja = allVentas.filter(v => {
    const cs = getVal((v.fields||{}).cajaSesion);
    return cs === 343943 || cs === '343943';
  });

  // IDs de ventas ya en movimientos (para detectar duplicados)
  const idsMovs = new Set(movs.map(m => {
    const vid = getVal((m.mapValue?.fields||{}).ventaId);
    return vid != null ? Number(vid) : null;
  }).filter(Boolean));

  let totalVentasContado = 0;
  console.log(`  Ventas con cajaSesion=343943: ${ventasCaja.length}`);
  for (const v of ventasCaja) {
    const f = v.fields || {};
    const id = getVal(f.id);
    const folio = getVal(f.folioPedido) || '';
    const esPedido = getVal(f.esPedido);
    const total = getVal(f.total) || 0;
    const anticipo = getVal(f.anticipo) || 0;
    const enMovs = idsMovs.has(Number(id));
    const aportaVentas = !enMovs ? (esPedido ? anticipo : total) : 0;
    totalVentasContado += aportaVentas;
    console.log(`    id=${id}  ${folio}  esPedido=${esPedido}  anticipo=${anticipo}  total=${total}  enMovs=${enMovs}  → aporta $${aportaVentas}`);
  }

  console.log(`\n  totalVentas que suma al saldo: $${totalVentasContado}`);
  console.log(`  SALDO CALCULADO TOTAL: $${(fondo||0) + entradas + totalVentasContado - salidas}`);
  console.log(`  SALDO ESPERADO: $3961`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
