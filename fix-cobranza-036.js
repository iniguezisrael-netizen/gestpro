/**
 * fix-cobranza-036.js
 * Actualiza el total en cobranza de la nota 036 a $15,776
 * Uso: node fix-cobranza-036.js
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT    = 'campers-la-cuesta-84ade';
const NUEVO_TOTAL = 15776;
const NOTA_FOLIO  = '036';

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

function post(hostname, urlPath, form) {
  const payload = new URLSearchParams(form).toString();
  return new Promise((res, rej) => {
    const req = https.request({ hostname, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(JSON.parse(Buffer.concat(c).toString()))); });
    req.on('error', rej); req.write(payload); req.end();
  });
}

function get(hostname, urlPath, token) {
  return new Promise((res, rej) => {
    const req = https.request({ hostname, path: urlPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(c).toString() })); });
    req.on('error', rej); req.end();
  });
}

function patch(hostname, urlPath, token, body) {
  const payload = JSON.stringify(body);
  return new Promise((res, rej) => {
    const req = https.request({ hostname, path: urlPath, method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res({ status: r.statusCode, body: Buffer.concat(c).toString() })); });
    req.on('error', rej); req.write(payload); req.end();
  });
}

function val(f) {
  if (!f) return null;
  return f.doubleValue ?? f.integerValue ?? f.stringValue ?? null;
}

async function main() {
  console.log('Obteniendo token...');
  const rt = readToken();
  const tok = await post('oauth2.googleapis.com', '/token', {
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  });
  if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));
  const token = tok.access_token;

  // 1. Buscar nota 036 en ventas
  console.log('Buscando nota VENTA-036 en ventas...');
  const rV = await get('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/ventas?pageSize=500`, token);
  if (rV.status !== 200) throw new Error('Error ventas: ' + rV.status);

  const ventas = JSON.parse(rV.body).documents || [];
  console.log(`  ${ventas.length} ventas leídas`);

  const venta036 = ventas.find(d => {
    const folio = val(d.fields?.folioPedido) || '';
    return folio.includes(NOTA_FOLIO);
  });

  if (!venta036) { console.error('No se encontró la nota 036 en ventas'); return; }

  const folio       = val(venta036.fields?.folioPedido);
  const totalVenta  = Number(val(venta036.fields?.total) || 0);
  const cobranzaId  = val(venta036.fields?.cobranzaId);
  console.log(`  Nota: ${folio} | total en ventas: $${totalVenta} | cobranzaId: ${cobranzaId}`);

  if (!cobranzaId) { console.error('Esta nota no tiene cobranzaId'); return; }

  // 2. Buscar el registro en cobranza
  console.log(`\nBuscando cobranza id=${cobranzaId}...`);
  const rC = await get('firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza?pageSize=500`, token);
  if (rC.status !== 200) throw new Error('Error cobranza: ' + rC.status);

  const cobDocs = JSON.parse(rC.body).documents || [];
  console.log(`  ${cobDocs.length} registros de cobranza leídos`);

  const cobDoc = cobDocs.find(d => String(d.name.split('/').pop()) === String(cobranzaId));
  if (!cobDoc) { console.error('No se encontró el registro de cobranza con id:', cobranzaId); return; }

  const totalActual = Number(val(cobDoc.fields?.total) || 0);
  console.log(`  Cobranza encontrada | total actual: $${totalActual}`);

  if (Math.abs(totalActual - NUEVO_TOTAL) < 0.01) {
    console.log('✅ El total ya es correcto. No se requiere cambio.');
    return;
  }

  // 3. Patch
  const docPath = cobDoc.name.replace('https://firestore.googleapis.com/v1/', '');
  const patchUrl = `/v1/${docPath}?updateMask.fieldPaths=total`;
  console.log(`\nActualizando: $${totalActual} → $${NUEVO_TOTAL}...`);
  const pr = await patch('firestore.googleapis.com', patchUrl, token, {
    fields: { total: { doubleValue: NUEVO_TOTAL } }
  });
  if (pr.status === 200) {
    console.log(`✅ Total actualizado a $${NUEVO_TOTAL}`);
  } else {
    console.error('Error al actualizar:', pr.status, pr.body.slice(0, 300));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
