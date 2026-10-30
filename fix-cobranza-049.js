/**
 * fix-cobranza-049.js
 * Actualiza el total en cobranza de la nota 049 a $1,532.17
 * Uso: node fix-cobranza-049.js
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const NUEVO_TOTAL = 1532.17;
const NOTA_FOLIO = '049';

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

function getVal(field) {
  if (!field) return undefined;
  return field.doubleValue ?? field.integerValue ?? field.stringValue ?? field.booleanValue ?? null;
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

  // 1. Buscar la nota 049 en ventas para obtener su cobranzaId
  console.log('Buscando nota 049 en ventas...');
  const rVentas = await httpsGet('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/ventas?pageSize=500`, token);
  if (rVentas.status !== 200) { console.error('Error ventas:', rVentas.status); return; }

  const ventas = JSON.parse(rVentas.body).documents || [];
  const nota049 = ventas.find(d => (d.fields?.folioPedido?.stringValue || '').includes(NOTA_FOLIO));

  if (!nota049) { console.error('No se encontró nota 049'); return; }
  const folio = nota049.fields?.folioPedido?.stringValue;
  const cobranzaId = nota049.fields?.cobranzaId?.integerValue || nota049.fields?.cobranzaId?.stringValue;
  const totalActual = getVal(nota049.fields?.total);
  console.log(`Nota encontrada: ${folio} | total actual: $${totalActual} | cobranzaId: ${cobranzaId}`);

  if (!cobranzaId) { console.log('Esta nota no tiene cobranzaId — no hay registro en cobranza'); return; }

  // 2. Buscar el registro en cobranza
  console.log(`\nBuscando registro en cobranza (id=${cobranzaId})...`);
  const rCob = await httpsGet('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza?pageSize=200`, token);
  if (rCob.status !== 200) { console.error('Error cobranza:', rCob.status); return; }

  const cobDocs = JSON.parse(rCob.body).documents || [];
  const cobDoc = cobDocs.find(d => {
    const docId = d.name.split('/').pop();
    return String(docId) === String(cobranzaId);
  });

  if (!cobDoc) { console.error('No se encontró el registro de cobranza con id:', cobranzaId); return; }
  const cobTotal = getVal(cobDoc.fields?.total);
  console.log(`Cobranza encontrada | total actual: $${cobTotal}`);

  if (Math.abs(cobTotal - NUEVO_TOTAL) < 0.01) {
    console.log('✅ El total en cobranza ya es correcto. No se requiere cambio.');
    return;
  }

  // 3. Actualizar el total en cobranza
  const docPath = cobDoc.name.replace('https://firestore.googleapis.com/v1/', '');
  const patchUrl = `/v1/${docPath}?updateMask.fieldPaths=total`;
  const patchBody = { fields: { total: { doubleValue: NUEVO_TOTAL } } };

  console.log(`\nActualizando total: $${cobTotal} → $${NUEVO_TOTAL}...`);
  const rPatch = await httpsPatch('firestore.googleapis.com', patchUrl, token, patchBody);
  if (rPatch.status === 200) {
    console.log(`✅ Total en cobranza actualizado a $${NUEVO_TOTAL}`);
  } else {
    console.error('Error al actualizar:', rPatch.status, rPatch.body.slice(0, 300));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
