// ══════════════════════════════════════════════════════════════════════════════
// SCRIPT DE MIGRACIÓN — pegar en la consola del navegador de la app (admin)
// Migra fotos de Firebase Storage a Cloudflare R2 y actualiza Firestore
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  const R2_PUBLIC_BASE = 'https://pub-2661113d195648a2bb72e8015b05fd3f.r2.dev';
  const COLS = ['consignacion','productos','materia','ventas','cotizaciones',
                 'reportesProduccion','reportesEntrega','catalogoMateriales'];
  const ARRAY_COLS = ['materia','catalogoMateriales'];
  const DB = window.db || firebase.firestore();
  const FN = firebase.functions().httpsCallable('r2PresignedUpload');

  function esUrlStorage(url) {
    try { return new URL(url).hostname === 'firebasestorage.googleapis.com'; }
    catch { return false; }
  }

  async function subirAR2(url) {
    // Descargar la foto de Storage como blob
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('No se pudo descargar: ' + url);
    const blob = await resp.blob();

    // Extraer el path del archivo desde la URL de Storage
    const match = new URL(url).pathname.match(/\/o\/(.+)$/);
    if (!match) throw new Error('Path no encontrado en URL: ' + url);
    const storagePath = decodeURIComponent(match[1]).split('?')[0];
    const contentType = blob.type || 'image/jpeg';

    // Obtener URL firmada de R2
    const { data } = await FN({ fileName: storagePath, contentType });
    const { uploadUrl, publicUrl } = data;

    // Subir a R2
    const putResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!putResp.ok) throw new Error('R2 PUT falló: ' + putResp.status);
    return publicUrl;
  }

  let totalMigradas = 0, totalErrores = 0;

  for (const col of COLS) {
    try {
      if (ARRAY_COLS.includes(col)) {
        const snap = await DB.collection(col).doc('data').get();
        if (!snap.exists) continue;
        const items = snap.data().items || [];
        let cambios = false;
        for (const item of items) {
          if (Array.isArray(item.fotos)) {
            for (let i = 0; i < item.fotos.length; i++) {
              if (!item.fotos[i] || !esUrlStorage(item.fotos[i])) continue;
              try {
                item.fotos[i] = await subirAR2(item.fotos[i]);
                console.log('✅', col, item.id || '', item.fotos[i]);
                totalMigradas++; cambios = true;
              } catch(e) { console.error('❌', col, e.message); totalErrores++; }
            }
          }
          if (item.foto && esUrlStorage(item.foto)) {
            try {
              item.foto = await subirAR2(item.foto);
              console.log('✅', col, item.id || '', item.foto);
              totalMigradas++; cambios = true;
            } catch(e) { console.error('❌', col, e.message); totalErrores++; }
          }
        }
        if (cambios) await DB.collection(col).doc('data').update({ items });
      } else {
        const snap = await DB.collection(col).get();
        for (const doc of snap.docs) {
          if (doc.id.startsWith('_')) continue;
          const data = doc.data();
          const update = {};
          let cambios = false;

          if (Array.isArray(data.fotos)) {
            const nuevas = [...data.fotos];
            for (let i = 0; i < nuevas.length; i++) {
              if (!nuevas[i] || !esUrlStorage(nuevas[i])) continue;
              try {
                nuevas[i] = await subirAR2(nuevas[i]);
                console.log('✅', col, doc.id, nuevas[i]);
                totalMigradas++; cambios = true;
              } catch(e) { console.error('❌', col, doc.id, e.message); totalErrores++; }
            }
            if (cambios) update.fotos = nuevas;
          }
          if (data.foto && esUrlStorage(data.foto)) {
            try {
              update.foto = await subirAR2(data.foto);
              console.log('✅', col, doc.id, update.foto);
              totalMigradas++; cambios = true;
            } catch(e) { console.error('❌', col, doc.id, e.message); totalErrores++; }
          }
          if (cambios) await DB.collection(col).doc(doc.id).update(update);
        }
      }
    } catch(e) { console.error('❌ Colección', col, e.message); }
  }

  console.log(`\n✅ MIGRACIÓN COMPLETA: ${totalMigradas} fotos migradas, ${totalErrores} errores.`);
  console.log('Las fotos ya apuntan a R2. Puedes borrar las de Firebase Storage cuando confirmes que todo funciona.');
})();
