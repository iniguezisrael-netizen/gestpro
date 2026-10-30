// fix-caja-saldo.js — Actualiza el saldo de la caja activa a $3,094
// Uso: node fix-caja-saldo.js
// Requiere Node 18+ (fetch nativo) o Node 16+ con node-fetch instalado

const readline = require('readline');

const API_KEY    = 'AIzaSyBDweepw3IwglqJw4xddDg_JYKqZGj4R1Q';
const PROJECT_ID = 'campers-la-cuesta-84ade';
const NUEVO_SALDO = 3094;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  const email = await ask('Email del admin: ');
  const pass  = await ask('Contraseña: ');
  rl.close();

  // 1. Sign in
  console.log('\nAutenticando...');
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Referer': 'https://sistemas.camperslacuesta.com', 'Origin': 'https://sistemas.camperslacuesta.com' },
      body: JSON.stringify({ email, password: pass, returnSecureToken: true })
    }
  );
  const auth = await authRes.json();
  if (!auth.idToken) {
    console.error('Error de autenticación:', auth.error?.message || JSON.stringify(auth));
    process.exit(1);
  }
  const token = auth.idToken;
  const nombre = auth.displayName || email;
  console.log('Autenticado como:', nombre);

  // 2. Leer colección cajas
  console.log('Buscando cajas abiertas...');
  const cajasRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/cajas?pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const cajasData = await cajasRes.json();
  const docs = cajasData.documents || [];

  // Filtrar: cerrada == false/undefined
  const abiertas = docs.filter(d => {
    const fields = d.fields || {};
    const cerrada = fields.cerrada?.booleanValue;
    return !cerrada;
  });

  if (abiertas.length === 0) {
    console.error('No hay cajas abiertas.');
    process.exit(1);
  }

  // Mostrar cajas disponibles
  console.log(`\nCajas abiertas encontradas (${abiertas.length}):`);
  abiertas.forEach((d, i) => {
    const f = d.fields || {};
    const usuario = f.usuario?.stringValue || '?';
    const saldo   = f.saldo?.doubleValue ?? f.saldo?.integerValue ?? '?';
    const id      = d.name.split('/').pop();
    console.log(`  [${i}] id=${id} | usuario=${usuario} | saldo=$${saldo}`);
  });

  // Si solo hay una, usar esa; si hay varias, preguntar
  let target;
  if (abiertas.length === 1) {
    target = abiertas[0];
  } else {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const idx = await new Promise(r => rl2.question('\n¿Cuál índice actualizar? ', r));
    rl2.close();
    target = abiertas[parseInt(idx, 10)];
    if (!target) { console.error('Índice inválido'); process.exit(1); }
  }

  const docId   = target.name.split('/').pop();
  const usuario = target.fields?.usuario?.stringValue || '?';
  console.log(`\nActualizando caja id=${docId} (${usuario}) → saldo=$${NUEVO_SALDO}...`);

  // 3. PATCH saldo (updateMask para no tocar otros campos)
  const patchRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/cajas/${docId}?updateMask.fieldPaths=saldo`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          saldo: { doubleValue: NUEVO_SALDO }
        }
      })
    }
  );

  if (!patchRes.ok) {
    const err = await patchRes.json();
    console.error('Error al actualizar:', JSON.stringify(err, null, 2));
    process.exit(1);
  }

  console.log(`✓ Saldo actualizado a $${NUEVO_SALDO} correctamente.`);
}

main().catch(e => { console.error(e); process.exit(1); });
