/**
 * backup-local-daemon.js
 * ─────────────────────────────────────────────────────────
 * Descarga automáticamente los respaldos de Cloudflare R2
 * a la laptop cada hora. Guarda 30 días de historial local.
 *
 * Para instalar: ejecutar setup-daemon.bat (como administrador)
 * Se registra en el Programador de Tareas de Windows y corre
 * al iniciar sesión automáticamente.
 *
 * Respaldos locales en: ~/Downloads/GestPro-Backups/
 * Log en:              ~/Downloads/GestPro-Backups/daemon.log
 */

const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

// ── Configuración ────────────────────────────────────────
const POLL_INTERVAL_MS  = 60 * 60 * 1000;   // cada hora
const KEEP_DAYS         = 30;                // días de historial local
const R2_PUBLIC_BASE    = 'https://pub-2661113d195648a2bb72e8015b05fd3f.r2.dev';
const LOCAL_DIR         = path.join(os.homedir(), 'Downloads', 'GestPro-Backups');
const LOG_FILE          = path.join(LOCAL_DIR, 'daemon.log');

// ── Utilidades ───────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString().slice(0,19).replace('T',' ')}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(_) {}
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

function pad(n) { return String(n).padStart(2, '0'); }

function dateSlug(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}

// Genera las URLs candidatas a descargar (últimas 48 horas, cada 2 horas)
function candidateUrls() {
  const urls = [];
  const now = new Date();
  for (let h = 0; h < 48; h++) {
    const d = new Date(now - h * 2 * 60 * 60 * 1000);
    const ts = `${dateSlug(d)}_${pad(d.getUTCHours())}-${pad(Math.floor(d.getUTCMinutes() / 2) * 2).padStart(2,'0')}`;
    // Probar también variantes :00 de cada hora par
    const tsHour = `${dateSlug(d)}_${pad(d.getUTCHours())}-00`;
    urls.push(`${R2_PUBLIC_BASE}/backups/gestpro-${ts}.json`);
    urls.push(`${R2_PUBLIC_BASE}/backups/gestpro-${tsHour}.json`);
  }
  return [...new Set(urls)]; // deduplicar
}

// Nombre local del archivo a partir de URL
function localName(url) {
  return url.split('/').pop(); // gestpro-2026-08-27_14-00.json
}

// Limpiar archivos locales más viejos de KEEP_DAYS
function limpiarViejos() {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOCAL_DIR).filter(f => f.startsWith('gestpro-') && f.endsWith('.json'));
    for (const f of files) {
      const fp = path.join(LOCAL_DIR, f);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fp);
        log(`🗑  Eliminado (${KEEP_DAYS}d): ${f}`);
      }
    }
  } catch(e) { log(`⚠️  Error limpiando viejos: ${e.message}`); }
}

// Descarga los respaldos más recientes que no estén ya en local
async function descargar() {
  const existentes = new Set(fs.readdirSync(LOCAL_DIR).filter(f => f.startsWith('gestpro-')));
  const urls = candidateUrls();
  let descargados = 0;

  for (const url of urls) {
    const nombre = localName(url);
    if (existentes.has(nombre)) continue; // ya lo tenemos

    try {
      const resp = await httpsGet(url);
      if (resp.status === 200) {
        // Verificar que sea JSON válido
        const text = resp.body.toString('utf8');
        JSON.parse(text); // lanza si no es JSON
        const dest = path.join(LOCAL_DIR, nombre);
        fs.writeFileSync(dest, text, 'utf8');
        log(`✅ Descargado: ${nombre} (${Math.round(text.length/1024)} KB)`);
        existentes.add(nombre);
        descargados++;
        if (descargados >= 3) break; // máximo 3 nuevos por ciclo
      }
    } catch(e) {
      // No loguear 404 (archivos que no existen aún son normales)
      if (!e.message?.includes('Unexpected') && resp?.status !== 404) {
        log(`⚠️  Error con ${nombre}: ${e.message}`);
      }
    }
  }

  if (descargados === 0) log('— Sin respaldos nuevos.');
  limpiarViejos();
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  log('🚀 Daemon de respaldo iniciado. Intervalo: 1 hora. Retención: 30 días.');
  log(`   Destino: ${LOCAL_DIR}`);
  log(`   Fuente:  ${R2_PUBLIC_BASE}/backups/`);

  // Primera descarga inmediata
  await descargar();

  // Loop cada hora
  setInterval(async () => {
    try { await descargar(); }
    catch(e) { log(`❌ Error en ciclo: ${e.message}`); }
  }, POLL_INTERVAL_MS);
}

main().catch(e => { log('❌ Error fatal: ' + e.message); process.exit(1); });
