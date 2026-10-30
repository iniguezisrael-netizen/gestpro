/**
 * limpiar-storage-viejo.js
 *
 * Borra las fotos antiguas de Firebase Storage (subidas antes de migrar a R2).
 * Esas fotos son la causa del costo de ~$27/mes.
 *
 * CÓMO USAR:
 *   1. cd C:\Users\israe\Downloads\firebase-deploy
 *   2. node limpiar-storage-viejo.js --listar       (solo muestra, no borra)
 *   3. node limpiar-storage-viejo.js --borrar        (borra de verdad)
 *
 * REQUISITO: firebase-admin instalado
 *   npm install firebase-admin
 */

const admin = require('firebase-admin');
const path = require('path');

// Apunta a tu archivo de credenciales de servicio
// Descárgalo de: Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar clave privada
const SERVICE_ACCOUNT = path.join(__dirname, 'serviceAccountKey.json');

const SOLO_LISTAR = process.argv.includes('--listar');
const BORRAR = process.argv.includes('--borrar');

if (!SOLO_LISTAR && !BORRAR) {
  console.log('Uso: node limpiar-storage-viejo.js --listar | --borrar');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT)),
  storageBucket: 'campers-la-cuesta-84ade.appspot.com'
});

const bucket = admin.storage().bucket();

async function main() {
  console.log('Obteniendo lista de archivos en Firebase Storage...\n');

  const [files] = await bucket.getFiles();

  console.log(`Total de archivos encontrados: ${files.length}`);

  let totalSize = 0;
  let count = 0;

  for (const file of files) {
    const meta = file.metadata;
    const size = parseInt(meta.size || 0);
    totalSize += size;
    count++;
    console.log(`  ${file.name}  (${(size/1024).toFixed(1)} KB)`);
  }

  console.log(`\nTotal: ${count} archivos, ${(totalSize/1024/1024).toFixed(2)} MB`);

  if (BORRAR) {
    console.log('\n⚠️  BORRANDO todos los archivos de Firebase Storage...');
    for (const file of files) {
      await file.delete();
      console.log(`  ✓ Borrado: ${file.name}`);
    }
    console.log('\n✅ Listo. Firebase Storage ahora está vacío — ya no se cobran esos bytes.');
    console.log('   Las fotos nuevas van a Cloudflare R2 (más barato).');
  } else {
    console.log('\nEjecuta con --borrar para eliminar estos archivos.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
