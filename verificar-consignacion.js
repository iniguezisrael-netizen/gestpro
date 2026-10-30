/**
 * verificar-consignacion.js
 * Muestra cuántos items hay en Firestore y los últimos 8 agregados
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const PROJECT  = 'campers-la-cuesta-84ade';
const LOG_FILE = path.join(__dirname, 'verificar-output.log');

function log(...args) {
  const line = args.join(' ') + '\n';
  process.stdout.write(line);
  try { fs.appendFileSync(LOG_FILE, line); } catch(_) {}
}
try { fs.writeFileSync(LOG_FILE, ''); } catch(_) {}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

function getAccessToken() {
  const paths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
  ];
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
    const at = creds?.tokens?.access_token;
    if (at) return at;
  }
  throw new Error('No access_token. Ejecuta: firebase login');
}

function fromFV(fv) {
  if (fv.integerValue !== undefined) return Number(fv.integerValue);
  if (fv.doubleValue !== undefined) return fv.doubleValue;
  if (fv.stringValue !== undefined) return fv.stringValue;
  if (fv.booleanValue !== undefined) return fv.booleanValue;
  if (fv.nullValue !== undefined) return null;
  if (fv.arrayValue) return (fv.arrayValue.values || []).map(fromFV);
  if (fv.mapValue) {
    const o = {};
    for (const [k,v] of Object.entries(fv.mapValue.fields || {})) o[k] = fromFV(v);
    return o;
  }
  return null;
}

async function main() {
  const token = getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/consignacion/data`;
  const resp = await httpsGet(url, { Authorization: `Bearer ${token}` });

  if (resp.status !== 200) {
    log('ERROR:', resp.body.slice(0, 300));
    return;
  }

  const doc = JSON.parse(resp.body);
  const items = fromFV(doc.fields.items);
  log(`\nTotal items en Firestore: ${items.length}`);

  // Ordenar por id descendente (los más recientes tienen id mayor)
  const sorted = [...items].sort((a, b) => (b.id || 0) - (a.id || 0));
  log('\n--- Últimos 8 items agregados (por ID mayor) ---');
  sorted.slice(0, 8).forEach(i => {
    log(`  id=${i.id}  folio=${i.folio}  producto="${i.producto}"  estado=${i.estado}`);
  });
}

main().catch(e => log('ERROR:', e.message));
