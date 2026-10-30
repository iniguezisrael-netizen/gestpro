/**
 * leer-versiones-consig.js
 * Lee el historial de versiones de consignación en Firestore
 * y busca cuáles artículos tenían baja:true en versiones recientes.
 */
const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const PROJECT = 'campers-la-cuesta-84ade';

function readToken() {
  for (const p of [
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
  ]) {
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return j.tokens?.refresh_token || j.refresh_token;
    }
  }
  throw new Error('firebase-tools.json no encontrado');
}

function req(method, urlPath, token) {
  return new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'firestore.googleapis.com', path: urlPath, method,
      headers: { Authorization: `Bearer ${token}` }
    }, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() }));
    });
    r.on('error', reject); r.end();
  });
}

function fsVal(f) {
  if (!f) return null;
  if ('nullValue'    in f) return null;
  if ('booleanValue' in f) return f.booleanValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue'  in f) return f.doubleValue;
  if ('stringValue'  in f) return f.stringValue;
  if ('arrayValue'   in f) return (f.arrayValue.values || []).map(fsVal);
  if ('mapValue'     in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k,v]) => [k, fsVal(v)]));
  return null;
}

async function main() {
  const rt = readToken();
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  }).toString();
  const tokRes = await new Promise((res, rej) => {
    const r = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) }
    }, re => { const c = []; re.on('data', d => c.push(d)); re.on('end', () => res(JSON.parse(Buffer.concat(c).toString()))); });
    r.on('error', rej); r.write(payload); r.end();
  });
  if (!tokRes.access_token) throw new Error('Token fallido: ' + JSON.stringify(tokRes));
  const token = tokRes.access_token;
  console.log('✅ Token OK\n');

  // Leer versiones guardadas en consignacion/_history/_v
  const versUrl = `/v1/projects/${PROJECT}/databases/(default)/documents/consignacion/_history/_v?pageSize=100&orderBy=ts`;
  const r = await req('GET', versUrl, token);
  if (r.status !== 200) {
    console.log('HTTP', r.status, r.body.slice(0,300));
    return;
  }
  const docs = JSON.parse(r.body).documents || [];
  console.log(`Versiones encontradas: ${docs.length}\n`);

  // Buscar en cada versión artículos con baja:true
  const bajaEncontrada = {}; // id -> { nombre, ts }

  for (const doc of docs) {
    const fields = doc.fields || {};
    const ts     = fields.ts ? fsVal(fields.ts) : doc.name.split('/').pop();
    const items  = fields.items ? fsVal(fields.items) : [];
    const fecha  = new Date(Number(ts)).toISOString().slice(0,19).replace('T',' ');

    const conBaja = (items || []).filter(x => x && x.baja === true);
    if (conBaja.length > 0) {
      console.log(`📌 ${fecha} — ${conBaja.length} artículo(s) con baja:true`);
      conBaja.forEach(x => {
        const nombre = x.nombre || x.descripcion || x.articulo || ('id:'+x.id);
        console.log(`   id:${x.id} | ${nombre} | estado:${x.estado||'?'}`);
        if (!bajaEncontrada[x.id]) bajaEncontrada[x.id] = { nombre, ts: fecha };
      });
    }
  }

  const ids = Object.keys(bajaEncontrada);
  if (ids.length === 0) {
    console.log('\n⚠️  No se encontraron artículos con baja:true en ninguna versión del historial.');
  } else {
    console.log(`\n✅ Artículos que alguna vez tuvieron baja:true (${ids.length}):`);
    ids.forEach(id => console.log(`   id:${id} | ${bajaEncontrada[id].nombre} | primera vez visto: ${bajaEncontrada[id].ts}`));
    fs.writeFileSync(path.join(__dirname, 'consig-baja-encontrada.json'), JSON.stringify(bajaEncontrada, null, 2));
    console.log('\nGuardado en: consig-baja-encontrada.json');
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
