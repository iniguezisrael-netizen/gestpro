const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const COLLECTIONS = [
  'ventas','cotizaciones','cajas','cobranza','consignacion','vehiculos',
  'reparaciones','clientes','clientesCredito','materia','productos',
  'catalogoMateriales','bodegas','entregas','facturas','herramientas',
  'herramientasAsignadas','herramientasHistorial','ordenesCompra',
  'proveedores','checadorConfig','entregaInsumos','reportesEntrega',
  'reportesProduccion','produccion','agenda'
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
  throw new Error('No se encontraron credenciales. Ejecuta: firebase login');
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

function listDocs(token, col, pageToken) {
  return new Promise((resolve, reject) => {
    let url = `/v1/projects/${PROJECT}/databases/(default)/documents/${col}?pageSize=300&mask.fieldPaths=__name__`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const req = https.request({
      hostname:'firestore.googleapis.com', path: url, method:'GET',
      headers:{'Authorization':`Bearer ${token}`}
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); });
    req.on('error', reject); req.end();
  });
}

async function countCollection(token, col) {
  let count = 0, pageToken = null;
  do {
    const r = await listDocs(token, col, pageToken);
    if (r.error) return `ERROR: ${r.error.message}`;
    count += (r.documents || []).length;
    pageToken = r.nextPageToken;
  } while (pageToken);
  return count;
}

async function main() {
  const refresh = readToken();
  console.log('Obteniendo token...');
  const token = await getAccessToken(refresh);
  console.log('Token OK. Contando documentos...\n');
  const results = [];
  for (const col of COLLECTIONS) {
    const count = await countCollection(token, col);
    results.push({ col, count: typeof count === 'number' ? count : 0, raw: count });
    console.log(`${col.padEnd(28)} ${count}`);
  }
  results.sort((a,b) => b.count - a.count);
  console.log('\n=== TOP por número de documentos ===');
  results.slice(0,10).forEach(r => console.log(`${r.col.padEnd(28)} ${r.raw}`));
}
main().catch(console.error);
