/**
 * corregir-2778.js
 * Corrige el pedido #2778: pone saldo=0 y estado='Pagada'.
 * Uso: node corregir-2778.js
 */
const https = require('https');
const os    = require('os');
const path  = require('path');
const fs    = require('fs');

const PROJECT   = 'campers-la-cuesta-84ade';
const FOLIO     = '2778'; // folioPedido a buscar

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

function req(method, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((res, rej) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res({ status: re.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', rej);
    if (payload) r.write(payload);
    r.end();
  });
}

function flatVal(f) {
  if (!f) return null;
  if ('stringValue'  in f) return f.stringValue;
  if ('doubleValue'  in f) return f.doubleValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('booleanValue' in f) return f.booleanValue;
  if ('nullValue'    in f) return null;
  return null;
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

  // Buscar el pedido con folioPedido = '2778' o id que contenga 2778
  // Primero intentar por documento con id = '2778'
  let docId = null, docData = null;

  // Buscar listando ventas (pageSize grande para encontrar el doc)
  let pageToken = '';
  let found = false;
  while (!found) {
    const url = `/v1/projects/${PROJECT}/databases/(default)/documents/ventas?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await req('GET', url, token);
    if (r.status !== 200) { console.log('Error listando ventas:', r.status, r.body.slice(0,200)); break; }
    const data = JSON.parse(r.body);
    const docs = data.documents || [];
    for (const doc of docs) {
      const f = doc.fields || {};
      const folio = flatVal(f.folioPedido) || '';
      const id    = flatVal(f.id);
      if (String(folio) === FOLIO || String(id) === FOLIO) {
        docId = doc.name.split('/').pop();
        docData = f;
        found = true;
        console.log(`Encontrado: doc Firestore id="${docId}"  folio="${folio}"  id_app=${id}`);
        break;
      }
    }
    if (!found && data.nextPageToken) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  if (!found || !docId) {
    console.log(`❌ No se encontró ningún pedido con folio "${FOLIO}". Revisa el folio exacto.`);
    return;
  }

  const total  = flatVal(docData.total)  ?? flatVal(docData.totalPedido) ?? 0;
  const saldo  = flatVal(docData.saldo)  ?? 0;
  const estado = flatVal(docData.estado) ?? '';
  const anticipo = flatVal(docData.anticipo) ?? 0;

  console.log(`  Total:    $${total}`);
  console.log(`  Anticipo: $${anticipo}`);
  console.log(`  Saldo:    $${saldo}  ← debe quedar en $0`);
  console.log(`  Estado:   ${estado}  ← debe quedar en 'Pagada'`);

  if (saldo === 0 && estado === 'Pagada') {
    console.log('\n✅ El pedido ya tiene saldo=0 y estado=Pagada. No se requiere cambio.');
    return;
  }

  // Patch: saldo=0, estado='Pagada', anticipo=total
  const patchUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/ventas/${docId}?` +
    'updateMask.fieldPaths=saldo&updateMask.fieldPaths=estado&updateMask.fieldPaths=anticipo';

  const patchBody = {
    fields: {
      saldo:    { doubleValue: 0 },
      estado:   { stringValue: 'Pagada' },
      anticipo: { doubleValue: total },
    }
  };

  const pr = await req('PATCH', patchUrl, token, patchBody);
  if (pr.status === 200) {
    console.log(`\n✅ Pedido #${FOLIO} corregido: saldo=$0, estado=Pagada, anticipo=$${total}`);
    console.log('   Recarga la app para ver el cambio.');
  } else {
    console.error('❌ Error:', pr.status, pr.body.slice(0, 400));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
