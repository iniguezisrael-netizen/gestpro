/**
 * buscar-84.js
 * Busca el movimiento de $84 del 29 de julio en todas las fuentes:
 *  1. Caja activa (doc=187) — movimientos actuales
 *  2. Versiones guardadas (_history/_v)
 *  3. Colección _backups
 * Uso: node buscar-84.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const TARGET_DOC_ID = '187';

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
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', reject); r.end();
  });
}

function flatVal(f) {
  if (!f) return null;
  if ('stringValue'  in f) return f.stringValue;
  if ('doubleValue'  in f) return f.doubleValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('booleanValue' in f) return f.booleanValue;
  if ('nullValue'    in f) return null;
  if (f.arrayValue)  return (f.arrayValue.values || []);
  if (f.mapValue)    return f.mapValue.fields || {};
  return null;
}

function extractMovs(fieldsObj) {
  // acepta tanto mapValue.fields como objeto plano
  const movsField = fieldsObj.movimientos;
  if (!movsField) return [];
  const arr = movsField.arrayValue?.values || [];
  return arr.map(item => {
    const mf = item.mapValue?.fields || {};
    return Object.fromEntries(
      Object.entries(mf).map(([k, v]) => [k, flatVal(v)])
    );
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

function printMovs(movs, label) {
  const found = movs.filter(m => {
    const monto = Number(m.monto ?? m.amount ?? 0);
    return monto === 84;
  });

  const julio29 = movs.filter(m => {
    const fecha = String(m.fecha || m.date || '');
    return fecha.includes('2026-07-29') || fecha.includes('29/07') || fecha.includes('07-29');
  });

  console.log(`\n── ${label} (${movs.length} movimientos) ──`);

  if (found.length) {
    console.log('  🔍 Encontrados $84:');
    found.forEach(m => console.log('    ', JSON.stringify(m)));
  }
  if (julio29.length) {
    console.log('  🗓  Movimientos del 29 de julio:');
    julio29.forEach(m => console.log('    ', JSON.stringify(m)));
  }
  if (!found.length && !julio29.length) {
    console.log('  (sin $84 ni movimientos del 29 de julio)');
    // Muestra los últimos 5 para ver estructura
    console.log('  Últimos 5 movimientos:');
    movs.slice(-5).forEach(m => console.log('    ', JSON.stringify(m)));
  }
}

async function main() {
  const tok = await getToken();
  if (!tok.access_token) throw new Error('Token: ' + JSON.stringify(tok));
  const token = tok.access_token;
  console.log('✅ Token OK\n');

  // ── 1. Caja activa doc=187 ────────────────────────────────────────────────
  const r1 = await get(
    `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/${TARGET_DOC_ID}`,
    token);
  if (r1.status === 200) {
    const doc = JSON.parse(r1.body);
    const movs = extractMovs(doc.fields || {});
    printMovs(movs, `Caja activa doc=${TARGET_DOC_ID}`);
  } else {
    console.log('Error leyendo caja activa:', r1.status);
  }

  // ── 2. Versiones _history/_v ──────────────────────────────────────────────
  const r2 = await get(
    `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/_history/_v?pageSize=50`,
    token);
  if (r2.status === 200) {
    const vDocs = JSON.parse(r2.body).documents || [];
    for (const vDoc of vDocs) {
      const vId = vDoc.name.split('/').pop();
      const fields = vDoc.fields || {};
      // Los items de versión están en fields.items (array de cajas)
      const itemsArr = fields.items?.arrayValue?.values || [];
      for (const item of itemsArr) {
        const itemFields = item.mapValue?.fields || {};
        const docId = flatVal(itemFields.id);
        if (String(docId) !== TARGET_DOC_ID) continue;
        const movs = extractMovs(itemFields);
        printMovs(movs, `Versión ${vId} — caja ${docId}`);
      }
    }
  }

  // ── 3. _backups ───────────────────────────────────────────────────────────
  const r3 = await get(
    `/v1/projects/${PROJECT}/databases/(default)/documents/_backups?pageSize=20`,
    token);
  if (r3.status === 200) {
    const bDocs = JSON.parse(r3.body).documents || [];
    for (const bDoc of bDocs) {
      const bId = bDoc.name.split('/').pop();
      const fields = bDoc.fields || {};
      // _backups puede contener un campo "cajas" con array de cajas
      const cajasArr = fields.cajas?.arrayValue?.values || [];
      for (const item of cajasArr) {
        const itemFields = item.mapValue?.fields || {};
        const docId = flatVal(itemFields.id);
        if (String(docId) !== TARGET_DOC_ID) continue;
        const movs = extractMovs(itemFields);
        printMovs(movs, `Backup ${bId} — caja ${docId}`);
      }
    }
    if (!bDocs.length) console.log('\n(No hay backups en _backups)');
  } else {
    console.log('\n_backups no accesible:', r3.status);
  }

  console.log('\n✅ Búsqueda terminada.');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
