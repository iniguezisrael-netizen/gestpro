/**
 * check-clientescredito.js
 * Diagnostica el error de sync en clientesCredito
 * Uso: node check-clientescredito.js
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
    refresh_token: rt, grant_type: 'refresh_token'
  });
  if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));
  const token = tok.access_token;

  // Listar documentos de clientesCredito
  const r = await httpsGet('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/clientesCredito?pageSize=100`, token);

  if (r.status !== 200) {
    console.error('Error:', r.status, r.body.slice(0, 300)); return;
  }

  const data = JSON.parse(r.body);
  const docs = data.documents || [];
  console.log(`clientesCredito: ${docs.length} documentos en Firestore`);

  let totalBytes = 0;
  docs.forEach(d => {
    const size = JSON.stringify(d).length;
    totalBytes += size;
    if (size > 500000) { // Firestore límite: 1MB por doc
      console.log(`⚠️  Documento GRANDE: ${d.name.split('/').pop()} — ${Math.round(size/1024)}KB`);
    }
  });
  console.log(`Tamaño total estimado: ${Math.round(totalBytes/1024)}KB`);
  console.log(`Promedio por doc: ${docs.length ? Math.round(totalBytes/docs.length/1024) : 0}KB`);

  if (totalBytes < 100000) {
    console.log('\n✅ Tamaño normal — el error probablemente fue transitorio (red).');
    console.log('   Si vuelve a aparecer, podría ser un problema de permisos o cuota.');
  } else {
    console.log('\n⚠️  Colección grande — revisar si algún documento supera el límite de 1MB.');
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
