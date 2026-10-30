const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
const marker = 'window.doLogin = doLogin;';
const idx = c.indexOf(marker);
if(idx === -1){ console.log('marker no encontrado'); process.exit(1); }
const fns = ['eliminarBodega','enviarCorreoCotiz','enviarWhatsApp','forceSyncDashboard','generarBarcode','generarQRItem','guardarFactura','handleFotoUpload','handleFotoDrop','handleFotoUploadC'];
const lines = fns.map(f => `  window.${f} = typeof ${f} !== 'undefined' ? ${f} : undefined;`).join('\n');
const insertAfter = idx + marker.length;
c = c.slice(0, insertAfter) + '\n' + lines + c.slice(insertAfter);
fs.writeFileSync('index.html', c);
console.log('Listo');
