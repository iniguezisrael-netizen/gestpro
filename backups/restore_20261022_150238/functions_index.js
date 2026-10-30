const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectCommand, PutBucketCorsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

admin.initializeApp();

const GMAIL_APP_PASSWORD  = defineSecret('GMAIL_APP_PASSWORD');
const R2_ACCESS_KEY_ID    = defineSecret('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = defineSecret('R2_SECRET_ACCESS_KEY');
const CORREO_REMITENTE = 'camperslacuesta@gmail.com';
const LIMITE_DIARIO_CORREOS = 490;

exports.cambiarPasswordUsuario = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para hacer esto.');

  const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede cambiar contraseñas de otros usuarios.');
  }

  const targetUid = data && data.targetUid;
  const newPassword = data && data.newPassword;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta el UID del usuario al que se le va a cambiar la contraseña.');
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'La nueva contraseña debe tener al menos 6 caracteres.');
  }

  try {
    await admin.auth().updateUser(targetUid, { password: newPassword });
  } catch (e) {
    throw new HttpsError('internal', 'No se pudo cambiar la contraseña: ' + e.message);
  }

  return { ok: true };
});

exports.actualizarEmailUsuario = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para hacer esto.');

  const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede cambiar el correo de otros usuarios.');
  }

  const targetUid = data && data.targetUid;
  const newEmail = data && data.newEmail;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta el UID del usuario.');
  }
  if (!newEmail || typeof newEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new HttpsError('invalid-argument', 'El correo no es válido.');
  }

  try {
    await admin.auth().updateUser(targetUid, { email: newEmail });
  } catch (e) {
    throw new HttpsError('internal', 'No se pudo actualizar el correo: ' + e.message);
  }

  return { ok: true };
});

exports.crearUsuario = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede crear usuarios.');
  }

  const { loginUser, password, nombre, rol } = data || {};
  if (!loginUser || !password || !nombre || !rol) {
    throw new HttpsError('invalid-argument', 'Faltan campos obligatorios.');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
  }

  const EMAIL_DOMAIN = '@camperslacuesta.app';
  const email = loginUser.replace(/\s+/g, '').toLowerCase() + EMAIL_DOMAIN;

  let uid;
  try {
    const userRecord = await admin.auth().createUser({ email, password, displayName: nombre });
    uid = userRecord.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
      await admin.auth().updateUser(uid, { password, displayName: nombre });
    } else {
      throw new HttpsError('internal', 'No se pudo crear la cuenta: ' + e.message);
    }
  }

  await admin.firestore().collection('roles').doc(uid).set({ nombre, user: loginUser.toLowerCase(), rol });
  return { ok: true, uid };
});

exports.eliminarUsuario = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede eliminar usuarios.');
  }

  const targetUid = data && data.targetUid;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta targetUid.');
  }
  if (targetUid === auth.uid) {
    throw new HttpsError('invalid-argument', 'No puedes eliminarte a ti mismo.');
  }

  try {
    await admin.auth().deleteUser(targetUid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'Error al eliminar la cuenta: ' + e.message);
    }
  }
  await admin.firestore().collection('roles').doc(targetUid).delete();
  return { ok: true };
});

