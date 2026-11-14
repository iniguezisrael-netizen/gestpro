const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VENTA_ID = 13888237;
const VENTA_TOTAL = 7076;
const PROJECT = 'campers-la-cuesta-84ade';

function firebaseUpdate(dbPath, data) {
  const tmpFile = path.join(__dirname, '_fixtmp.json');
  fs.writeFileSync(tmpFile, JSON.stringify(data));
  // Sintaxis correcta: firebase database:update <path> <infile> --project ...
  const result = execSync(
    `firebase database:update ${dbPath} ${tmpFile} --project ${PROJECT} --force`,
    { encoding: 'utf8', cwd: __dirname }
  );
  console.log(result);
  fs.unlinkSync(tmpFile);
}

console.log('Buscando cobranza...');
const cobRaw = execSync(`firebase database:get /db/cobranza --project ${PROJECT}`, { encoding: 'utf8' });
const cobranza = JSON.parse(cobRaw.trim());

if (!cobranza) { console.error('cobranza null'); process.exit(1); }

const entradas = Object.entries(cobranza);
const matches = entradas.filter(([k,v]) => v && (
  String(v.ventaId) === String(VENTA_ID) ||
  String(v.pedido || '').includes('219') ||
  String(v.folioPedido || '').includes('219')
));

console.log('Encontradas: ' + matches.length);
matches.forEach(([k,v]) => console.log('  key=' + k + ' pedido=' + (v.pedido||'') + ' total=$' + v.total + ' ventaId=' + v.ventaId));

if (matches.length === 0) { console.log('Sin resultados.'); process.exit(0); }

const [cobKey, cobEntry] = matches[0];
console.log('\nCobranza key=' + cobKey + ' total=$' + cobEntry.total + ' (correcto: $' + VENTA_TOTAL + ')');

if (cobEntry.total !== VENTA_TOTAL) {
  console.log('Actualizando total cobranza...');
  firebaseUpdate('/db/cobranza/' + cobKey, { total: VENTA_TOTAL });
  console.log('OK total=$' + VENTA_TOTAL);
} else {
  console.log('Total ya correcto.');
}

console.log('Linkeando cobranzaId=' + cobEntry.id + ' en venta...');
firebaseUpdate('/db/ventas/' + VENTA_ID, { cobranzaId: cobEntry.id });
console.log('LISTO. cobranzaId=' + cobEntry.id + ' guardado en venta ' + VENTA_ID);
