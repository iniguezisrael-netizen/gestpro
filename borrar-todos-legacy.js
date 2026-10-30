const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const TO_DELETE = ['ventas','cotizaciones','cajas','cobranza','consignacion','vehiculos',
  'reparaciones','clientes','productos','bodegas','entregas','facturas','herramientas',
  'herramientasAsignadas','herramientasHistorial','ordenesCompra','proveedores',
  'checadorConfig','entregaInsumos','reportesProduccion','produccion','agenda'];

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
  throw new Error('No credentials');
}

function getAccessToken(rt) {
  const payload = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: rt, grant_type: 'refresh_token'
  }).toString();
  return new Promise((res, rej) => {
    const r = https.request({ hostname:'oauth2.googleapis.com', path:'/token', method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(payload)}
    }, resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ const j=JSON.parse(d); if(j.error) rej(new Error(j.error)); else res(j.access_token); }); });
    r.on('error',rej); r.write(payload); r.end();
  });
}

function deleteDoc(token, col) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname:'firestore.googleapis.com',
      path:`/v1/projects/${PROJECT}/databases/(default)/documents/${col}/data`,
      method:'DELETE', headers:{'Authorization':'Bearer '+token} },
      resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>{ resolve(resp.statusCode); }); });
    req.on('error',reject); req.end();
  });
}

async function main() {
  const token = await getAccessToken(readToken());
  console.log('Token OK. Borrando documentos legacy...\n');
  let totalOk = 0;
  for (const col of TO_DELETE) {
    const status = await deleteDoc(token, col);
    if (status === 200) {
      console.log(`  ✅ ${col}/data eliminado`);
      totalOk++;
    } else if (status === 404) {
      console.log(`  ⬜ ${col}/data no existe (ya borrado)`);
    } else {
      console.log(`  ❌ ${col}/data error HTTP ${status}`);
    }
  }
  console.log(`\n✅ Listo. ${totalOk} documentos legacy eliminados.`);
  console.log('La app no se ve afectada — todos los datos ya estaban en documentos individuales.');
}
main().catch(e => console.error('ERROR:', e.message));
