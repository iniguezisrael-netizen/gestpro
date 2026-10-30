/**
 * leer-backup-julio28.js - v7 (sin auth, reglas temporalmente públicas)
 * Uso: node leer-backup-julio28.js
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BUCKET = 'campers-la-cuesta-84ade.firebasestorage.app';
const OUT    = path.join(__dirname, 'consignacion-julio28.json');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.request({ hostname: u.hostname, path: u.pathname + u.search }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c) }));
    }).on('error', reject).end();
  });
}

async function main() {
  const encoded = encodeURIComponent('backups/latest.json');
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media`;

  console.log('Descargando backup (sin auth)...');
  const r = await httpsGet(url);
  console.log('HTTP:', r.status, '| Bytes:', r.body.length);

  if (r.status !== 200) {
    console.error('Error:', r.body.toString().slice(0, 300));
    process.exit(1);
  }

  const data = JSON.parse(r.body.toString('utf8'));
  console.log('Backup timestamp:', data._timestamp);

  const consig = data.consignacion || [];
  console.log('\nTotal consignación:', consig.length, 'items');
  consig.forEach(i => {
    console.log(`  id=${String(i.id).padEnd(4)} | ${(i.fecha||'sin fecha').padEnd(12)} | ${(i.producto||'').substring(0,50)}`);
  });

  fs.writeFileSync(OUT, JSON.stringify(consig, null, 2), 'utf8');
  console.log('\nGuardado en:', OUT);

  const julio28 = consig.filter(i => (i.fecha||'').startsWith('2026-07-28'));
  if (julio28.length > 0) {
    console.log(`\n✅ ENCONTRADOS ${julio28.length} items del 28 de julio:`);
    console.log(JSON.stringify(julio28, null, 2));
  } else {
    console.log('\n⚠  No hay items con fecha 2026-07-28 en el backup.');
    console.log('   El backup no los tiene — nunca se guardaron en Firestore.');
  }
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
