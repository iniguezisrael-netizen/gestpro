/**
 * leer-backup.js
 * Lee el backup de Firebase Storage y muestra los datos de consignación
 * Ejecutar: node leer-backup.js
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const BUCKET    = 'campers-la-cuesta-84ade.firebasestorage.app';
const BACKUP    = 'backups%2F2026-07-08_16-17-45.json';
const API_KEY   = 'AIzaSyBDweepw3IwglqJw4xddDg_JYKqZGj4R1Q';
const OUT_FILE  = path.join(os.homedir(), 'Documents', 'respaldo app', 'consignacion-recuperada.json');
const LOG_FILE  = path.join(__dirname, 'debug-backup.log');

function log(...args) {
  const line = args.join(' ') + '\n';
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

// Limpiar log anterior
try { fs.writeFileSync(LOG_FILE, ''); } catch(_) {}

const CRED_PATHS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
];

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function getGoogleAccessToken() {
  // Intentar primero con access_token, luego id_token
  for (const p of CRED_PATHS) {
    if (!fs.existsSync(p)) continue;
    try {
      const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
      const at = creds?.tokens?.access_token;
      if (at) {
        log('Usando access_token de:', p);
        return { type: 'access_token', value: at };
      }
    } catch(_) {}
  }
  throw new Error('No se encontraron credenciales. Ejecuta: firebase login');
}

async function exchangeForFirebaseToken(cred) {
  // Intercambiar Google OAuth token por Firebase ID token
  const postBody = cred.type === 'id_token'
    ? `id_token=${encodeURIComponent(cred.value)}&providerId=google.com`
    : `access_token=${encodeURIComponent(cred.value)}&providerId=google.com`;

  const resp = await httpsPost(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${API_KEY}`,
    {
      requestUri: 'http://localhost',
      postBody,
      returnSecureToken: true,
      returnIdpCredential: true
    }
  );
  log('Identity Toolkit status:', resp.status);
  const parsed = JSON.parse(resp.body);
  if (!parsed.idToken) {
    // Si el access_token expiró, intentar con id_token
    if (cred.type === 'access_token') {
      log('access_token expirado, intentando con id_token...');
      for (const p of CRED_PATHS) {
        if (!fs.existsSync(p)) continue;
        try {
          const c = JSON.parse(fs.readFileSync(p, 'utf8'));
          const idt = c?.tokens?.id_token;
          if (idt) return exchangeForFirebaseToken({ type: 'id_token', value: idt });
        } catch(_) {}
      }
    }
    throw new Error('No se obtuvo Firebase idToken: ' + resp.body.slice(0, 400));
  }
  log(`Firebase ID token obtenido para: ${parsed.email}`);
  return parsed.idToken;
}

async function main() {
  log('Descargando backup 2026-07-08_16-17-45.json (reglas temporales sin auth)...');
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${BACKUP}?alt=media`;
  const resp = await httpsGet(url, {});

  if (resp.status !== 200) {
    log('ERROR:','Error HTTP:', resp.status, resp.body.toString().slice(0, 200));
    return;
  }

  const json = JSON.parse(resp.body.toString('utf8'));
  const consignacion = json.consignacion || [];

  log(`\nTotal registros de consignación en backup: ${consignacion.length}`);
  log('─'.repeat(60));

  // Mostrar especialmente el id 313 (Nissan dob cab 94/15)
  const item313 = consignacion.find(c => c.id == 313);
  if (item313) {
    log('\n>>> ITEM 313 - Nissan dob cab 94/15:');
    log(JSON.stringify(item313, null, 2));
  } else {
    log('\nItem 313 no encontrado en este backup.');
    log('Primeros 5 IDs:', consignacion.slice(0, 5).map(c => c.id).join(', '));
  }

  // Guardar todos los registros de consignación del backup
  const dir = path.dirname(OUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(consignacion, null, 2), 'utf8');
  log(`\nDatos guardados en: ${OUT_FILE}`);
}

main().catch(e => log('ERROR:','Error:', e.message));
