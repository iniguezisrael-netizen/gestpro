/**
 * sync-cobranza-totales.js
 * Compara totales de ventas vs cobranza y corrige los que no coincidan.
 * Uso: node sync-cobranza-totales.js
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

function readToken() {
  const candidates = [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return j.tokens?.refresh_token || j.refresh_token;
    }
  }
  throw new Error('firebase-tools.json no encontrado');
}

function httpsPostForm(hostname, urlPath, formData) {
  const payload = new URLSearchParams(formData).toString();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(c).toString())));
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

function httpsGet(hostname, urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: urlPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
    req.on('error', reject); req.end();
  });
}

function httpsPatch(hostname, urlPath, token, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: urlPath, method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

function getNum(field) {
  if (!field) return null;
  const v = field.doubleValue ?? field.integerValue;
  return v != null ? Number(v) : null;
}
function getStr(field) {
  return field?.stringValue ?? null;
}

async function fetchCollection(colName, token) {
  // Intenta formato array (colName/data) primero
  const r1 = await httpsGet('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}/data`, token);
  if (r1.status === 200) {
    const doc = JSON.parse(r1.body);
    const items = doc.fields?.items?.arrayValue?.values || [];
    return items.map(v => {
      const fields = v.mapValue?.fields || {};
      const obj = {};
      for (const [k, fv] of Object.entries(fields)) {
        obj[k] = fv.doubleValue ?? fv.integerValue ?? fv.stringValue ?? fv.booleanValue ?? null;
      }
      return obj;
    });
  }
  // Fallback: colección entera
  const r2 = await httpsGet('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/${colName}?pageSize=500`, token);
  if (r2.status !== 200) { console.error('Error fetchCollection', colName, r2.status); return []; }
  const docs = JSON.parse(r2.body).documents || [];
  return docs.map(d => {
    const obj = {};
    for (const [k, fv] of Object.entries(d.fields || {})) {
      obj[k] = fv.doubleValue ?? fv.integerValue ?? fv.stringValue ?? fv.booleanValue ?? null;
    }
    obj._docPath = d.name;
    return obj;
  });
}

async function patchCobranzaTotal(docPath, nuevoTotal, token) {
  // docPath puede ser el name completo de Firestore o un id relativo
  let urlPath;
  if (docPath.startsWith('/v1/') || docPath.startsWith('projects/')) {
    urlPath = '/v1/' + docPath.replace(/^\/v1\//, '');
  } else {
    urlPath = `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza/${docPath}`;
  }
  urlPath += '?updateMask.fieldPaths=total';
  const body = { fields: { total: { doubleValue: nuevoTotal } } };
  return httpsPatch('firestore.googleapis.com', urlPath, token, body);
}

async function main() {
  console.log('Obteniendo token...');
  const rt = readToken();
  const tok = await httpsPostForm('oauth2.googleapis.com', '/token', {
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  });
  if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));
  const token = tok.access_token;

  console.log('Cargando ventas...');
  const ventas = await fetchCollection('ventas', token);
  console.log(`  ${ventas.length} ventas encontradas`);

  console.log('Cargando cobranza...');
  // Cobranza es colección entera (no array/data)
  const r = await httpsGet('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza?pageSize=500`, token);
  if (r.status !== 200) { console.error('Error cobranza:', r.status, r.body.slice(0,200)); return; }
  const cobDocs = JSON.parse(r.body).documents || [];
  console.log(`  ${cobDocs.length} registros de cobranza`);

  // Mapear cobranza por id
  const cobMap = {};
  for (const d of cobDocs) {
    const docId = d.name.split('/').pop();
    const total = getNum(d.fields?.total);
    const folio = getStr(d.fields?.folioPedido) || getStr(d.fields?.nota) || docId;
    cobMap[String(docId)] = { total, folio, docPath: d.name, docId };
  }

  console.log('\n--- Comparando totales ventas vs cobranza ---\n');
  let fixes = 0, skips = 0, noLink = 0;

  for (const vt of ventas) {
    const cobranzaId = vt.cobranzaId != null ? String(vt.cobranzaId) : null;
    if (!cobranzaId) { noLink++; continue; }

    const cob = cobMap[cobranzaId];
    if (!cob) {
      console.log(`⚠️  Venta ${vt.folioPedido||vt.id}: cobranzaId=${cobranzaId} no existe en cobranza`);
      continue;
    }

    const vtTotal = vt.total != null ? Number(vt.total) : null;
    if (vtTotal == null) { skips++; continue; }

    const diff = Math.abs((cob.total || 0) - vtTotal);
    if (diff < 0.02) {
      console.log(`✅  ${vt.folioPedido||('Nota-'+vt.id)}: $${vtTotal} — OK`);
      skips++;
      continue;
    }

    console.log(`🔧  ${vt.folioPedido||('Nota-'+vt.id)}: cobranza=$${cob.total} → ventas=$${vtTotal} — CORRIGIENDO...`);
    // Patch usando el docPath completo de Firestore
    const fullPath = cob.docPath.replace('https://firestore.googleapis.com/v1/', '');
    const patchUrl = `/v1/${fullPath}?updateMask.fieldPaths=total`;
    const patchBody = { fields: { total: { doubleValue: vtTotal } } };
    const pr = await httpsPatch('firestore.googleapis.com', patchUrl, token, patchBody);
    if (pr.status === 200) {
      console.log(`   ✅  Actualizado a $${vtTotal}`);
      fixes++;
    } else {
      console.log(`   ❌  Error ${pr.status}: ${pr.body.slice(0, 200)}`);
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`  Corregidos : ${fixes}`);
  console.log(`  Ya correctos: ${skips}`);
  console.log(`  Sin cobranza: ${noLink}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
