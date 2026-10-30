/**
 * migrar-inventario.js
 * Migra materia y catalogoMateriales del formato array (un solo doc con items[])
 * a documentos individuales por registro ({col}/{id}).
 * El doc original materia/data queda intacto como respaldo adicional.
 * Uso: node migrar-inventario.js
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

function patch(urlPath, token, body) {
  const payload = JSON.stringify(body);
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'firestore.googleapis.com', path: urlPath, method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res({ status: re.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', rej); r.write(payload); r.end();
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
  for (const [k, v] of Object.entries(fields)) out[k] = parseValue(v);
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

function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string')  return { stringValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object')  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFsValue(val)])) } };
  return { stringValue: String(v) };
}

async function readArrayCol(colName, token) {
  const r = await get(
    `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}/data`,
    token
  );
  if (r.status !== 200) {
    console.log(`  ⚠️  ${colName}/data no encontrado (status ${r.status}) — intentando colección individual...`);
    // Ya puede estar migrado
    return null;
  }
  const doc = JSON.parse(r.body);
  return parseValue(doc.fields?.items) || [];
}

async function writeIndividualDocs(colName, items, token) {
  let ok = 0, err = 0;
  for (const item of items) {
    if (item.id == null) { err++; continue; }
    const docId = String(item.id);
    const fields = Object.fromEntries(Object.entries(item).map(([k, v]) => [k, toFsValue(v)]));
    const url = `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}/${encodeURIComponent(docId)}`;
    const r = await patch(url, token, { fields });
    if (r.status === 200) { ok++; }
    else { err++; console.log(`  ❌ Error escribiendo ${docId}: ${r.status} ${r.body.slice(0,200)}`); }
  }
  return { ok, err };
}

async function migrateCol(colName, token) {
  console.log(`\n── Migrando ${colName} ──`);
  const items = await readArrayCol(colName, token);
  if (!items) {
    console.log(`  ℹ️  Saltando ${colName} (no está en formato array o ya migrado)`);
    return;
  }
  console.log(`  ${items.length} registros leídos de ${colName}/data`);
  if (!items.length) { console.log('  (vacío, nada que migrar)'); return; }

  const { ok, err } = await writeIndividualDocs(colName, items, token);
  console.log(`  ✅ ${ok} docs escritos  ❌ ${err} errores`);

  if (err === 0) {
    console.log(`  ✅ Migración de ${colName} completa.`);
    console.log(`     El doc ${colName}/data queda intacto como respaldo en Firestore.`);
  } else {
    console.log(`  ⚠️  Hubo ${err} errores. Revisa los mensajes arriba antes de continuar.`);
  }
}

async function main() {
  const tok = await getToken();
  if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));
  const token = tok.access_token;
  console.log('✅ Token OK\n');

  await migrateCol('materia', token);
  await migrateCol('catalogoMateriales', token);

  console.log('\n✅ Migración terminada. Ahora despliega la nueva versión del código.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
