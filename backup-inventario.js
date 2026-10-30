/**
 * backup-inventario.js
 * Respalda materia y catalogoMateriales a archivos JSON locales ANTES de migrar.
 * Uso: node backup-inventario.js
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

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

function get(urlPath, token) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'firestore.googleapis.com', path: urlPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res({ status: re.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', rej); r.end();
  });
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

function parseFirestoreDoc(fields) {
  if (!fields) return null;
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = parseValue(v);
  }
  return out;
}

function parseValue(v) {
  if (!v) return null;
  if ('stringValue'  in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue'    in v) return null;
  if (v.arrayValue)  return (v.arrayValue.values || []).map(parseValue);
  if (v.mapValue)    return parseFirestoreDoc(v.mapValue.fields);
  return null;
}

async function backupCol(colName, token) {
  console.log(`\nRespaldando ${colName}...`);
  // Intentar formato array (materia/data y catalogoMateriales/data)
  const r = await get(
    `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}/data`,
    token
  );
  if (r.status === 200) {
    const doc = JSON.parse(r.body);
    const items = parseValue(doc.fields?.items) || [];
    const outFile = path.join(__dirname, `backup-${colName}-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(items, null, 2));
    console.log(`  ✅ ${items.length} registros guardados en ${path.basename(outFile)}`);
    return items;
  }
  // Intentar formato individual (colección entera)
  const r2 = await get(
    `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}?pageSize=500`,
    token
  );
  if (r2.status === 200) {
    const docs = JSON.parse(r2.body).documents || [];
    const items = docs
      .filter(d => !d.name.endsWith('/data') && !d.name.includes('/_'))
      .map(d => parseFirestoreDoc(d.fields))
      .filter(Boolean);
    const outFile = path.join(__dirname, `backup-${colName}-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(items, null, 2));
    console.log(`  ✅ ${items.length} registros guardados en ${path.basename(outFile)}`);
    return items;
  }
  console.log(`  ❌ Error ${r.status} al leer ${colName}`);
  return [];
}

async function main() {
  const tok = await getToken();
  if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));
  const token = tok.access_token;
  console.log('✅ Token OK');

  await backupCol('materia', token);
  await backupCol('catalogoMateriales', token);

  console.log('\n✅ Backup completo. Guarda los archivos JSON antes de continuar.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
