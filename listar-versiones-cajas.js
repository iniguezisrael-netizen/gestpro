/**
 * listar-versiones-cajas.js
 * Lista todas las versiones guardadas de caja chica (_history/_v)
 * y muestra cuántos registros tiene cada una.
 * Uso: node listar-versiones-cajas.js
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

function get(urlPath, token) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'firestore.googleapis.com', path: urlPath, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res({ status: re.statusCode, body: Buffer.concat(c).toString() })); });
    r.on('error', rej); r.end();
  });
}

function val(f) {
  if (!f) return null;
  if (f.arrayValue) return (f.arrayValue.values || []).length + ' items';
  return f.doubleValue ?? f.integerValue ?? f.stringValue ?? f.booleanValue ?? null;
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

  // Leer versiones de cajas/_history/_v
  const r = await get(
    `/v1/projects/${PROJECT}/databases/(default)/documents/cajas/_history/_v?pageSize=50`,
    token
  );
  if (r.status !== 200) { console.error('Error:', r.status, r.body.slice(0,300)); return; }

  const docs = JSON.parse(r.body).documents || [];
  if (!docs.length) { console.log('No hay versiones guardadas de cajas.'); return; }

  console.log(`${docs.length} versión(es) encontrada(s) de caja chica:\n`);

  // Ordenar por timestamp (el ID del doc es el timestamp)
  docs.sort((a, b) => {
    const ta = a.name.split('/').pop();
    const tb = b.name.split('/').pop();
    return ta.localeCompare(tb);
  });

  for (const d of docs) {
    const versionId = d.name.split('/').pop();
    const items = d.fields?.items?.arrayValue?.values || [];
    const ts = d.fields?.savedAt?.stringValue || versionId;
    console.log(`  version="${versionId}"  registros=${items.length}  guardado="${ts}"`);

    // Mostrar los últimos 5 registros de cada versión para identificar cuál tiene los pagos
    const ultimos = items.slice(-5);
    for (const it of ultimos) {
      const f = it.mapValue?.fields || {};
      const tipo = f.tipo?.stringValue || '?';
      const monto = f.monto?.doubleValue ?? f.monto?.integerValue ?? '?';
      const desc = f.descripcion?.stringValue || f.concepto?.stringValue || '';
      const fecha = f.fecha?.stringValue || '';
      const hora = f.hora?.stringValue || '';
      console.log(`      ${tipo} $${monto}  ${desc.slice(0,40)}  ${fecha} ${hora}`);
    }
    console.log('');
  }

  console.log('\nPara restaurar una versión ejecuta:');
  console.log('  node restaurar-cajas.js <version-id>');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
