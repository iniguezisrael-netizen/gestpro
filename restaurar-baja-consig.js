/**
 * restaurar-baja-consig.js
 * Restaura baja:true en los 4 artículos de consignación que lo tenían hoy.
 * PATCH con updateMask — solo toca el campo baja, nada más.
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const IDS_BAJA = [167080, 209287, 231, 46417];

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
  throw new Error('firebase-tools.json no encontrado');
}

function req(method, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) }
    }, res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', reject); if (payload) r.write(payload); r.end();
  });
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
  if (!tokRes.access_token) throw new Error('Token fallido');
  const token = tokRes.access_token;
  console.log('✅ Token OK\n');

  for (const id of IDS_BAJA) {
    const url = `/v1/projects/${PROJECT}/databases/(default)/documents/consignacion/${id}?updateMask.fieldPaths=baja`;
    const body = { fields: { baja: { booleanValue: true } } };
    const r = await req('PATCH', url, token, body);
    if (r.status === 200) {
      console.log(`✅ id:${id} → baja:true restaurado`);
    } else {
      console.log(`❌ id:${id} → HTTP ${r.status}: ${r.body.slice(0,150)}`);
    }
  }
  console.log('\nListo. Recarga la app para ver los cambios.');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