exports.enviarCorreoMasivo = onCall({ secrets: [GMAIL_APP_PASSWORD] }, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para hacer esto.');

  const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
  const rol = callerSnap.exists ? callerSnap.data().rol : null;
  if (!['admin', 'secretaria', 'auxiliar'].includes(rol)) {
    throw new HttpsError('permission-denied', 'Solo Administrador, Secretaria o Auxiliar Administrativo pueden enviar correos masivos.');
  }

  const destinatarios = Array.isArray(data && data.destinatarios) ? data.destinatarios : [];
  const asunto = (data && data.asunto || '').trim().replace(/[\r\n]/g, ' ').slice(0, 255);
  const mensaje = (data && data.mensaje || '').trim();

  if (!destinatarios.length) throw new HttpsError('invalid-argument', 'No hay destinatarios.');
  if (!asunto || !mensaje) throw new HttpsError('invalid-argument', 'Falta el asunto o el mensaje.');

  const hoy = new Date().toISOString().split('T')[0];
  const contadorRef = admin.firestore().collection('_meta').doc('correoContador');

  const { aEnviar, omitidosPorLimite } = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(contadorRef);
    let enviadosHoy = 0;
    if (snap.exists && snap.data().fecha === hoy) enviadosHoy = snap.data().enviados || 0;
    const disponibles = Math.max(0, LIMITE_DIARIO_CORREOS - enviadosHoy);
    const lote = destinatarios.slice(0, disponibles);
    tx.set(contadorRef, { fecha: hoy, enviados: enviadosHoy + lote.length });
    return { aEnviar: lote, omitidosPorLimite: destinatarios.length - lote.length };
  });

  if (!aEnviar.length) {
    return {
      enviados: 0,
      omitidos: destinatarios.length,
      motivo: `Ya se alcanzó el límite de ${LIMITE_DIARIO_CORREOS} correos de hoy. Intenta de nuevo mañana.`
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: CORREO_REMITENTE, pass: GMAIL_APP_PASSWORD.value() }
  });

  let okCount = 0;
  const errores = [];
  for (const dest of aEnviar) {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!dest || !dest.correo) { errores.push({ correo: '(sin correo)', error: 'Cliente sin correo registrado' }); continue; }
    if (!EMAIL_RE.test(dest.correo)) { errores.push({ correo: dest.correo, error: 'Correo con formato inválido' }); continue; }
    const textoPersonalizado = mensaje.replace(/\{nombre\}/gi, (dest.nombre || 'cliente'));
    try {
      await transporter.sendMail({
        from: `"Campers La Cuesta" <${CORREO_REMITENTE}>`,
        to: dest.correo,
        subject: asunto,
        text: textoPersonalizado
      });
      okCount++;
    } catch (e) {
      errores.push({ correo: dest.correo, error: e.message });
    }
  }

  return { enviados: okCount, omitidos: omitidosPorLimite, errores };
});

// ─── Colecciones y bucket compartidos ────────────────────────────────────────
const BACKUP_COLLECTIONS = [
  'materia','productos','consignacion','ventas','cotizaciones','cajas',
  'reparaciones','bodegas','entregas','facturas','cobranza','vehiculos',
  'produccion','catalogoMateriales','clientesCredito','clientes',
  'entregaInsumos','reportesEntrega','reportesProduccion',
  'herramientas','herramientasAsignadas','herramientasHistorial',
  'ordenesCompra','proveedores','checadas','checadorConfig','agenda'
];
const BACKUP_BUCKET = 'campers-la-cuesta-84ade.firebasestorage.app';
const BACKUP_PREFIX = 'backups/';
const BACKUP_KEEP   = 30; // 30 días de historial en R2

// Colecciones en formato array {col}/data.items[] (mismo que FS_ARRAY_COLS del cliente)
// materia y catalogoMateriales migraron a docs individuales — solo clientesCredito permanece en array.
const ARRAY_COLS = ['clientesCredito'];

async function _leerTodasLasColecciones() {
  const db = admin.firestore();
  const backup = { _exportedAt: new Date().toISOString(), collections: {} };
  for (const col of BACKUP_COLLECTIONS) {
    try {
      if (ARRAY_COLS.includes(col)) {
        // Formato array: leer {col}/data.items[]
        const snap = await db.collection(col).doc('data').get();
        backup.collections[col] = snap.exists ? (snap.data().items || []) : [];
      } else {
        // Formato individual: consultar colección, excluir meta-docs
        const snap = await db.collection(col).get();
        backup.collections[col] = snap.docs
          .filter(d => !d.id.startsWith('_'))
          .map(d => d.data())
          .filter(d => d && d.id != null);
      }
    } catch (e) {
      console.warn(`[dailyBackup] Error leyendo ${col}:`, e.message);
      backup.collections[col] = [];
    }
  }
  return backup;
}

