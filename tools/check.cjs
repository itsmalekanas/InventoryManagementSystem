// Shared developer/CI checks. Uses explicit files so Windows needs no shell glob.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
run('go', ['test', './...']);
run('go', ['vet', './...']);
for (const file of fs.readdirSync('web').filter(name => name.endsWith('.js')).sort()) {
  run(process.execPath, ['--check', path.join('web', file)]);
}
run(process.execPath, ['--test', ...fs.readdirSync('tests').filter(name => name.endsWith('.test.cjs')).sort().map(file => path.join('tests', file))]);
