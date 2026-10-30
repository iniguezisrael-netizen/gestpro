// Descarga el backup más reciente desde Cloudflare R2 (ya no usa Firebase Storage)
const https = require('https');
const fs = require('fs');
const path = require('path');

// URL pública del backup más reciente en R2
// El dailyBackup guarda en: backups/gestpro-YYYY-MM-DD.json
// Para descargar, busca el más reciente listando el bucket o usa la URL directa del día.
const R2_PUBLIC_BASE = 'https://pub-2661113d195648a2bb72e8015b05fd3f.r2.dev';

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''; res.on('data', d => data += d); res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  // Intenta descargar el backup de los últimos 7 días (de más reciente a más antiguo)
  let fileResp = null;
  let foundDate = null;
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const url = `${R2_PUBLIC_BASE}/backups/gestpro-${dateStr}.json`;
    console.log(`Probando: ${url}`);
    const resp = await httpsGet(url);
    if (resp.status === 200) { fileResp = resp; foundDate = dateStr; break; }
  }

  if (!fileResp) {
    console.error('No se encontró backup en R2 de los últimos 7 días.');
    console.error('Verifica que dailyBackup haya corrido al menos una vez.');
    process.exit(1);
  }

  // Guardar con timestamp
  const ts = new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-');
  const outPath = path.join(__dirname, `gestpro-datos-${ts}.json`);
  fs.writeFileSync(outPath, fileResp.body, 'utf8');

  const data = JSON.parse(fileResp.body);
  console.log(`\n✅ Backup del ${foundDate} guardado en: ${outPath}`);
  console.log('Exportado en:', data._exportedAt || '(sin timestamp)');
  const cols = Object.keys(data).filter(k => !k.startsWith('_'));
  cols.forEach(k => {
    const v = data[k];
    console.log(`  ${k}: ${Array.isArray(v) ? v.length + ' registros' : '(objeto)'}`);
  });
  console.log('\nListo. Guarda ese archivo en un lugar seguro.');
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1); });