// Backup incremental: solo lee docs con _updatedAt > lastBackupAtMs y los fusiona con el backup base.
// Para ARRAY_COLS siempre lee completo (es un solo documento, barato).
async function _leerColeccionesIncrementales(lastBackupAtMs, baseBackup) {
  const db = admin.firestore();
  const backup = {
    _exportedAt: new Date().toISOString(),
    _isIncremental: true,
    _basedOn: baseBackup._exportedAt,
    collections: JSON.parse(JSON.stringify(baseBackup.collections || {})),
  };
  for (const col of BACKUP_COLLECTIONS) {
    try {
      if (ARRAY_COLS.includes(col)) {
        // Array col: siempre leer completo (es un solo doc, ~1 lectura)
        const snap = await db.collection(col).doc('data').get();
        backup.collections[col] = snap.exists ? (snap.data().items || []) : [];
      } else {
        // Solo docs modificados desde el último backup
        const snap = await db.collection(col)
          .where('_updatedAt', '>', lastBackupAtMs)
          .get();
        const changed = snap.docs
          .filter(d => !d.id.startsWith('_'))
          .map(d => d.data())
          .filter(d => d && d.id != null);
        if (changed.length > 0) {
          const base = backup.collections[col] || [];
          const baseMap = new Map(base.map(d => [String(d.id), d]));
          changed.forEach(d => baseMap.set(String(d.id), d));
          backup.collections[col] = [...baseMap.values()];
        } else if (!backup.collections[col]) {
          backup.collections[col] = [];
        }
        console.log(`[dailyBackup] ${col}: ${changed.length} docs modificados`);
      }
    } catch (e) {
      console.warn(`[dailyBackup] Error incremental ${col}:`, e.message);
      if (!backup.collections[col]) backup.collections[col] = [];
    }
  }
  return backup;
}

// ─── Respaldo diario automático ───────────────────────────────────────────────
// Corre cada día a las 7:00 AM UTC (1:00 AM México). Limpia respaldos > 30 días.
// ─── Presigned URL para subir fotos directamente a Cloudflare R2 ─────────────
// El cliente llama esta función con { fileName, contentType }.
// La función genera una URL firmada de PUT válida 5 minutos y devuelve
// también la URL pública final en R2.
const R2_BUCKET    = 'campers-fotos';
const R2_ENDPOINT  = 'https://9cd3aaf5646f228ec0f34092f74fc6b3.r2.cloudflarestorage.com';
const R2_PUBLIC_BASE = 'https://pub-2661113d195648a2bb72e8015b05fd3f.r2.dev';

// Genera una URL firmada de PUT en R2 para que el cliente suba la foto directo.
// invoker: 'public' → Firebase CLI intentará otorgar allUsers:run.invoker en Cloud Run.
// Si el IAM no se aplica automáticamente, fijarlo manualmente en la consola de GCP:
// Cloud Run → r2presignedupload → Seguridad → Agregar principal: allUsers / run.invoker
exports.r2PresignedUpload = onCall(
  { secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY], invoker: 'public' },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { fileName, contentType } = data || {};

    if (!fileName || typeof fileName !== 'string') {
      throw new HttpsError('invalid-argument', 'Falta fileName');
    }
    if (!contentType || !contentType.startsWith('image/')) {
      throw new HttpsError('invalid-argument', 'contentType debe ser image/*');
    }

    const safeKey = fileName.replace(/[^a-zA-Z0-9\-_.\/]/g, '_');
    if (!safeKey.startsWith('fotos/')) {
      throw new HttpsError('invalid-argument', 'El archivo debe subirse dentro de fotos/');
    }

    const akid = R2_ACCESS_KEY_ID.value().trim();
    const sak  = R2_SECRET_ACCESS_KEY.value().trim();

    const s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      forcePathStyle: false,
      credentials: { accessKeyId: akid, secretAccessKey: sak },
    });

    const cmd = new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         safeKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    const publicUrl = `${R2_PUBLIC_BASE}/${safeKey}`;

    return { uploadUrl, publicUrl };
  }
);

// ─── Eliminar fotos de R2 al borrar un registro ──────────────────────────────
// Recibe un array de URLs públicas de R2 y las elimina del bucket.
// Solo acepta URLs del dominio R2 conocido para evitar abusos.
exports.r2EliminarFotos = onCall(
  { secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY] },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
    const rol = callerSnap.exists ? callerSnap.data().rol : null;
    if (!['admin', 'secretaria', 'auxiliar'].includes(rol)) {
      throw new HttpsError('permission-denied', 'No tienes permiso para eliminar fotos.');
    }

    const urls = Array.isArray(data && data.urls) ? data.urls : [];
    if (!urls.length) return { eliminadas: 0 };

    const r2 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID.value().trim(),
        secretAccessKey: R2_SECRET_ACCESS_KEY.value().trim(),
      },
    });

    let eliminadas = 0;
    for (const url of urls) {
      try {
        if (typeof url !== 'string' || !url.startsWith(R2_PUBLIC_BASE + '/')) continue;
        const key = url.slice(R2_PUBLIC_BASE.length + 1);
        await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        eliminadas++;
      } catch (e) {
        console.warn('[r2EliminarFotos] Error eliminando', url, e.message);
      }
    }
    return { eliminadas };
  }
);

