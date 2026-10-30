/**
 * fix-036-directo.js
 * Busca en cobranza el registro de la nota 036 y lo actualiza a $15,776
 * Uso: node fix-036-directo.js
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const NUEVO_TOTAL = 15776;

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
  throw new Error('No se encontró firebase-tools.json');
}

const BASE = 'firestore.googleapis.com';

function req(method, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE, path: urlPath, method,
      headers: { Authorization: `Bearer ${token}`, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) }
    };
    const r = https.request(opts, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function getField(f) {
  if (!f) return null;
  return f.doubleValue ?? f.integerValue ?? f.stringValue ?? f.booleanValue ?? null;
}

async function main() {
  // Token
  const rt = readToken();
  const tokRes = await new Promise((resolve, reject) => {
    const payload = new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: rt, grant_type: 'refresh_token'
    }).toString();
    const r = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, res => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(JSON.parse(Buffer.concat(c).toString()))); });
    r.on('error', reject); r.write(payload); r.end();
  });
  if (!tokRes.access_token) throw new Error('No se pudo obtener token: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log('✅ Token OK\n');

  // Leer TODOS los documentos de cobranza
  console.log('Leyendo colección cobranza...');
  const rCob = await req('GET', `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza?pageSize=500`, token);
  if (rCob.status !== 200) throw new Error('Error leyendo cobranza: ' + rCob.status + ' ' + rCob.body.slice(0,200));
  const cobDocs = JSON.parse(rCob.body).documents || [];
  console.log(`  ${cobDocs.length} registros encontrados\n`);

  // Mostrar todos para diagnóstico
  console.log('--- Todos los registros de cobranza ---');
  for (const d of cobDocs) {
    const id = d.name.split('/').pop();
    const folio = getField(d.fields?.folioPedido) || getField(d.fields?.nota) || '—';
    const total = getField(d.fields?.total);
    const cliente = getField(d.fields?.cliente) || getField(d.fields?.nombre) || '—';
    console.log(`  id=${id}  folio="${folio}"  cliente="${cliente}"  total=$${total}`);
  }
  console.log('');

  // Buscar el de la nota 036
  const target = cobDocs.find(d => {
    const folio = String(getField(d.fields?.folioPedido) || getField(d.fields?.nota) || '');
    const id = d.name.split('/').pop();
    return folio.includes('036') || id === '036';
  });

  if (!target) {
    console.error('❌ No se encontró ningún registro de cobranza con folio que contenga "036"');
    console.log('   Revisa la lista de arriba para encontrar el registro correcto.');
    return;
  }

  const docId = target.name.split('/').pop();
  const totalActual = Number(getField(target.fields?.total) || 0);
  const folio = getField(target.fields?.folioPedido) || '—';
  console.log(`Registro encontrado: id=${docId}  folio="${folio}"  total actual=$${totalActual}`);

  if (Math.abs(totalActual - NUEVO_TOTAL) < 0.01) {
    console.log('✅ El total ya es $' + NUEVO_TOTAL + '. No necesita cambio.');
    return;
  }

  // Actualizar
  const docPath = target.name.replace('https://firestore.googleapis.com/v1/', '');
  const patchUrl = `/v1/${docPath}?updateMask.fieldPaths=total`;
  console.log(`\nActualizando $${totalActual} → $${NUEVO_TOTAL}...`);
  const pr = await req('PATCH', patchUrl, token, { fields: { total: { doubleValue: NUEVO_TOTAL } } });
  if (pr.status === 200) {
    console.log(`✅ Listo. La nota 036 en cobranza ahora es $${NUEVO_TOTAL}`);
  } else {
    console.error('❌ Error al actualizar:', pr.status, pr.body.slice(0, 400));
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
