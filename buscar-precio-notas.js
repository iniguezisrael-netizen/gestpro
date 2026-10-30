/**
 * buscar-precio-notas.js
 * Busca en el historial de versiones de Firestore (_versions)
 * el precio que se asignó a las notas 036 y 040.
 * Uso: node buscar-precio-notas.js
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

function getVal(field) {
  if (!field) return undefined;
  return field.doubleValue ?? field.integerValue ?? field.stringValue ?? field.booleanValue ?? null;
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

  // Path: ventas/_history/_v  (colección de versiones)
  const basePath = `/v1/projects/${PROJECT}/databases/(default)/documents/ventas/_history/_v`;
  console.log('Buscando versiones históricas de ventas...');

  const r = await httpsGet('firestore.googleapis.com', `${basePath}?pageSize=50`, token);
  if (r.status !== 200) {
    console.error('Error listando versiones:', r.status, r.body.slice(0, 300));
    return;
  }

  const data = JSON.parse(r.body);
  const docs = data.documents || [];
  console.log(`Versiones encontradas: ${docs.length}\n`);

  // Ordenar por timestamp descendente (más reciente primero)
  docs.sort((a, b) => {
    const ta = parseInt(a.name.split('/').pop());
    const tb = parseInt(b.name.split('/').pop());
    return tb - ta;
  });

  let best036 = null, best040 = null;

  for (const doc of docs) {
    const ts = parseInt(doc.name.split('/').pop());
    const fecha = new Date(ts).toLocaleString('es-MX');
    const items = doc.fields?.items?.arrayValue?.values || [];

    const v036 = items.find(v => (v.mapValue?.fields?.folioPedido?.stringValue||'').includes('036'));
    const v040 = items.find(v => (v.mapValue?.fields?.folioPedido?.stringValue||'').includes('040'));

    if (v036 && !best036) {
      const f = v036.mapValue?.fields || {};
      const total = getVal(f.total);
      const its = (f.items?.arrayValue?.values||[]).map(i => {
        const fi = i.mapValue?.fields || {};
        return `${getVal(fi.producto)||'?'} x${getVal(fi.cantidad)||1} @$${getVal(fi.precio)||0}`;
      });
      if (total > 0 || its.length) {
        best036 = { ts: fecha, folio: getVal(f.folioPedido), total, items: its, pendiente: getVal(f.pendienteCotizar) };
      }
    }
    if (v040 && !best040) {
      const f = v040.mapValue?.fields || {};
      const total = getVal(f.total);
      const its = (f.items?.arrayValue?.values||[]).map(i => {
        const fi = i.mapValue?.fields || {};
        return `${getVal(fi.producto)||'?'} x${getVal(fi.cantidad)||1} @$${getVal(fi.precio)||0}`;
      });
      if (total > 0 || its.length) {
        best040 = { ts: fecha, folio: getVal(f.folioPedido), total, items: its, pendiente: getVal(f.pendienteCotizar) };
      }
    }
    if (best036 && best040) break;
  }

  console.log('══════════════════════════════════════');
  if (best036) {
    console.log(`✅ NOTA 036 — versión del ${best036.ts}`);
    console.log(`   Total: $${best036.total}`);
    console.log(`   Items: ${best036.items.join(' | ') || '(ninguno)'}`);
    console.log(`   Pendiente: ${best036.pendiente}`);
  } else {
    console.log('❌ NOTA 036 — nunca tuvo precio en el historial');
  }

  console.log('');
  if (best040) {
    console.log(`✅ NOTA 040 — versión del ${best040.ts}`);
    console.log(`   Total: $${best040.total}`);
    console.log(`   Items: ${best040.items.join(' | ') || '(ninguno)'}`);
    console.log(`   Pendiente: ${best040.pendiente}`);
  } else {
    console.log('❌ NOTA 040 — nunca tuvo precio en el historial');
  }

  // Si no encontramos en versiones con precio > 0, mostrar TODAS las versiones para diagnóstico
  if (!best036 || !best040) {
    console.log('\n── Todas las versiones (para diagnóstico) ──');
    for (const doc of docs.slice(0, 10)) {
      const ts = parseInt(doc.name.split('/').pop());
      const items = doc.fields?.items?.arrayValue?.values || [];
      const v036 = items.find(v => (v.mapValue?.fields?.folioPedido?.stringValue||'').includes('036'));
      const v040 = items.find(v => (v.mapValue?.fields?.folioPedido?.stringValue||'').includes('040'));
      if (v036 || v040) {
        console.log(`  ${new Date(ts).toLocaleString('es-MX')}:`);
        [v036, v040].filter(Boolean).forEach(v => {
          const f = v.mapValue?.fields || {};
          console.log(`    ${getVal(f.folioPedido)} → total=$${getVal(f.total)||0} pendiente=${getVal(f.pendienteCotizar)}`);
        });
      }
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
