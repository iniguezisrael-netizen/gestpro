const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();


const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
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

exports.enviarCorreoMasivo = onCall({ secrets: [GMAIL_APP_PASSWORD] }, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión para hacer esto.');

  const callerSnap = await admin.firestore().collection('roles').doc(auth.uid).get();
  const rol = callerSnap.exists ? callerSnap.data().rol : null;
  if (!['admin', 'secretaria', 'auxiliar'].includes(rol)) {
    throw new HttpsError('permission-denied', 'Solo Administrador, Secretaria o Auxiliar Administrativo pueden enviar correos masivos.');
  }

  const destinatarios = Array.isArray(data && data.destinatarios) ? data.destinatarios : [];
  const asunto = (data && data.asunto || '').trim();
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
    if (!dest || !dest.correo) { errores.push({ correo: '(sin correo)', error: 'Cliente sin correo registrado' }); continue; }
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
  'produccion','catalogoMateriales','clientesCredito','clientes'
];
const BACKUP_BUCKET = 'campers-la-cuesta-84ade.firebasestorage.app';
const BACKUP_PREFIX = 'backups/';
const BACKUP_KEEP   = 30;

async function _leerTodasLasColecciones() {
  const db = admin.firestore();
  const backup = { _exportedAt: new Date().toISOString(), collections: {} };
  for (const col of BACKUP_COLLECTIONS) {
    try {
      const snap = await db.collection(col).doc('data').get();
      backup.collections[col] = snap.exists ? (snap.data().items || []) : [];
    } catch (e) {
      backup.collections[col] = [];
    }
  }
  return backup;
}



// ─── Respaldo diario automático ───────────────────────────────────────────────
// Corre cada día a las 7:00 AM UTC (1:00 AM México). Limpia respaldos > 30 días.
// ─── Proxy de imágenes de Firebase Storage para PDF (evita CORS) ─────────────
// El navegador no puede hacer fetch() a Storage (CORS), pero el servidor sí.
// La función descarga la imagen y la devuelve como base64 para jsPDF.
exports.proxyStorageImg = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const url = data && data.url;
  // Validar que la URL sea del bucket propio del proyecto (no de otro proyecto Firebase).
  const ALLOWED_BUCKET = 'campers-la-cuesta-84ade.firebasestorage.app';
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new HttpsError('invalid-argument', 'URL no válida.'); }
  if (parsedUrl.hostname !== 'firebasestorage.googleapis.com'
      || !parsedUrl.pathname.includes(ALLOWED_BUCKET)) {
    throw new HttpsError('invalid-argument', 'URL no permitida: solo imágenes del bucket de este proyecto.');
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

exports.dailyBackup = onSchedule('0 7 * * *', async () => {
  const bucket = admin.storage().bucket(BACKUP_BUCKET);
  const backup = await _leerTodasLasColecciones();
  const today = backup._exportedAt.slice(0, 10);
  const filename = `${BACKUP_PREFIX}gestpro-${today}.json`;

  await bucket.file(filename).save(JSON.stringify(backup, null, 2), {
    contentType: 'application/json',
    metadata: { cacheControl: 'no-cache' }
  });
  console.log(`[dailyBackup] Backup guardado: ${filename}`);

  const [files] = await bucket.getFiles({ prefix: BACKUP_PREFIX });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BACKUP_KEEP);
  for (const file of files) {
    const [meta] = await file.getMetadata();
    if (new Date(meta.timeCreated) < cutoff) {
      await file.delete();
      console.log(`[dailyBackup] Eliminado: ${file.name}`);
    }
  }
});
