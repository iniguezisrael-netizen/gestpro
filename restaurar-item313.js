/**
 * restaurar-item313.js
 * Restaura las fotos del item 313 (Nissan dob cab 94/15) en Firestore
 * usando el access_token de firebase-tools.json
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const PROJECT  = 'campers-la-cuesta-84ade';
const LOG_FILE = path.join(__dirname, 'restaurar-item313.log');

function log(...args) {
  const line = args.join(' ') + '\n';
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}
try { fs.writeFileSync(LOG_FILE, ''); } catch(_) {}

// Datos del item 313 recuperados del backup 2026-07-08_16-17-45.json
const ITEM_313 = {
  "estado": "Disponible",
  "especTipo": "",
  "especUnidad": "",
  "especObservaciones": "",
  "fotos": [
    "https://firebasestorage.googleapis.com/v0/b/campers-la-cuesta-84ade.firebasestorage.app/o/fotos%2Fconsignacion%2Ffoto_1783436158071_vyefcg.jpg?alt=media&token=7a02efea-48ec-4f00-9416-edf65872ee32",
    "https://firebasestorage.googleapis.com/v0/b/campers-la-cuesta-84ade.firebasestorage.app/o/fotos%2Fconsignacion%2Ffoto_1783436223914_toa2ej.jpg?alt=media&token=bf046422-dd67-4ccc-b51a-06b1ae8b63a2",
    "https://firebasestorage.googleapis.com/v0/b/campers-la-cuesta-84ade.firebasestorage.app/o/fotos%2Fconsignacion%2Ffoto_1783436030913_2zwvl2.jpg?alt=media&token=636e9510-7432-4f9a-996a-419f1226ceea",
    "https://firebasestorage.googleapis.com/v0/b/campers-la-cuesta-84ade.firebasestorage.app/o/fotos%2Fconsignacion%2Ffoto_1783436229633_5jy61p.jpg?alt=media&token=0691c791-c581-424e-8690-8f290579b6f2",
    "https://firebasestorage.googleapis.com/v0/b/campers-la-cuesta-84ade.firebasestorage.app/o/fotos%2Fconsignacion%2Ffoto_1783436171925_5s1bml.jpg?alt=media&token=7e96435a-9413-496a-b0df-77a9f820d36f"
  ],
  "celular": "",
  "clienteNombre": "",
  "direccion": "",
  "folio": "Ter1100255138",
  "ciudad": "",
  "fecha": "2026-07-07",
  "precioPublico": 0,
  "id": 313,
  "telFijo": "",
  "lugar": "",
  "clienteApellido": "",
  "colonia": "",
  "cantidad": 1,
  "categoria": "",
  "producto": "Nissan dob cab 94/15",
  "valor": 0,
  "desc": "",
  "especForro": "",
  "barcode": "",
  "especColor": "",
  "notas": "",
  "cestado": ""
};

function httpsRequest(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (data) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: reqHeaders
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function getAccessToken() {
  const credPaths = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
  ];
  for (const p of credPaths) {
    if (!fs.existsSync(p)) continue;
    try {
      const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
      const at = creds?.tokens?.access_token;
      if (at) {
        log('Token encontrado en:', p);
        return at;
      }
    } catch(_) {}
  }
  throw new Error('No se encontró access_token. Ejecuta: firebase login');
}

// Convierte un valor JS a formato Firestore REST API
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Convierte valor Firestore REST a JS
function fromFirestoreValue(fv) {
  if (fv.nullValue !== undefined) return null;
  if (fv.booleanValue !== undefined) return fv.booleanValue;
  if (fv.integerValue !== undefined) return Number(fv.integerValue);
  if (fv.doubleValue !== undefined) return fv.doubleValue;
  if (fv.stringValue !== undefined) return fv.stringValue;
  if (fv.arrayValue !== undefined) return (fv.arrayValue.values || []).map(fromFirestoreValue);
  if (fv.mapValue !== undefined) {
    const obj = {};
    for (const [k, v] of Object.entries(fv.mapValue.fields || {})) obj[k] = fromFirestoreValue(v);
    return obj;
  }
  if (fv.timestampValue !== undefined) return fv.timestampValue;
  return null;
}

async function main() {
  const token = getAccessToken();
  const authHeader = { Authorization: `Bearer ${token}` };

  // GET documento consignacion/data
  const getUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/consignacion/data`;
  log('Leyendo consignacion/data de Firestore...');
  const getResp = await httpsRequest('GET', getUrl, null, authHeader);
  log('GET status:', getResp.status);

  if (getResp.status !== 200) {
    log('ERROR al leer Firestore:', getResp.body.slice(0, 400));
    return;
  }

  const doc = JSON.parse(getResp.body);
  const itemsField = doc.fields?.items;
  if (!itemsField) {
    log('ERROR: el documento no tiene campo "items"');
    return;
  }

  const items = fromFirestoreValue(itemsField);
  log(`Total items en Firestore: ${items.length}`);

  // Buscar item 313
  const idx = items.findIndex(i => i.id == 313);
  if (idx === -1) {
    log('Item 313 NO encontrado en Firestore. Agregando...');
    items.push(ITEM_313);
  } else {
    log(`Item 313 encontrado en índice ${idx}`);
    log('Fotos actuales:', JSON.stringify(items[idx].fotos));
    log('Fotos del backup:', ITEM_313.fotos.length, 'fotos');

    // Preservar datos existentes, solo restaurar fotos si están vacías
    if (!items[idx].fotos || items[idx].fotos.length === 0) {
      log('Restaurando fotos (estaban vacías)...');
      items[idx].fotos = ITEM_313.fotos;
    } else {
      log('El item ya tiene fotos. Sobreescribiendo con las del backup...');
      items[idx].fotos = ITEM_313.fotos;
    }
  }

  // PATCH de vuelta a Firestore
  log('\nEscribiendo de vuelta a Firestore...');
  const patchUrl = `${getUrl}?updateMask.fieldPaths=items`;
  const patchBody = {
    fields: {
      items: toFirestoreValue(items)
    }
  };

  const patchResp = await httpsRequest('PATCH', patchUrl, patchBody, authHeader);
  log('PATCH status:', patchResp.status);

  if (patchResp.status === 200) {
    log('\n✓ Item 313 restaurado exitosamente en Firestore.');
    log('Fotos restauradas:', ITEM_313.fotos.length);
  } else {
    log('ERROR en PATCH:', patchResp.body.slice(0, 600));
  }
}

main().catch(e => log('ERROR:', e.message));