// ─── Proxy de imágenes de Firebase Storage para PDF (evita CORS) ─────────────
// El navegador no puede hacer fetch() a Storage (CORS), pero el servidor sí.
// La función descarga la imagen y la devuelve como base64 para jsPDF.
exports.proxyStorageImg = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const url = data && data.url;
  const ALLOWED_BUCKET = 'campers-la-cuesta-84ade.firebasestorage.app';
  const R2_ALLOWED_HOST = 'pub-2661113d195648a2bb72e8015b05fd3f.r2.dev';
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new HttpsError('invalid-argument', 'URL no válida.'); }
  const isFirebase = parsedUrl.hostname === 'firebasestorage.googleapis.com'
                     && parsedUrl.pathname.includes(ALLOWED_BUCKET);
  const isR2 = parsedUrl.hostname === R2_ALLOWED_HOST;
  if (!isFirebase && !isR2) {
    throw new HttpsError('invalid-argument', 'URL no permitida.');
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buf = await resp.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    const ct  = resp.headers.get('content-type') || 'image/jpeg';
    return { b64: `data:${ct};base64,${b64}` };
  } catch(e) {
    throw new HttpsError('internal', 'No se pudo obtener la imagen: ' + e.message);
  }
});

// ─── Subir foto a R2 desde el servidor (evita problema de CORS en PUT directo) ─
// El navegador no puede hacer PUT directo a R2 (CORS solo permite GET/HEAD).
// Esta función recibe la imagen como base64 y la sube desde Cloud Functions.
exports.r2SubirFoto = onCall(
  { secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY] },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { imageBase64, contentType, carpeta } = data || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') throw new HttpsError('invalid-argument', 'Falta imageBase64');
    if (!carpeta || typeof carpeta !== 'string') throw new HttpsError('invalid-argument', 'Falta carpeta');
    if (!contentType || !contentType.startsWith('image/')) throw new HttpsError('invalid-argument', 'contentType debe ser image/*');

    const nombre = `fotos/${carpeta}/foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

    const r2 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId:     R2_ACCESS_KEY_ID.value().trim(),
        secretAccessKey: R2_SECRET_ACCESS_KEY.value().trim(),
      },
    });

    const buffer = Buffer.from(imageBase64, 'base64');
    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         nombre,
      Body:        buffer,
      ContentType: contentType,
    }));

    return { url: `${R2_PUBLIC_BASE}/${nombre}` };
  }
);

// ─── Listar fotos recientes en R2 (para recuperación de datos) ───────────────
// Solo admin puede llamar esta función. Devuelve las fotos subidas HOY en una carpeta.
exports.r2ListarFotos = onCall(
  { secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY] },
  async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
    const rol = callerSnap.exists ? callerSnap.data().rol : null;
    if (rol !== 'admin') throw new HttpsError('permission-denied', 'Solo admin.');

    const carpeta = (data && data.carpeta) || 'reportesEntrega';
    const prefix  = `fotos/${carpeta}/`;

    const r2 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId:     R2_ACCESS_KEY_ID.value().trim(),
        secretAccessKey: R2_SECRET_ACCESS_KEY.value().trim(),
      },
    });

    const listResp = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, MaxKeys: 200 }));
    const today = new Date().toISOString().slice(0, 10);
    const files = (listResp.Contents || [])
      .filter(obj => obj.LastModified && obj.LastModified.toISOString().startsWith(today))
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .map(obj => ({
        key:      obj.Key,
        url:      `${R2_PUBLIC_BASE}/${obj.Key}`,
        modified: obj.LastModified.toISOString(),
      }));

    return { files };
  }
);

// dailyBackup — guarda en Cloudflare R2 (gratis) una vez al día
exports.dailyBackup = onSchedule(
  { schedule: '0 7 * * *', secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, GMAIL_APP_PASSWORD] },
  async () => {
    try {
    const db = admin.firestore();
    const r2 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID.value().trim(),
        secretAccessKey: R2_SECRET_ACCESS_KEY.value().trim(),
      },
    });

    // Leer meta del último backup para decidir si hacer incremental o completo
    const metaRef = db.collection('_meta').doc('backupInfo');
    const metaSnap = await metaRef.get();
    const meta = metaSnap.exists ? metaSnap.data() : {};
    const lastBackupAt = meta.lastBackupAt || null;  // ISO string del último backup
    const lastKey      = meta.lastKey      || null;  // key R2 del último backup

    // Domingos → backup completo (purga docs eliminados); primer backup → también completo
    const esDomingo = new Date().getUTCDay() === 0;
    let backup;

    if (!lastBackupAt || !lastKey || esDomingo) {
      console.log(`[dailyBackup] Backup COMPLETO (domingo=${esDomingo}, sinHistorial=${!lastBackupAt})`);
      backup = await _leerTodasLasColecciones();
    } else {
      console.log(`[dailyBackup] Backup INCREMENTAL desde: ${lastBackupAt}`);
      let baseBackup = null;
      try {
        const getResp = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: lastKey }));
        const chunks = [];
        for await (const chunk of getResp.Body) chunks.push(chunk);
        baseBackup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        console.log(`[dailyBackup] Base cargada: ${lastKey}`);
      } catch (e) {
        console.warn('[dailyBackup] No se pudo leer backup base, haciendo completo:', e.message);
      }
      if (baseBackup) {
        const lastBackupAtMs = new Date(lastBackupAt).getTime();
        backup = await _leerColeccionesIncrementales(lastBackupAtMs, baseBackup);
      } else {
        backup = await _leerTodasLasColecciones();
      }
    }

    const tsSlug = backup._exportedAt.slice(0, 16).replace('T', '_').replace(':', '-'); // 2026-08-17_14-00
    const key = `${BACKUP_PREFIX}gestpro-${tsSlug}.json`;
    const body = JSON.stringify(backup, null, 2);

    // Guardar backup del día en R2
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }));
    console.log(`[dailyBackup] Backup guardado en R2: ${key}`);

    // Guardar meta para el próximo backup incremental
    await metaRef.set({ lastBackupAt: backup._exportedAt, lastKey: key, updatedAt: Date.now() });

    // Eliminar backups en R2 mayores a BACKUP_KEEP días
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - BACKUP_KEEP);
    const listResp = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: BACKUP_PREFIX }));
    for (const obj of (listResp.Contents || [])) {
      const name = obj.Key.replace(BACKUP_PREFIX, '');
      if (name.startsWith('gestpro-') && new Date(obj.LastModified) < cutoff) {
        await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: obj.Key }));
        console.log(`[dailyBackup] Eliminado de R2: ${obj.Key}`);
      }
    }

    // Limpiar carpeta backups/ de Firebase Storage si aún tiene archivos
    try {
      const bucket = admin.storage().bucket(BACKUP_BUCKET);
      const [files] = await bucket.getFiles({ prefix: BACKUP_PREFIX });
      for (const file of files) {
        await file.delete();
        console.log(`[dailyBackup] Eliminado de Firebase Storage: ${file.name}`);
      }
    } catch (e) {
      console.log('[dailyBackup] Storage ya vacío o error limpiando:', e.message);
    }

    } catch (err) {
      console.error('[dailyBackup] ERROR — backup fallido:', err.message);
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: CORREO_REMITENTE, pass: GMAIL_APP_PASSWORD.value().trim() },
        });
        await transporter.sendMail({
          from: `"GestPro Backups" <${CORREO_REMITENTE}>`,
          to: 'iniguezisrael@gmail.com',
          subject: '⚠️ Backup fallido — GestPro',
          text: `El respaldo automático de GestPro falló el ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}.\n\nError:\n${err.message}\n\nRevisa los logs en Firebase Console para más detalles.`,
        });
        console.log('[dailyBackup] Correo de error enviado.');
      } catch (mailErr) {
        console.error('[dailyBackup] No se pudo enviar correo de error:', mailErr.message);
      }
      throw err;
    }
  }
);

// ── listBackups: lista los respaldos disponibles en R2 ────────────────────────
exports.listBackups = onCall(
  { secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    const r2 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID.value().trim(),
        secretAccessKey: R2_SECRET_ACCESS_KEY.value().trim(),
      },
    });
    const listResp = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: BACKUP_PREFIX }));
    return (listResp.Contents || [])
      .map(obj => ({
        key: obj.Key.replace(BACKUP_PREFIX, ''),
        size: obj.Size,
        lastModified: obj.LastModified,
      }))
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  }
);

// ── downloadBackup: descarga un respaldo específico de R2 ─────────────────────
exports.downloadBackup = onCall(
  { secrets: [R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    const { key } = request.data || {};
    if (!key || typeof key !== 'string' || !key.startsWith('gestpro-'))
      throw new HttpsError('invalid-argument', 'Clave de respaldo inválida.');
    const r2 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID.value().trim(),
        secretAccessKey: R2_SECRET_ACCESS_KEY.value().trim(),
      },
    });
    const resp = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: BACKUP_PREFIX + key }));
    const chunks = [];
    for await (const chunk of resp.Body) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(body);
  }
);

// Descifrado ECMA-376 Agile Encryption (Excel 2013+).
// Usa cfb (dependencia de xlsx) + crypto nativo de Node.js.

function _agileDecrypt(fileBuffer, password) {
  const crypto = require('crypto');
  const CFB = require('cfb');

  const cfb = CFB.read(fileBuffer, { type: 'buffer' });
  const infoEntry = CFB.find(cfb, 'EncryptionInfo');
  const pkgEntry  = CFB.find(cfb, 'EncryptedPackage');
  if (!infoEntry) throw new Error('CFB_NO_ENCRYPTIONINFO');
  if (!pkgEntry)  throw new Error('CFB_NO_ENCRYPTEDPACKAGE');

  const infoBuf = Buffer.from(infoEntry.content);

  // ECMA-376: bytes 0-1 = vMinor, bytes 2-3 = vMajor
  // Agile Encryption: vMinor=4, vMajor=4
  // Standard Encryption: vMinor=2, vMajor=4
  const vMinor = infoBuf.readUInt16LE(0);
  const vMajor = infoBuf.readUInt16LE(2);
  console.log('[_agileDecrypt] EncryptionInfo version vMinor=' + vMinor + ' vMajor=' + vMajor);

  if (vMinor !== 4) {
    throw new Error('ENCRYPTION_NOT_AGILE:vMinor=' + vMinor + ',vMajor=' + vMajor);
  }

  // Bytes 4-7: reservado. XML empieza en byte 8.
  const infoXml = infoBuf.slice(8).toString('utf8');
  console.log('[_agileDecrypt] XML length=' + infoXml.length + ' preview=' + infoXml.slice(0, 120));

  function ga(xml, name) {
    const m = xml.match(new RegExp(name + '="([^"]*)"'));
    return m ? m[1] : null;
  }

  const ekRaw = infoXml.match(/<[a-zA-Z:]*encryptedKey[^>]*/)?.[0] || '';
  const kdRaw = infoXml.match(/<keyData\b[^>]*/)?.[0] || '';

  console.log('[_agileDecrypt] ekRaw length=' + ekRaw.length + ' kdRaw length=' + kdRaw.length);

  const kSaltB64  = ga(ekRaw, 'saltValue');
  const encKeyB64 = ga(ekRaw, 'encryptedKeyValue');
  const encVerHashInputB64  = ga(ekRaw, 'encryptedVerifierHashInput');
  const encVerHashValueB64  = ga(ekRaw, 'encryptedVerifierHashValue');

  console.log('[_agileDecrypt] kSaltB64=' + (kSaltB64 ? kSaltB64.length + 'chars' : 'NULL'));
  console.log('[_agileDecrypt] encKeyB64=' + (encKeyB64 ? encKeyB64.length + 'chars' : 'NULL'));

  if (!kSaltB64 || !encKeyB64) {
    throw new Error('XML_PARSE_FAILED:saltValue=' + !!kSaltB64 + ',encryptedKeyValue=' + !!encKeyB64);
  }

  const kSalt     = Buffer.from(kSaltB64, 'base64');
  const encKeyVal = Buffer.from(encKeyB64, 'base64');
  const spinCount = parseInt(ga(ekRaw, 'spinCount') || '100000', 10);
  const kBits     = parseInt(ga(ekRaw, 'keyBits')   || '256', 10);
  const kBlockSz  = parseInt(ga(ekRaw, 'blockSize') || '16', 10);
  const kHashAlg  = (ga(ekRaw, 'hashAlgorithm') || 'SHA512').replace(/-/g,'').toLowerCase();
  const kCiphAlg  = (ga(ekRaw, 'cipherAlgorithm') || 'AES').toLowerCase();

  const dSalt     = Buffer.from(ga(kdRaw, 'saltValue') || '', 'base64');
  const dBits     = parseInt(ga(kdRaw, 'keyBits')   || '256', 10);
  const dBlockSz  = parseInt(ga(kdRaw, 'blockSize') || '16', 10);
  const dHashAlg  = (ga(kdRaw, 'hashAlgorithm') || 'SHA512').replace(/-/g,'').toLowerCase();
  const dCiphAlg  = (ga(kdRaw, 'cipherAlgorithm') || 'AES').toLowerCase();

  console.log('[_agileDecrypt] kSalt.length=' + kSalt.length + ' encKeyVal.length=' + encKeyVal.length + ' spinCount=' + spinCount + ' kBits=' + kBits);

  function fixLen(buf, len) {
    if (buf.length === 0) throw new Error('FIXLEN_EMPTY_BUFFER');
    const r = Buffer.alloc(len);
    for (let i = 0; i < len; i++) r[i] = buf[i % buf.length];
    return r;
  }

  // H0 = H(salt || UTF16LE(password)), Hi = H(LE32(i) || H_{i-1}), Hfinal = H(Hn || blockKey)
  function deriveKey(salt, spins, hashAlg, pwd, blockKey, keyLen) {
    const pwBuf = Buffer.from(pwd, 'utf16le');
    let h = crypto.createHash(hashAlg).update(salt).update(pwBuf).digest();
    const ib = Buffer.alloc(4);
    for (let i = 0; i < spins; i++) {
      ib.writeUInt32LE(i);
      h = crypto.createHash(hashAlg).update(ib).update(h).digest();
    }
    h = crypto.createHash(hashAlg).update(h).update(blockKey).digest();
    return fixLen(h, keyLen);
  }

  // Bloque key constants ECMA-376 §2.3.4.11
  const BK_KEY    = Buffer.from([0x14,0x6e,0x0b,0xe7,0xab,0xac,0xd0,0xd6]);

  // 1. Derivar clave desde contraseña
  const derivedKey = deriveKey(kSalt, spinCount, kHashAlg, password, BK_KEY, kBits / 8);
  const keyIV = fixLen(kSalt, kBlockSz);

  // 2. Descifrar la clave de archivo
  const dcKey = crypto.createDecipheriv(`${kCiphAlg}-${kBits}-cbc`, derivedKey, keyIV);
  dcKey.setAutoPadding(false);
  const fileKey = Buffer.concat([dcKey.update(encKeyVal), dcKey.final()]).slice(0, dBits / 8);


  // 4. Descifrar el paquete por segmentos de 4096 bytes
  const pkgContent = Buffer.from(pkgEntry.content);
  const decryptedSize = pkgContent.readUInt32LE(0) + pkgContent.readUInt32LE(4) * 4294967296;
  const encData = pkgContent.slice(8);
  const SEG = 4096;
  const segments = [];
  const ib2 = Buffer.alloc(4);

  for (let i = 0; i * SEG < encData.length; i++) {
    const seg = encData.slice(i * SEG, (i + 1) * SEG);
    ib2.writeUInt32LE(i);
    const segIV = fixLen(
      crypto.createHash(dHashAlg).update(dSalt).update(ib2).digest(),
      dBlockSz
    );
    const sd = crypto.createDecipheriv(`${dCiphAlg}-${dBits}-cbc`, fileKey, segIV);
    sd.setAutoPadding(false);
    segments.push(Buffer.concat([sd.update(seg), sd.final()]));
  }

  const result = Buffer.concat(segments).slice(0, decryptedSize);

  // Verificar firma ZIP (50 4B 03 04) — confirma contraseña correcta
  if (result.length < 4 || result[0] !== 0x50 || result[1] !== 0x4B ||
      result[2] !== 0x03 || result[3] !== 0x04) {
    throw new HttpsError('invalid-argument', 'Contraseña incorrecta. Intenta de nuevo.');
  }

  return result;
}

exports.descifrarExcel = onCall({ timeoutSeconds: 300, memory: '2GiB' }, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo administradores pueden usar esta función.');
  }

  const fileBase64 = data && data.fileBase64;
  const password   = (data && data.password) || '';
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'Falta el archivo.');
  }

  try {
    const XLSX = require('xlsx');
    const rawBuffer = Buffer.from(fileBase64, 'base64');

    // Firma CFB (D0 CF 11 E0) = archivo Office cifrado o legado
    const isCFB = rawBuffer[0] === 0xD0 && rawBuffer[1] === 0xCF &&
                  rawBuffer[2] === 0x11 && rawBuffer[3] === 0xE0;
    console.log('[descifrarExcel] isCFB=' + isCFB + ' bufLen=' + rawBuffer.length);

    let workbookBuffer = rawBuffer;
    if (isCFB) {
      try {
        workbookBuffer = _agileDecrypt(rawBuffer, password);
        console.log('[descifrarExcel] Decryption OK, workbookBuffer.length=' + workbookBuffer.length);
      } catch (decErr) {
        // Re-lanzar errores de contraseña incorrecta (HttpsError de la verificación)
        if (decErr instanceof HttpsError) throw decErr;
        const em = decErr.message || '';
        console.error('[descifrarExcel] Decrypt error:', em);
        // Cifrado Standard (no Agile) u otro formato que no soportamos
        if (em.startsWith('ENCRYPTION_NOT_AGILE')) {
          throw new HttpsError('internal', 'El archivo usa cifrado Standard (no Agile). Versión: ' + em.split(':')[1]);
        }
        // Error de parseo XML (formato inesperado)
        if (em.startsWith('XML_PARSE_FAILED') || em.startsWith('CFB_NO_')) {
          throw new HttpsError('internal', 'Formato de cifrado no reconocido: ' + em);
        }
        // Cualquier otro error de crypto → interno (no enmascarar como contraseña incorrecta)
        throw new HttpsError('internal', 'Error al descifrar: ' + em);
      }
    }

    const wb = XLSX.read(workbookBuffer, { type: 'buffer' });
    return _parseWorkbook(wb);

  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[descifrarExcel] Error final:', e.message);
    throw new HttpsError('internal', 'Error al leer el archivo: ' + e.message);
  }
});

function _parseWorkbook(wb) {
  const XLSX = require('xlsx');
  const wsName = wb.SheetNames[0];
  if (!wsName) throw new HttpsError('internal', 'El archivo no tiene hojas.');
  const ws = wb.Sheets[wsName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  if (rawRows.length < 2) return { rows: [] };
  // Detectar la fila real de encabezados: la que tenga más coincidencias con keywords
  const _headerKeywords = ['producto','nombre','material','descrip','concepto','costo','precio','unidad','código','codigo','clave'];
  let _headerIdx = 0;
  let _maxKwMatches = 0;
  for (let _ri = 0; _ri < Math.min(rawRows.length - 1, 20); _ri++) {
    const _row = rawRows[_ri];
    const _cells = _row.filter(c => c != null && String(c).trim() !== '').map(c => String(c).trim().toLowerCase());
    const _kwMatches = _cells.filter(c => _headerKeywords.some(kw => c.includes(kw))).length;
    if (_kwMatches > _maxKwMatches) {
      _maxKwMatches = _kwMatches;
      _headerIdx = _ri;
    }
  }
  const headers = rawRows[_headerIdx].map(h => (h != null ? String(h).trim() : ''));
  const rows = [];
  for (let i = _headerIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    if (rawRow.every(v => v == null || v === '')) continue;
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) rowObj[headers[j]] = rawRow[j] != null ? String(rawRow[j]) : '';
    }
    if (Object.keys(rowObj).length) rows.push(rowObj);
  }
  return { rows };
}
