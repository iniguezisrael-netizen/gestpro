/**
 * backup-fotos-daemon.js
 * ─────────────────────────────────────────────────────────
 * Descarga todas las fotos de ventas, cotizaciones,
 * consignacion y productos desde Cloudflare R2 a la laptop.
 * Solo descarga fotos nuevas (si ya existe el archivo, la salta).
 *
 * Corre cada 2 horas. Se registra junto con el daemon de respaldo.
 * Fotos locales en: ~/Downloads/GestPro-Fotos/
 * Log en:          ~/Downloads/GestPro-Fotos/fotos-daemon.log
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const url   = require('url');

// ── Configuración ────────────────────────────────────────
const POLL_INTERVAL_MS = 2 * 60 * 60 * 1000; // cada 2 horas
const BACKUP_DIR  = path.join(os.homedir(), 'Downloads', 'GestPro-Backups');
const FOTOS_DIR   = path.join(os.homedir(), 'Downloads', 'GestPro-Fotos');
const LOG_FILE    = path.join(FOTOS_DIR, 'fotos-daemon.log');

// Colecciones y campos que pueden tener fotos
const FOTO_CAMPOS = [
  { col: 'ventas',       campo: 'fotos' },
  { col: 'cotizaciones', campo: 'fotos' },
  { col: 'consignacion', campo: 'fotos' },
  { col: 'productos',    campo: 'fotos' },
  { col: 'reportesEntrega',    campo: 'fotos' },
  { col: 'reportesProduccion', campo: 'fotos' },
];

// ── Utilidades ───────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString().slice(0,19).replace('T',' ')}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(_) {}
}

function descargarArchivo(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(fileUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(fileUrl, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return descargarArchivo(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        fs.writeFileSync(destPath, Buffer.concat(chunks));
        resolve(chunks.reduce((s, c) => s + c.length, 0));
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Nombre de archivo seguro desde URL
function nombreArchivo(fotoUrl) {
  try {
    const p = new url.URL(fotoUrl).pathname;
    // Usar los últimos 2 segmentos del path para evitar colisiones: carpeta_nombre.ext
    const partes = p.split('/').filter(Boolean);
    const nombre = partes.slice(-2).join('_').replace(/[^a-zA-Z0-9._-]/g, '_');
    return nombre || `foto_${Date.now()}`;
  } catch { return `foto_${Date.now()}`; }
}

// Leer el backup más reciente disponible
function leerBackupMasReciente() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const archivos = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('gestpro-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!archivos.length) return null;
  const ruta = path.join(BACKUP_DIR, archivos[0]);
  log(`Usando backup: ${archivos[0]}`);
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

// Extraer todas las URLs de fotos del backup
function extraerUrls(backup) {
  const urls = new Set();
  for (const { col, campo } of FOTO_CAMPOS) {
    const registros = backup[col] || (backup.collections && backup.collections[col]) || [];
    for (const rec of registros) {
      const fotos = rec[campo];
      if (!Array.isArray(fotos)) continue;
      for (const f of fotos) {
        if (typeof f === 'string' && f.startsWith('http') && !f.startsWith('data:')) {
          urls.add(f);
        }
      }
    }
  }
  return [...urls];
}

// Ciclo principal de descarga
async function descargarFotos() {
  if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });

  const backup = leerBackupMasReciente();
  if (!backup) { log('⚠️  No hay backup local aún. Esperar al daemon de respaldo.'); return; }

  const urls = extraerUrls(backup);
  log(`Fotos en backup: ${urls.length} únicas`);

  const existentes = new Set(fs.readdirSync(FOTOS_DIR));
  let nuevas = 0, errores = 0, saltadas = 0;

  for (const fotoUrl of urls) {
    const nombre = nombreArchivo(fotoUrl);
    if (existentes.has(nombre)) { saltadas++; continue; }

    try {
      const bytes = await descargarArchivo(fotoUrl, path.join(FOTOS_DIR, nombre));
      existentes.add(nombre);
      nuevas++;
      log(`  ✅ ${nombre} (${Math.round(bytes/1024)} KB)`);
    } catch(e) {
      errores++;
      log(`  ❌ ${nombre}: ${e.message}`);
    }
  }

  log(`Ciclo terminado — nuevas: ${nuevas}, saltadas: ${saltadas}, errores: ${errores}`);
  log(`Carpeta local: ${FOTOS_DIR} (${fs.readdirSync(FOTOS_DIR).filter(f=>!f.endsWith('.log')).length} fotos)`);
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(FOTOS_DIR)) fs.mkdirSync(FOTOS_DIR, { recursive: true });
  log('🖼  Daemon de fotos iniciado. Intervalo: 2 horas.');
  log(`   Destino: ${FOTOS_DIR}`);

  await descargarFotos();
  setInterval(async () => {
    try { await descargarFotos(); }
    catch(e) { log(`❌ Error en ciclo: ${e.message}`); }
  }, POLL_INTERVAL_MS);
}

main().catch(e => { log('❌ Error fatal: ' + e.message); process.exit(1); });
