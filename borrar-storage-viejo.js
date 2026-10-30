/**
 * borrar-storage-viejo.js
 * Borra TODAS las fotos y backups viejos de Firebase Storage.
 * Usa el token que genera: firebase auth:print-access-token
 *
 * USO: node borrar-storage-viejo.js --listar | --borrar
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUCKET = 'campers-la-cuesta-84ade.firebasestorage.app';
const SOLO_LISTAR = process.argv.includes('--listar');
const BORRAR      = process.argv.includes('--borrar');

if (!SOLO_LISTAR && !BORRAR) {
  console.log('Uso: node borrar-storage-viejo.js --listar | --borrar');
  process.exit(1);
}

function getToken() {
  // Opción 1: leer token de token.txt si existe (generado por firebase auth:print-access-token)
  const tokenFile = path.join(__dirname, 'token.txt');
  if (fs.existsSync(tokenFile)) {
    const t = fs.readFileSync(tokenFile, 'utf8').trim();
    if (t) { console.log('Token leído desde token.txt'); return t; }
  }
  // Opción 2: llamar firebase CLI directamente
  try {
    const token = execSync('firebase auth:print-access-token', { encoding: 'utf8', cwd: __dirname }).trim();
    if (token) { console.log('Token obtenido via firebase CLI'); return token; }
  } catch (e) {
    console.log('firebase CLI no disponible:', e.message.split('\n')[0]);
  }
  throw new Error('No se pudo obtener token. Crea token.txt con el resultado de: firebase auth:print-access-token');
}

function req(method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = { hostname: u.hostname, path: u.pathname + u.search, method, headers };
    const r = https.request(options, res => {
      let data = ''; res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    r.on('error', reject); r.end();
  });
}

async function listarArchivos(token) {
  let archivos = [], pageToken = '';
  do {
    const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?maxResults=1000${page}`;
    const resp = await req('GET', url, { Authorization: `Bearer ${token}` });
    if (resp.status !== 200) throw new Error('Error listando: HTTP ' + resp.status + ' ' + resp.body.substring(0, 200));
    const data = JSON.parse(resp.body);
    if (data.items) archivos = archivos.concat(data.items);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return archivos;
}

async function borrar(token, nombre) {
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(nombre)}`;
  const resp = await req('DELETE', url, { Authorization: `Bearer ${token}` });
  return resp.status === 204 || resp.status === 200;
}

async function main() {
  const token = getToken();

  console.log('\nListando archivos en Firebase Storage...');
  const archivos = await listarArchivos(token);

  if (archivos.length === 0) {
    console.log('\n✅ Firebase Storage ya está vacío. No hay costo.');
    return;
  }

  let totalBytes = 0;
  for (const a of archivos) {
    const size = parseInt(a.size || 0);
    totalBytes += size;
    console.log(`  ${a.name}  (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log(`\nTotal: ${archivos.length} archivos, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  if (BORRAR) {
    console.log('\n🗑️  Borrando...');
    let ok = 0, err = 0;
    for (const a of archivos) {
      if (await borrar(token, a.name)) { ok++; console.log(`  ✓ ${a.name}`); }
      else { err++; console.log(`  ✗ Error: ${a.name}`); }
    }
    console.log(`\n✅ ${ok} borrados, ${err} errores.`);
    if (ok > 0) console.log('Google ya no cobrará por estos archivos.');
  } else {
    console.log('\nEjecuta con --borrar para eliminarlos.');
  }
}

main().catch(e => { console.error('\nError:', e.message); process.exit(1); });
