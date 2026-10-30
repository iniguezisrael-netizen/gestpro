/**
 * check-notas.js — Ver estado actual de notas 036 y 040 en Firestore
 * Uso: node check-notas.js
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

async function main() {
  const rt = readToken();
  const tok = await httpsPostForm('oauth2.googleapis.com', '/token', {
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt,
    grant_type: 'refresh_token'
  });
  if (!tok.access_token) throw new Error('Token error: ' + JSON.stringify(tok));
  const token = tok.access_token;

  // Buscar notas que contengan 036 o 040 en folioPedido
  // Firestore no tiene LIKE, así que listamos todos y filtramos
  const r = await httpsGet('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/ventas?pageSize=500`, token);

  if (r.status !== 200) {
    console.error('Error:', r.body.slice(0, 300)); return;
  }

  const data = JSON.parse(r.body);
  const docs = data.documents || [];

  const notas = docs.filter(d => {
    const folio = d.fields?.folioPedido?.stringValue || '';
    return folio.includes('036') || folio.includes('040');
  });

  if (!notas.length) {
    console.log('No encontradas notas 036/040. Mostrando primeras 5 ventas:');
    docs.slice(0, 5).forEach(d => {
      const f = d.fields || {};
      console.log(`  folio=${f.folioPedido?.stringValue||'?'} total=$${f.total?.doubleValue||f.total?.integerValue||0}`);
    });
    return;
  }

  notas.forEach(d => {
    const f = d.fields || {};
    const folio  = f.folioPedido?.stringValue || d.name.split('/').pop();
    const total  = f.total?.doubleValue ?? f.total?.integerValue ?? 0;
    const items  = (f.items?.arrayValue?.values || []).map(v => {
      const fi = v.mapValue?.fields || {};
      return `${fi.producto?.stringValue?.substring(0,20)||'?'} x${fi.cantidad?.integerValue||fi.cantidad?.doubleValue||1} @$${fi.precio?.doubleValue??fi.precio?.integerValue??0}`;
    });
    const pendiente = f.pendienteCotizar?.booleanValue || false;
    console.log(`\n📋 ${folio}`);
    console.log(`   Total en Firestore: $${total}`);
    console.log(`   Pendiente cotizar:  ${pendiente}`);
    console.log(`   Items: ${items.length ? items.join(' | ') : '(ninguno)'}`);
  });
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
