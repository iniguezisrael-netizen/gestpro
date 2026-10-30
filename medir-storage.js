const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const BUCKET = 'campers-la-cuesta-84ade.firebasestorage.app';

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
  throw new Error('firebase-tools.json no encontrado');
}

function getAccessToken(rt) {
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  }).toString();
  return new Promise((res, rej) => {
    const r = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ const j=JSON.parse(d); if(j.error) rej(new Error(j.error)); else res(j.access_token); }); });
    r.on('error',rej); r.write(payload); r.end();
  });
}

function listFiles(token, pageToken) {
  return new Promise((resolve, reject) => {
    let url = `/storage/v1/b/${BUCKET}/o?maxResults=1000`;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const req = https.request({ hostname:'storage.googleapis.com', path:url, method:'GET',
      headers:{'Authorization':'Bearer '+token} },
      resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); });
    req.on('error',reject); req.end();
  });
}

function mb(b){ return (b/1024/1024).toFixed(2); }

async function main() {
  const token = await getAccessToken(readToken());
  console.log('Token OK. Listando archivos en Firebase Storage...\n');

  let allItems=[], pt=null, totalBytes=0;
  do {
    const r = await listFiles(token, pt);
    if (r.error) { console.error('ERROR:', r.error.message); return; }
    allItems = allItems.concat(r.items||[]);
    pt = r.nextPageToken;
    process.stdout.write(`\rArchivos encontrados: ${allItems.length}...`);
  } while(pt);

  console.log('\n');

  // Agrupar por carpeta/tipo
  const folders = {};
  const types = {};
  for(const item of allItems){
    const size = parseInt(item.size||0);
    totalBytes += size;
    // Carpeta = primer segmento del nombre
    const parts = item.name.split('/');
    const folder = parts.length > 1 ? parts[0] : '(raiz)';
    if(!folders[folder]) folders[folder] = { count:0, bytes:0 };
    folders[folder].count++;
    folders[folder].bytes += size;
    // Tipo por extensión
    const ext = (item.name.split('.').pop()||'').toLowerCase();
    if(!types[ext]) types[ext] = { count:0, bytes:0 };
    types[ext].count++;
    types[ext].bytes += size;
  }

  console.log('=== TOTAL Firebase Storage ===');
  console.log(`  Archivos: ${allItems.length}`);
  console.log(`  Tamaño total: ${mb(totalBytes)} MB (${(totalBytes/1024/1024/1024).toFixed(3)} GB)\n`);

  console.log('=== Por carpeta ===');
  Object.entries(folders).sort((a,b)=>b[1].bytes-a[1].bytes).forEach(([f,v])=>{
    console.log(`  ${f.padEnd(30)} ${v.count} archivos  ${mb(v.bytes)} MB`);
  });

  console.log('\n=== Por tipo de archivo ===');
  Object.entries(types).sort((a,b)=>b[1].bytes-a[1].bytes).forEach(([t,v])=>{
    console.log(`  .${t.padEnd(10)} ${v.count} archivos  ${mb(v.bytes)} MB`);
  });

  const out = path.join(os.homedir(),'Downloads','firebase-deploy','storage-resultado.json');
  fs.writeFileSync(out, JSON.stringify({ totalMB: mb(totalBytes), totalFiles: allItems.length, folders, types }, null, 2));
  console.log('\nGuardado en:', out);
}
main().catch(e => console.error('ERROR:', e.message));
