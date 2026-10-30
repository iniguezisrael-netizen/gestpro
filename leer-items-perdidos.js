/**
 * leer-items-perdidos.js
 * Lee backups de Firebase Storage buscando items de consignación con ID > 3388
 * Usa refresh_token para obtener un access_token válido automáticamente
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const BUCKET   = 'campers-la-cuesta-84ade.firebasestorage.app';
const API_KEY  = 'AIzaSyBDweepw3IwglqJw4xddDg_JYKqZGj4R1Q';
const LOG_FILE = path.join(__dirname, 'items-perdidos.log');
const OUT_FILE = path.join(__dirname, 'items-perdidos.json');

function log(...args) {
  const line = args.join(' ') + '\n';
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}
try { fs.writeFileSync(LOG_FILE, ''); } catch(_) {}

const CRED_PATHS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
];

function httpsPost(hostname, path_, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const isJson = typeof body !== 'string';
    const req = https.request({
      hostname, path: path_, method: 'POST',
      headers: {
        'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

function getCreds() {
  for (const p of CRED_PATHS) {
    if (!fs.existsSync(p)) continue;
    try {
      const c = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (c?.tokens) return { path: p, tokens: c.tokens };
    } catch(_) {}
  }
  throw new Error('No se encontraron credenciales. Ejecuta: firebase login');
}

async function getFreshAccessToken(tokens) {
  // Intentar usar el access_token existente primero
  if (tokens.access_token) {
    // Verificar si sigue válido con una llamada de prueba
    try {
      const test = await httpsGet(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${tokens.access_token}`
      );
      if (test.status === 200) {
        log('access_token existente sigue válido');
        return tokens.access_token;
      }
    } catch(_) {}
  }

  // Refrescar con refresh_token
  if (!tokens.refresh_token) throw new Error('No hay refresh_token');
  log('Refrescando access_token con refresh_token...');
  const resp = await httpsPost(
    'oauth2.googleapis.com',
    '/token',
    `client_id=563584335869-fguluspp7efknar3tk2o3oh5qqn2glqt.apps.googleusercontent.com&client_secret=j9iVZfS8yvUs7MFmYr_07yjq&grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refresh_token)}`
  );
  if (resp.status !== 200) throw new Error('Error refrescando token: ' + resp.body.slice(0, 200));
  const data = JSON.parse(resp.body);
  log('access_token refrescado OK');
  return data.access_token;
}

async function getFirebaseIdToken(accessToken) {
  log('Obteniendo Firebase ID token...');
  const resp = await httpsPost(
    'identitytoolkit.googleapis.com',
    `/v1/accounts:signInWithIdp?key=${API_KEY}`,
    {
      requestUri: 'http://localhost',
      postBody: `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`,
      returnSecureToken: true,
      returnIdpCredential: true
    }
  );
  const data = JSON.parse(resp.body);
  if (!data.idToken) throw new Error('No se obtuvo idToken: ' + resp.body.slice(0, 300));
  log('Firebase ID token OK para:', data.email);
  return data.idToken;
}

async function downloadBackup(filename, idToken) {
  const path_ = encodeURIComponent('backups/' + filename);
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${path_}?alt=media`;
  const resp = await httpsGet(url, { Authorization: 'Firebase ' + idToken });
  if (resp.status !== 200) {
    log('Error descargando', filename, ':', resp.status, resp.body.toString().slice(0, 100));
    return null;
  }
  return JSON.parse(resp.body.toString('utf8'));
}

async function main() {
  const { tokens } = getCreds();
  const accessToken = await getFreshAccessToken(tokens);
  const idToken = await getFirebaseIdToken(accessToken);

  // Backups de hoy con tamaño mayor (tienen items extra)
  // Los identificados con tamaño 1266587 bytes van de 14:49 a 17:36
  const candidatos = [
    '2026-07-09_14-49-19.json',
    '2026-07-09_14-50-15.json',
    '2026-07-09_14-51-15.json',
  ];

  log('\nBuscando items con ID > 3388 en backups de hoy...');

  let itemsPerdidos = [];

  for (const archivo of candidatos) {
    log(`\nLeyendo ${archivo}...`);
    const data = await downloadBackup(archivo, idToken);
    if (!data) continue;

    const consig = data.consignacion || [];
    const extras = consig.filter(i => i.id > 3388);
    log(`  Total items: ${consig.length} | Items > 3388: ${extras.length}`);

    if (extras.length > 0) {
      log('  Items encontrados:');
      extras.forEach(i => log(`    id=${i.id} | ${i.producto} | folio=${i.folio}`));
      itemsPerdidos = extras;
      break;
    }
  }

  if (itemsPerdidos.length === 0) {
    log('\n⚠ No se encontraron items > 3388 en los primeros 3 candidatos.');
    log('Probando más archivos...');

    // Intentar con el primero del rango completo
    const masArchivos = [
      '2026-07-09_14-28-16.json',  // primer archivo con tamaño diferente (1261681)
      '2026-07-09_14-29-09.json',
      '2026-07-09_14-35-16.json',
    ];

    for (const archivo of masArchivos) {
      log(`\nLeyendo ${archivo}...`);
      const data = await downloadBackup(archivo, idToken);
      if (!data) continue;

      const consig = data.consignacion || [];
      const sorted = [...consig].sort((a,b) => (b.id||0) - (a.id||0));
      log(`  Total items: ${consig.length} | Max ID: ${sorted[0]?.id}`);
      const extras = consig.filter(i => i.id > 3388);
      if (extras.length > 0) {
        log('  ¡Items encontrados!');
        extras.forEach(i => log(`    id=${i.id} | ${i.producto} | folio=${i.folio}`));
        itemsPerdidos = extras;
        break;
      }
    }
  }

  if (itemsPerdidos.length > 0) {
    fs.writeFileSync(OUT_FILE, JSON.stringify(itemsPerdidos, null, 2), 'utf8');
    log(`\n✓ Items guardados en: ${OUT_FILE}`);
    log(`✓ Total recuperados: ${itemsPerdidos.length}`);
  } else {
    log('\n✗ No se encontraron items perdidos en los backups.');
    log('  Posiblemente nunca llegaron a Firestore antes de ser sobreescritos.');
  }
}

main().catch(e => log('ERROR:', e.message));
