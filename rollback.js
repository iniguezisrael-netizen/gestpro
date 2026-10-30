const https = require('https');
const CF_TOKEN = 'cfut_jkD2WUQjMKEujhAs2D2vJaro9l1ACZUdDZNDmUFN764c1b65';
const ACCOUNT_ID = '9cd3aaf5646f228ec0f34092f74fc6b3';
const PROJECT_NAME = 'campers-la-cuesta';
const BROKEN_ID = '8db5b6d4-25d6-4e3b-9447-4920cb0c2ecf';
function cfApi(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: 'api.cloudflare.com', path, method, headers: { 'Authorization': 'Bearer ' + CF_TOKEN, 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
async function main() {
  const list = await cfApi('GET', `/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments?per_page=10`);
  if (!list.success) { console.error('Error:', list.errors); return; }
  const good = list.result.find(d => d.id !== BROKEN_ID);
  if (!good) { console.error('No hay deployment anterior'); return; }
  console.log('Rollback a:', good.id, good.created_on.slice(0,16));
  const r = await cfApi('POST', `/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments/${good.id}/retry`);
  if (r.success) console.log('OK - URL:', r.result.url);
  else console.error('ERROR', JSON.stringify(r.errors));
}
main().catch(console.error);
