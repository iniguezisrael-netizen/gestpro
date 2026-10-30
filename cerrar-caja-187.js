/**
 * cerrar-caja-187.js
 * Marca la caja antigua (id=187, abierta el 20 Jun) como cerrada
 * para que el app use la caja 343943 (agosto 4) con saldo $3,961.
 * Uso: node cerrar-caja-187.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const TARGET_DOC_ID = '187';

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

  // Patch: marcar cerrada=true en caja 187
  const patchUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${TARGET_DOC_ID}?updateMask.fieldPaths=cerrada`;
  const patchBody = { fields: { cerrada: { booleanValue: true } } };

  const pr = await req('PATCH', patchUrl, token, patchBody);

  if (pr.status === 200) {
    console.log('✅ Caja 187 marcada como cerrada.');
    console.log('   El app mostrará ahora la caja 343943 (saldo $3,961).');
    console.log('   Recarga la app con Ctrl+Shift+R.');
  } else {
    console.error('❌ Error:', pr.status, pr.body.slice(0, 400));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
