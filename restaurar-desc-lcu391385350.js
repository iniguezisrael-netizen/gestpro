/**
 * Restaura desc = "Largo 2.40m, ancho 1.80m, alto 2.05m"
 * para consignación folio LCU391385350 (id: 46418)
 * Solo hace PATCH del campo desc — no toca nada más.
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

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
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
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
    refresh_token: rt,
    grant_type: 'refresh_token'
  }).toString();

  const tokRes = await new Promise((res, rej) => {
    const r = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res(JSON.parse(Buffer.concat(c).toString()))); });
    r.on('error', rej); r.write(payload); r.end();
  });

  if (!tokRes.access_token) throw new Error('Token fallido: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log('✅ Token OK');

  // Buscar el documento por id=46418
  const qPath = `/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const qBody = {
    structuredQuery: {
      from: [{ collectionId: 'consignacion' }],
      where: { fieldFilter: { field: { fieldPath: 'id' }, op: 'EQUAL', value: { integerValue: '46418' } } },
      limit: 1
    }
  };
  const qRes = await req('POST', qPath, token, qBody);
  const results = JSON.parse(qRes.body);
  const docName = results[0]?.document?.name;
  if (!docName) { console.log('❌ Documento no encontrado'); process.exit(1); }
  console.log('📄 Documento:', docName);

  // PATCH solo el campo desc
  const patchPath = `/v1/${docName}?updateMask.fieldPaths=desc`;
  const patchBody = { fields: { desc: { stringValue: 'Largo 2.40m, ancho 1.80m, alto 2.05m' } } };
  const pRes = await req('PATCH', patchPath, token, patchBody);

  if (pRes.status === 200) {
    console.log('✅ desc restaurada: "Largo 2.40m, ancho 1.80m, alto 2.05m"');
  } else {
    console.log('❌ Error:', pRes.status, pRes.body);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
