const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'campers-la-cuesta-84ade';
const COB_ID = '244632';
const NUEVO_TOTAL = 15776;

function readToken() {
  for (const p of [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  ]) {
    if (fs.existsSync(p)) { const j = JSON.parse(fs.readFileSync(p,'utf8')); return j.tokens?.refresh_token || j.refresh_token; }
  }
  throw new Error('firebase-tools.json no encontrado');
}

async function main() {
  const rt = readToken();
  const payload = new URLSearchParams({ client_id:'563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret:'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token:rt, grant_type:'refresh_token' }).toString();
  const tok = await new Promise((res,rej)=>{
    const r=https.request({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(payload)}},re=>{const c=[];re.on('data',d=>c.push(d));re.on('end',()=>res(JSON.parse(Buffer.concat(c).toString())));});
    r.on('error',rej);r.write(payload);r.end();
  });
  if (!tok.access_token) throw new Error('Token: '+JSON.stringify(tok));
  const token = tok.access_token;

  const body = JSON.stringify({ fields: { total: { doubleValue: NUEVO_TOTAL } } });
  const urlPath = `/v1/projects/${PROJECT}/databases/(default)/documents/cobranza/${COB_ID}?updateMask.fieldPaths=total`;

  const pr = await new Promise((res,rej)=>{
    const r=https.request({hostname:'firestore.googleapis.com',path:urlPath,method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},re=>{const c=[];re.on('data',d=>c.push(d));re.on('end',()=>res({status:re.statusCode,body:Buffer.concat(c).toString()}));});
    r.on('error',rej);r.write(body);r.end();
  });

  if (pr.status === 200) {
    console.log(`✅ Cobranza id=${COB_ID} (Guillermo De La Torre) actualizada a $${NUEVO_TOTAL}`);
  } else {
    console.error('❌ Error:', pr.status, pr.body.slice(0,300));
  }
}

main().catch(e=>{console.error('ERROR:',e.message);process.exit(1);});
