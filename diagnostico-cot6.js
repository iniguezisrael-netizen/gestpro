/**
 * diagnostico-cot6.js
 * Lee el estado actual de cotizaciones en Firestore y muestra la #6.
 * Uso: node diagnostico-cot6.js
 */
const https = require('https');
const os    = require('os');
const path  = require('path');
const fs    = require('fs');

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
  throw new Error('No se encontró firebase-tools.json');
}

function get(urlPath, token) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'firestore.googleapis.com', path: urlPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res({ status: re.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', rej); r.end();
  });
}

function parseValue(v) {
  if (!v) return null;
  if ('stringValue'  in v) return v.stringValue;
  if ('doubleValue'  in v) return v.doubleValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue'    in v) return null;
  if (v.arrayValue)  return (v.arrayValue.values || []).map(parseValue);
  if (v.mapValue)    return parseFirestoreDoc(v.mapValue.fields);
  return null;
}

function parseFirestoreDoc(fields) {
  if (!fields) return null;
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = parseValue(v);
  return out;
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
  const tok = await getToken();
  if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));
  const token = tok.access_token;
  console.log('✅ Token OK\n');

  // Listar todos los docs de cotizaciones
  let pageToken = '';
  let allDocs = [];

  while (true) {
    const url = `/v1/projects/${PROJECT}/databases/(default)/documents/cotizaciones?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await get(url, token);
    if (r.status !== 200) { console.log('Error:', r.status, r.body.slice(0,200)); break; }
    const data = JSON.parse(r.body);
    const docs = (data.documents || []).filter(d => {
      const docId = d.name.split('/').pop();
      return !docId.startsWith('_');
    });
    allDocs = allDocs.concat(docs);
    if (data.nextPageToken) pageToken = data.nextPageToken;
    else break;
  }

  console.log(`Total cotizaciones en Firestore: ${allDocs.length}\n`);

  // Buscar cotización con folio=6 o id=6
  const cot6 = allDocs.find(d => {
    const f = d.fields || {};
    const folio = parseValue(f.folio);
    const id    = parseValue(f.id);
    return folio === 6 || String(id) === '6';
  });

  if (!cot6) {
    console.log('❌ No se encontró cotización con folio=6.');
    console.log('\nTodas las cotizaciones (folio | id | cliente):');
    allDocs.slice(0, 20).forEach(d => {
      const f = d.fields || {};
      console.log(`  folio=${parseValue(f.folio)}  id=${parseValue(f.id)}  cliente="${parseValue(f.cliente)}"  docId=${d.name.split('/').pop()}`);
    });
    return;
  }

  const docId = cot6.name.split('/').pop();
  const parsed = parseFirestoreDoc(cot6.fields);

  console.log(`Cotización #6 encontrada (docId Firestore: "${docId}")`);
  console.log(`  id en app:      ${parsed.id}`);
  console.log(`  folio:          ${parsed.folio}`);
  console.log(`  cliente:        ${parsed.cliente}`);
  console.log(`  estado:         ${parsed.estado}`);
  console.log(`  total:          $${parsed.total}`);
  console.log(`  usuario:        ${parsed.usuario}`);
  console.log(`  fecha:          ${parsed.fecha}`);
  console.log(`  unidad:         ${parsed.unidad}`);
  console.log(`  tipo:           ${parsed.tipo}`);
  console.log(`  observaciones:  ${parsed.observaciones}`);
  console.log(`  items:`);
  (parsed.items || []).forEach((item, i) => {
    console.log(`    [${i}] ${item.producto} — cant:${item.cantidad} precio:$${item.precio}`);
  });

  // Mostrar el docId para referencia en scripts de corrección
  console.log(`\nDocumento Firestore: cotizaciones/${docId}`);
  console.log('\n✅ Diagnóstico terminado.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
