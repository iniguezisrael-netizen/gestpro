/**
 * restaurar-archivadas.js
 * Restaura el flag archivado:true en las ventas que lo tenían ayer (2026-08-27).
 * Usa PATCH con updateMask — solo toca los 3 campos de archivado, nada más.
 * Uso: node restaurar-archivadas.js
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT  = 'campers-la-cuesta-84ade';
const BACKUP   = path.join(__dirname, '..', 'GestPro-Backups', 'gestpro-backup-2026-08-27.json');

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
  throw new Error('firebase-tools.json no encontrado — ejecuta: firebase login');
}

function req(method, urlPath, token, body) {
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function getToken(rt) {
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt,
    grant_type: 'refresh_token'
  }).toString();

  return new Promise((res, rej) => {
    const r = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, re => {
      const c = [];
      re.on('data', d => c.push(d));
      re.on('end', () => res(JSON.parse(Buffer.concat(c).toString())));
    });
    r.on('error', rej); r.write(payload); r.end();
  });
}

async function main() {
  const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const archivadas = (backup.ventas || []).filter(v => v.archivado);
  console.log(`Backup 2026-08-27: ${archivadas.length} ventas archivadas\n`);

  const rt = readToken();
  const tokRes = await getToken(rt);
  if (!tokRes.access_token) throw new Error('Token fallido: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log('✅ Token OK\n');

  let ok = 0, err = 0;

  for (const v of archivadas) {
    const docId = String(v.id);
    // PATCH con updateMask: solo toca archivado, archivadoPor, archivadoEn
    const mask = ['archivado', 'archivadoPor', 'archivadoEn']
      .map(f => `updateMask.fieldPaths=${f}`)
      .join('&');

    const body = {
      fields: {
        archivado:    { booleanValue: true },
        archivadoPor: { stringValue: v.archivadoPor || 'Restaurado' },
        archivadoEn:  { stringValue: v.archivadoEn  || new Date().toISOString() }
      }
    };

    const url = `/v1/projects/${PROJECT}/databases/(default)/documents/ventas/${docId}?${mask}`;
    const r = await req('PATCH', url, token, body);

    if (r.status === 200) {
      ok++;
      console.log(`  ✅ ${docId} | ${v.folioPedido || ''} | ${v.cliente}`);
    } else {
      err++;
      console.log(`  ❌ ${docId} | ${v.folioPedido || ''} | ${v.cliente} → HTTP ${r.status}: ${r.body.slice(0,120)}`);
    }
  }

  console.log(`\nListo: ${ok} restauradas, ${err} errores.`);
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1); });
