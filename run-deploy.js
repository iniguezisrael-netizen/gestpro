// Script auxiliar: ejecuta firebase deploy respondiendo "y" a cualquier prompt
const { spawn } = require('child_process');
const fs = require('fs');

const log = fs.createWriteStream('deploy-log.txt');
const proc = spawn('firebase', ['deploy', '--only', 'functions,hosting', '--project', 'campers-la-cuesta-84ade'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  cwd: 'C:\\Users\\israe\\Downloads\\firebase-deploy',
  env: { ...process.env, FORCE_COLOR: '1' }
});

proc.stdin.write('y\n');
setTimeout(() => { try { proc.stdin.write('y\n'); } catch(e){} }, 5000);
setTimeout(() => { try { proc.stdin.write('y\n'); } catch(e){} }, 15000);
setTimeout(() => { try { proc.stdin.write('y\n'); } catch(e){} }, 30000);
setTimeout(() => { try { proc.stdin.write('y\n'); proc.stdin.end(); } catch(e){} }, 60000);

proc.stdout.pipe(log);
proc.stderr.pipe(log);

proc.on('close', (code) => {
  fs.appendFileSync('deploy-log.txt', '\n=== Deploy terminado, código: ' + code + ' ===\n');
  process.exit(code);
});
