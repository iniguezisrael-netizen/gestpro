const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const TARGETS = [
  'catalogoMateriales','materia','clientes','ventas',
  'cotizaciones','consignacion','cobranza','productos'
];

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

function fetchDocs(token, col, pageToken) {
  return new Promise((resolve, reject) => {
    let url = `/v1/projects/${PROJECT}/databases/(default)/documents/${col}?pageSize=300`;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const req = https.request({ hostname:'firestore.googleapis.com', path:url, method:'GET',
      headers:{'Authorization':'Bearer '+token} },
      resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} }); });
    req.on('error',reject); req.end();
  });
}

function mb(b){ return (b/1024/1024).toFixed(3); }
function kb(b){ return (b/1024).toFixed(1); }

async function analyzeCollection(token, col) {
  let allDocs=[], pt=null;
  do {
    const r = await fetchDocs(token, col, pt);
    if (r.error) return { error: r.error.message };
    allDocs = allDocs.concat(r.documents||[]);
    pt = r.nextPageToken;
  } while(pt);
  if(!allDocs.length) return { docs:0, totalMB:'0.000', maxKB:'0.0', maxId:'', avgKB:'0.0', topFields:[] };

  let totalBytes=0, maxBytes=0, maxId='';
  const fieldSizes={};
  for(const doc of allDocs){
    const size = Buffer.byteLength(JSON.stringify(doc),'utf8');
    totalBytes += size;
    if(size>maxBytes){ maxBytes=size; maxId=doc.name.split('/').pop(); }
    for(const [k,v] of Object.entries(doc.fields||{})){
      const s = Buffer.byteLength(JSON.stringify(v),'utf8');
      fieldSizes[k] = (fieldSizes[k]||0) + s;
    }
  }
  const topFields = Object.entries(fieldSizes).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([k,s])=>k+'='+mb(s)+'MB');
  return { docs:allDocs.length, totalMB:mb(totalBytes), maxKB:kb(maxBytes), maxId, avgKB:kb(totalBytes/allDocs.length), topFields };
}

async function main() {
  console.log('Leyendo credenciales...');
  const rt = readToken();
  console.log('Obteniendo token...');
  const token = await getAccessToken(rt);
  console.log('Token OK. Analizando colecciones...\n');
  const results = {};
  for(const col of TARGETS){
    process.stdout.write(col + '... ');
    results[col] = await analyzeCollection(token, col);
    console.log('OK');
  }
  const outPath = path.join(os.homedir(), 'Downloads', 'firebase-deploy', 'tamanos-resultado.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('\nGuardado en:', outPath);
}
main().catch(e => console.error('ERROR:', e.message));
