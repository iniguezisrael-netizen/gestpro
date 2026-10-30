/**
 * deploy-cloudflare-pages.js
 * Crea el proyecto en Cloudflare Pages y sube el contenido de public/
 *
 * Uso: node deploy-cloudflare-pages.js
 */
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const CF_TOKEN      = 'cfut_jkD2WUQjMKEujhAs2D2vJaro9l1ACZUdDZNDmUFN764c1b65';
const ACCOUNT_ID    = '9cd3aaf5646f228ec0f34092f74fc6b3';
const PROJECT_NAME  = 'campers-la-cuesta';
const PUBLIC_DIR    = path.join(__dirname, 'public');

// ── Helpers ───────────────────────────────────────────────────────────────────

function cfApi(method, urlPath, body, contentType) {
  const payload = body
    ? (typeof body === 'string' ? body : JSON.stringify(body))
    : null;
  const headers = {
    Authorization: `Bearer ${CF_TOKEN}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(payload && !contentType ? { 'Content-Type': 'application/json' } : {}),
    ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
  };
  return new Promise((resolve, reject) => {
    const r = https.request(
      { hostname: 'api.cloudflare.com', path: urlPath, method, headers },
      res => {
        const c = [];
        res.on('data', d => c.push(d));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }); }
          catch { resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }); }
        });
      }
    );
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readDirRecursive(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...readDirRecursive(full, base));
    } else {
      files.push(full);
    }
  }
  return files;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Cloudflare Pages Deploy — ${PROJECT_NAME}\n`);

  // 1. Crear proyecto (si no existe)
  console.log('1️⃣  Verificando/creando proyecto...');
  const createRes = await cfApi('POST',
    `/client/v4/accounts/${ACCOUNT_ID}/pages/projects`,
    { name: PROJECT_NAME, production_branch: 'main' }
  );

  if (createRes.status === 200 || createRes.status === 201) {
    console.log(`   ✅ Proyecto creado`);
  } else if (createRes.body?.errors?.[0]?.code === 8000006) {
    console.log(`   ℹ️  Proyecto ya existe — continúa con el deploy`);
  } else {
    console.log(`   ⚠️  HTTP ${createRes.status}:`, JSON.stringify(createRes.body).slice(0, 200));
    // Continúa de todas formas — probablemente ya existe
  }

  // 2. Preparar archivos
  console.log('\n2️⃣  Leyendo archivos de public/...');
  const files = readDirRecursive(PUBLIC_DIR);
  const manifest = {};
  const fileContents = {};

  for (const f of files) {
    const rel = '/' + path.relative(PUBLIC_DIR, f).replace(/\\/g, '/');
    const buf = fs.readFileSync(f);
    const hash = sha256(buf);
    manifest[rel] = hash;
    fileContents[hash] = { path: f, buf };
    console.log(`   📄 ${rel} (${buf.length} bytes)`);
  }

  // 3. Crear deployment con Direct Upload API
  console.log('\n3️⃣  Creando deployment...');

  // Usar multipart/form-data manualmente
  const boundary = '----CFPagesBoundary' + Date.now();
  const parts = [];

  // Manifest part
  const manifestJson = JSON.stringify(manifest);
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="manifest"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    manifestJson + '\r\n'
  );

  // File parts
  for (const [hash, { path: filePath, buf }] of Object.entries(fileContents)) {
    const base64 = buf.toString('base64');
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${hash}"; filename="${path.basename(filePath)}"\r\n` +
      `Content-Type: application/octet-stream\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      base64 + '\r\n'
    );
  }

  parts.push(`--${boundary}--\r\n`);
  const formBody = parts.join('');

  const deployRes = await cfApi(
    'POST',
    `/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments`,
    formBody,
    `multipart/form-data; boundary=${boundary}`
  );

  if (deployRes.status === 200 || deployRes.status === 201) {
    const d = deployRes.body?.result;
    const url = d?.url || `https://${PROJECT_NAME}.pages.dev`;
    console.log(`\n✅ Deploy exitoso!`);
    console.log(`   URL: ${url}`);
    console.log(`   ID:  ${d?.id || '?'}`);
    console.log(`\n🌐 La app está en: https://${PROJECT_NAME}.pages.dev`);
    console.log(`   (Ahora configura el dominio personalizado sistemas.camperslacuesta.com en el dashboard)`);
  } else {
    console.log(`\n❌ Error en deploy — HTTP ${deployRes.status}:`);
    console.log(JSON.stringify(deployRes.body, null, 2).slice(0, 500));
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
