// Script para descargar gestpro-2026-07-08.json desde Firebase Storage
// Usa las credenciales almacenadas por firebase-tools (ya instalado)
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Rutas donde firebase-tools puede guardar credenciales
const credPaths = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
  path.join(os.homedir(), 'AppData', 'Local', 'firebase-tools', 'credentials.json'),
];

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => resolve({ status: res.statusCode, body: resp }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Leer credenciales de firebase-tools
  let creds = null;
  let credFile = null;
  for (const p of credPaths) {
    if (fs.existsSync(p)) {
      try {
        creds = JSON.parse(fs.readFileSync(p, 'utf8'));
        credFile = p;
        console.log('Credenciales encontradas en:', p);
        break;
      } catch(e) {}
    }
  }

  if (!creds) {
    console.error('No se encontraron credenciales de firebase-tools.');
    console.error('Rutas buscadas:', credPaths.join('\n'));
    process.exit(1);
  }

  // 2. Obtener refresh_token
  const refreshToken = creds.tokens && creds.tokens.refresh_token;
  if (!refreshToken) {
    console.error('No hay refresh_token en:', credFile);
    console.log('Keys disponibles:', Object.keys(creds));
    process.exit(1);
  }
  console.log('Refresh token encontrado, obteniendo access token...');

  // 3. Intercambiar refresh_token por access_token usando OAuth de Google
  // Firebase CLI usa estas credenciales de cliente (son públicas, parte del CLI open source)
  const tokenResp = await httpsPost('https://oauth2.googleapis.com/token', {
    grant_type: 'refresh_token',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8ySqWFowyESAuW-kk',
    refresh_token: refreshToken
  });

  if (tokenResp.status !== 200) {
    console.error('Error obteniendo access token:', tokenResp.body);
    process.exit(1);
  }

  const { access_token } = JSON.parse(tokenResp.body);
  console.log('Access token obtenido OK');

  // 4. Descargar el archivo de Firebase Storage via REST API
  const bucket = 'campers-la-cuesta-84ade.firebasestorage.app';
  const filePath = encodeURIComponent('backups/gestpro-2026-07-08.json');
  const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${filePath}?alt=media`;

  console.log('Descargando archivo de Storage...');
  const fileResp = await httpsGet(storageUrl, { Authorization: `Bearer ${access_token}` });

  if (fileResp.status !== 200) {
    console.error('Error descargando archivo:', fileResp.status, fileResp.body.substring(0, 200));
    process.exit(1);
  }

  // 5. Guardar el archivo
  const outPath = path.join(__dirname, 'gestpro-backup-2026-07-08.json');
  fs.writeFileSync(outPath, fileResp.body, 'utf8');
  console.log('✅ Archivo guardado en:', outPath);
  console.log('Tamaño:', fileResp.body.length, 'bytes');

  // 6. Mostrar consignación
  try {
    const data = JSON.parse(fileResp.body);
    const cons = (data.collections || data).consignacion;
    const items = Array.isArray(cons) ? cons : Object.values(cons || {});
    console.log(`\nConsignación: ${items.length} entradas`);
    items.sort((a,b)=>(a.id||0)-(b.id||0)).forEach(x =>
      console.log(`  id=${x.id} fecha=${x.fecha} producto=${(x.producto||'').substring(0,60)}`)
    );
  } catch(e) {
    console.log('(No se pudo parsear consignación:', e.message, ')');
  }
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1); });
