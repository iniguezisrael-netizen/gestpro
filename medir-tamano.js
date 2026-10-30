const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
// Colecciones a analizar (las más grandes primero)
const TARGETS = [
  'catalogoMateriales',
  'materia',
  'clientes',
  'ventas',
  'cotizaciones',
  'consignacion',
];

function readToken() {
  for (const p of [
    path.join(os.homedir(), 'AppData','Roaming','configstore','firebase-tools.json'),
    path.join(os.homedir(), '.config','configstore','firebase-tools.json'),
  ]) {
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      const t = j.tokens?.refresh_token || j.refresh_token;
      if (t) return t;
    }
  }
  throw new Error('No se encontraron credenciales.');
}

function getAccessToken(refreshToken) {
  const payload = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi`;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname:'oauth2.googleapis.com', path:'/token', method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(payload)}
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ const r=JSON.parse(d); if(r.error) reject(new Error(r.error+': '+r.error_description)); else resolve(r.access_token); }); });
    req.on('error', reject); req.write(payload); req.end();
  });
}

function fetchDocs(token, col, pageToken) {
  return new Promise((resolve, reject) => {
    let url = `/v1/projects/${PROJECT}/databases/(default)/documents/${col}?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const req = https.request({
      hostname:'firestore.googleapis.com', path: url, method:'GET',
      headers:{'Authorization':`Bearer ${token}`}
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); });
    req.on('error', reject); req.end();
  });
}

function bytesToKB(b) { return (b/1024).toFixed(1); }
function bytesToMB(b) { return (b/1024/1024).toFixed(2); }

function analyzeDoc(doc) {
  const raw = JSON.stringify(doc);
  const size = Buffer.byteLength(raw, 'utf8');
  // Detectar campos con base64 (imágenes)
  const base64Fields = [];
  function scanFields(fields, prefix='') {
    for (const [k, v] of Object.entries(fields || {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v.bytesValue || (v.stringValue && v.stringValue.length > 5000 && /^[A-Za-z0-9+/]+=*$/.test(v.stringValue.substring(0,100)))) {
        base64Fields.push(`${key}(${bytesToKB(Buffer.byteLength(v.bytesValue || v.stringValue))}KB)`);
      }
      if (v.mapValue?.fields) scanFields(v.mapValue.fields, key);
    }
  }
  scanFields(doc.fields);
  return { size, base64Fields };
}

async function analyzeCollection(token, col) {
  let allDocs = [], pageToken = null;
  do {
    const r = await fetchDocs(token, col, pageToken);
    if (r.error) { console.log(`  ERROR: ${r.error.message}`); return; }
    allDocs = allDocs.concat(r.documents || []);
    pageToken = r.nextPageToken;
  } while (pageToken);

  if (!allDocs.length) { console.log('  (vacía)'); return; }

  let totalBytes = 0, maxBytes = 0, maxId = '', docsWithBase64 = 0;
  const fieldSizes = {};

  for (const doc of allDocs) {
    const { size, base64Fields } = analyzeDoc(doc);
    totalBytes += size;
    if (size > maxBytes) { maxBytes = size; maxId = doc.name.split('/').pop(); }
    if (base64Fields.length > 0) docsWithBase64++;
    // Acumular tamaño por campo
    for (const [k, v] of Object.entries(doc.fields || {})) {
      const fs2 = Buffer.byteLength(JSON.stringify(v), 'utf8');
      fieldSizes[k] = (fieldSizes[k] || 0) + fs2;
    }
  }

  console.log(`  Total aprox:    ${bytesToMB(totalBytes)} MB`);
  console.log(`  Doc más grande: ${bytesToKB(maxBytes)} KB (id: ${maxId})`);
  console.log(`  Promedio:       ${bytesToKB(totalBytes/allDocs.length)} KB/doc`);
  if (docsWithBase64 > 0) console.log(`  ⚠️  Docs con base64/imagen: ${docsWithBase64}`);

  // Top 5 campos por peso total
  const top = Object.entries(fieldSizes).sort((a,b)=>b[1]-a[1]).slice(0,5);
  console.log(`  Top campos por peso:`);
  for (const [k,s] of top) console.log(`    ${k.padEnd(25)} ${bytesToMB(s)} MB total`);
}

async function main() {
  const refresh = readToken();
  console.log('Obteniendo token...');
  const token = await getAccessToken(refresh);
  console.log('Token OK. Midiendo tamaños...\n');

  for (const col of TARGETS) {
    console.log(`\n📁 ${col}`);
    console.log('  ' + '-'.repeat(50));
    await analyzeCollection(token, col);
  }
  console.log('\n✅ Análisis completo.');
}
main().catch(console.error);
