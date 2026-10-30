/**
 * restaurar-consignacion-completo.js
 * Lee los tokens de firebase-tools.json y restaura todos los items
 * de consignacion-julio28.json a Firestore via REST API.
 *
 * Uso: node restaurar-consignacion-completo.js
 */
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const PROJECT = 'campers-la-cuesta-84ade';
const ITEMS   = require('./consignacion-julio28.json');

// ── 1. Leer credenciales de firebase-tools.json ──────────────────────────────
function readFirebaseTokens() {
  const candidates = [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log('Usando:', p);
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  throw new Error('firebase-tools.json no encontrado. Corre: firebase login');
}

// ── 2. HTTP helpers ────────────────────────────────────────────────────────────
function httpsPost(hostname, path, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers }
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpsPostForm(hostname, urlPath, formData) {
  const payload = new URLSearchParams(formData).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpsPatch(hostname, urlPath, body, token) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: urlPath, method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── 3. Obtener access_token via refresh_token ─────────────────────────────────
async function getAccessToken(tokens) {
  // Intentar con client_id/secret del propio firebase-tools.json
  const pairs = [];

  // Opción A: el JSON guarda client_id y client_secret
  if (tokens.client_id && tokens.client_secret && tokens.refresh_token) {
    pairs.push({ client_id: tokens.client_id, client_secret: tokens.client_secret, refresh_token: tokens.refresh_token });
  }
  // Opción B: dentro de tokens.tokens
  const t = tokens.tokens || {};
  if (t.client_id && t.client_secret && t.refresh_token) {
    pairs.push({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token });
  }
  // Opción C: solo refresh_token (Google's default Firebase CLI client)
  const rt = t.refresh_token || tokens.refresh_token;
  if (rt) {
    // Client ID/secret de firebase-tools (de src/api.ts en GitHub)
    pairs.push({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: rt
    });
  }

  if (pairs.length === 0) throw new Error('No se encontró refresh_token en firebase-tools.json');

  for (const p of pairs) {
    console.log(`  Intentando client_id: ${p.client_id.substring(0,30)}...`);
    const r = await httpsPostForm('oauth2.googleapis.com', '/token', {
      client_id: p.client_id,
      client_secret: p.client_secret,
      refresh_token: p.refresh_token,
      grant_type: 'refresh_token'
    });
    const json = JSON.parse(r.body);
    if (json.access_token) {
      console.log('  ✅ access_token obtenido');
      return json.access_token;
    }
    console.log(`  ❌ ${json.error}: ${json.error_description}`);
  }
  throw new Error('No se pudo obtener access_token. Intenta: firebase login --reauth');
}

// ── 4. Convertir valor JS → campo Firestore REST ──────────────────────────────
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean')  return { booleanValue: v };
  if (typeof v === 'number')   return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string')   return { stringValue: v };
  if (Array.isArray(v))        return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object')   return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}
function toFirestoreFields(obj) {
  const f = {};
  for (const [k, v] of Object.entries(obj)) f[k] = toFirestoreValue(v);
  return f;
}

// ── 5. Restaurar todos los items ──────────────────────────────────────────────
async function main() {
  console.log('=== Restaurar consignación completa ===\n');

  // Leer tokens
  const fbJson = readFirebaseTokens();

  // Obtener access_token
  console.log('Obteniendo access_token de Google...');
  const token = await getAccessToken(fbJson);

  // Escribir items
  console.log(`\nRestaurando ${ITEMS.length} items a Firestore...\n`);
  let ok = 0, errCount = 0;

  for (const item of ITEMS) {
    const docId = String(item.id);
    const urlPath = `/v1/projects/${PROJECT}/databases/(default)/documents/consignacion/${docId}`;
    const body = { fields: toFirestoreFields(item) };

    const r = await httpsPatch('firestore.googleapis.com', urlPath, body, token);
    if (r.status === 200) {
      ok++;
      process.stdout.write(`✅ id=${docId}\n`);
    } else {
      errCount++;
      let msg = '';
      try { msg = JSON.parse(r.body).error?.message || r.body.slice(0, 120); } catch { msg = r.body.slice(0, 120); }
      process.stdout.write(`❌ id=${docId} HTTP ${r.status}: ${msg}\n`);
    }
  }

  console.log(`\n──────────────────────────────────────`);
  console.log(`✅ Restaurados: ${ok}/${ITEMS.length}  ❌ Errores: ${errCount}`);

  if (ok === ITEMS.length) {
    const j28 = ITEMS.filter(i => (i.fecha||'').startsWith('2026-07-28'));
    console.log(`\n📅 Items del 28 de julio (${j28.length}):`);
    j28.forEach(i => console.log(`   id=${i.id} | ${i.producto} | estado: ${i.estado||'?'}`));

    console.log('\n──────────────────────────────────────');
    console.log('AHORA restaura las reglas de Storage:');
    console.log('  firebase deploy --only storage');
  }
}

main().catch(e => {
  console.error('\nERROR FATAL:', e.message);
  process.exit(1);
});
