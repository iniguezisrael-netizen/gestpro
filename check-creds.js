/**
 * Diagnóstico: muestra la estructura (sin datos sensibles) del archivo de credenciales firebase
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const CRED_PATHS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
];

for (const p of CRED_PATHS) {
  console.log('\nBuscando:', p);
  if (!fs.existsSync(p)) { console.log('  -> NO EXISTE'); continue; }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const creds = JSON.parse(raw);
    console.log('  -> ENCONTRADO. Claves de primer nivel:', Object.keys(creds));
    if (creds.tokens) {
      console.log('  -> creds.tokens claves:', Object.keys(creds.tokens));
      console.log('  -> refresh_token presente:', !!creds.tokens.refresh_token);
    }
    if (creds.user) {
      console.log('  -> creds.user claves:', Object.keys(creds.user));
    }
  } catch(e) {
    console.log('  -> Error leyendo:', e.message);
  }
}
