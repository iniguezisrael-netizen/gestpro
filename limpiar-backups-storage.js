/**
 * limpiar-backups-storage.js
 * Borra todos los archivos de backup en Storage excepto:
 *   - backups/latest.json
 *   - Los últimos 7 archivos daily (gestpro-YYYY-MM-DD.json)
 * Ejecutar: node limpiar-backups-storage.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'campers-la-cuesta-84ade.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function limpiar() {
  console.log('Listando archivos en backups/...');
  const [files] = await bucket.getFiles({ prefix: 'backups/' });
  console.log(`Total archivos encontrados: ${files.length}`);

  // Separar daily (gestpro-YYYY-MM-DD.json) de realtime (timestamp)
  const daily = files.filter(f => /backups\/gestpro-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort();
  const realtime = files.filter(f => !f.name.endsWith('latest.json') && !/backups\/gestpro-\d{4}-\d{2}-\d{2}\.json$/.test(f.name));

  // Conservar los últimos 7 daily
  const keepDaily = daily.slice(-7).map(f => f.name);
  console.log(`\nDaily encontrados: ${daily.length} — conservando últimos 7:`);
  keepDaily.forEach(n => console.log('  ✓ ' + n));

  // Todo lo demás se borra
  const aBorrar = [
    ...daily.filter(f => !keepDaily.includes(f.name)),
    ...realtime
  ];

  console.log(`\nArchivos a borrar: ${aBorrar.length}`);
  if (aBorrar.length === 0) { console.log('Nada que borrar.'); process.exit(0); }

  let borrados = 0;
  const BATCH = 50;
  for (let i = 0; i < aBorrar.length; i += BATCH) {
    const lote = aBorrar.slice(i, i + BATCH);
    await Promise.all(lote.map(f => f.delete().catch(e => console.warn('Error borrando', f.name, e.message))));
    borrados += lote.length;
    process.stdout.write(`\rBorrados: ${borrados}/${aBorrar.length}`);
  }
  console.log('\n\n✅ Limpieza completada.');
  process.exit(0);
}

limpiar().catch(e => { console.error(e); process.exit(1); });
