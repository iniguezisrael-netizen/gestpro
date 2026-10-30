/**
 * limpiar-storage-cli.js — ejecutar desde la carpeta firebase-deploy:
 * node limpiar-storage-cli.js
 */
const admin = require('./functions/node_modules/firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: 'campers-la-cuesta-84ade.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function main() {
  console.log('Listando archivos en backups/ ...');
  const [files] = await bucket.getFiles({ prefix: 'backups/' });
  console.log('Total:', files.length, 'archivos');

  const daily = files
    .filter(f => /backups\/gestpro-\d{4}-\d{2}-\d{2}\.json$/.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const keepSet = new Set([
    'backups/latest.json',
    ...daily.slice(-7).map(f => f.name)
  ]);

  console.log('\nConservando', keepSet.size, 'archivos:');
  keepSet.forEach(n => console.log('  ✓', n));

  const aBorrar = files.filter(f => !keepSet.has(f.name));
  console.log('\nA borrar:', aBorrar.length, 'archivos...');

  if (!aBorrar.length) { console.log('Nada que borrar.'); return; }

  const LOTE = 50;
  let n = 0;
  for (let i = 0; i < aBorrar.length; i += LOTE) {
    await Promise.all(aBorrar.slice(i, i + LOTE).map(f => f.delete().catch(() => {})));
    n += Math.min(LOTE, aBorrar.length - i);
    process.stdout.write('\rBorrados: ' + n + '/' + aBorrar.length + '   ');
  }
  console.log('\n✅ Limpieza completada.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
