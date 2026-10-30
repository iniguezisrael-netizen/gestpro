/**
 * fix-iva-pedido-051.js
 * Corrige ivaMode y el campo iva de la NOTA DE VENTA-051 (Samuel) a NETO.
 * Uso: node fix-iva-pedido-051.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const FOLIO = 'NOTA DE VENTA-051';

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

function getField(f) {
  if (!f) return null;
  return f.doubleValue ?? f.integerValue ?? f.stringValue ?? f.booleanValue ?? null;
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

  // Leer ventas
  const r = await req('GET', `/v1/projects/${PROJECT}/databases/(default)/documents/ventas?pageSize=500`, token);
  if (r.status !== 200) throw new Error('Error ventas: ' + r.status);
  const docs = JSON.parse(r.body).documents || [];
  console.log(`${docs.length} ventas leídas`);

  const target = docs.find(d => {
    const folio = getField(d.fields?.folioPedido) || '';
    return folio.trim() === FOLIO;
  });

  if (!target) { console.error(`❌ No se encontró: ${FOLIO}`); return; }

  const docId = target.name.split('/').pop();
  const ivaActual = getField(target.fields?.ivaMode) || getField(target.fields?.iva);
  console.log(`Pedido encontrado: doc=${docId}  ivaMode="${ivaActual}"`);

  // Patch ivaMode='neto', iva=false
  const patchUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/ventas/${docId}?updateMask.fieldPaths=ivaMode&updateMask.fieldPaths=iva`;
  const body = { fields: { ivaMode: { stringValue: 'neto' }, iva: { booleanValue: false } } };
  const pr = await req('PATCH', patchUrl, token, body);
  if (pr.status === 200) {
    console.log(`✅ ${FOLIO} actualizado a NETO`);
  } else {
    console.error('❌ Error:', pr.status, pr.body.slice(0, 300));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
