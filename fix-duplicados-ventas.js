/**
 * fix-duplicados-ventas.js
 * Detecta y elimina ventas duplicadas (mismo folioPedido).
 * Conserva el registro con el ID más bajo (el original).
 * Uso: node fix-duplicados-ventas.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

function httpsReq(method, hostname, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: urlPath, method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function getField(f) {
  if (!f) return null;
  return f.doubleValue ?? f.integerValue ?? f.stringValue ?? f.booleanValue ?? null;
}

async function main() {
  // Token
  const rt = readToken();
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  }).toString();
  const tokRes = await new Promise((res, rej) => {
    const r = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res(JSON.parse(Buffer.concat(c).toString()))); });
    r.on('error', rej); r.write(payload); r.end();
  });
  if (!tokRes.access_token) throw new Error('Token: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log('✅ Token OK\n');

  // Leer ventas
  console.log('Leyendo ventas...');
  const r = await httpsReq('GET', 'firestore.googleapis.com',
    `/v1/projects/${PROJECT}/databases/(default)/documents/ventas?pageSize=500`, token);
  if (r.status !== 200) throw new Error('Error ventas: ' + r.status);
  const docs = JSON.parse(r.body).documents || [];
  console.log(`  ${docs.length} ventas encontradas\n`);

  // Agrupar por folioPedido
  const grupos = {};
  for (const d of docs) {
    const folio = getField(d.fields?.folioPedido) || '';
    if (!folio) continue;
    if (!grupos[folio]) grupos[folio] = [];
    grupos[folio].push(d);
  }

  // Buscar duplicados
  const duplicados = Object.entries(grupos).filter(([, arr]) => arr.length > 1);
  if (!duplicados.length) {
    console.log('✅ No se encontraron duplicados.');
    return;
  }

  console.log(`⚠️  ${duplicados.length} folio(s) duplicado(s):\n`);
  for (const [folio, arr] of duplicados) {
    // Ordenar por id numérico — conservar el menor (original)
    arr.sort((a, b) => {
      const ia = Number(getField(a.fields?.id) || 0);
      const ib = Number(getField(b.fields?.id) || 0);
      return ia - ib;
    });
    const conservar = arr[0];
    const eliminar = arr.slice(1);

    const idC = getField(conservar.fields?.id);
    console.log(`  Folio: ${folio}`);
    console.log(`    ✅ Conservar: id=${idC} (doc=${conservar.name.split('/').pop()})`);

    for (const d of eliminar) {
      const idE = getField(d.fields?.id);
      const docId = d.name.split('/').pop();
      console.log(`    🗑  Eliminar: id=${idE} (doc=${docId})`);
      const delPath = `/v1/projects/${PROJECT}/databases/(default)/documents/ventas/${docId}`;
      const dr = await httpsReq('DELETE', 'firestore.googleapis.com', delPath, token);
      if (dr.status === 200 || dr.status === 204) {
        console.log(`       ✅ Eliminado`);
      } else {
        console.error(`       ❌ Error ${dr.status}: ${dr.body.slice(0, 200)}`);
      }
    }
    console.log('');
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
