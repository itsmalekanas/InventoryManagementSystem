const fs = require('node:fs');
const path = require('node:path');
const version = fs.readFileSync(path.join(__dirname, '../VERSION'), 'utf8').trim();
const folder = `Inventory Management System ${version}`;
if (process.arch !== 'x64') throw new Error('Test executables support Intel/AMD 64-bit systems only.');
module.exports = process.platform === 'linux'
  ? path.resolve(__dirname, '../dist', folder + ' linux-amd64', 'inventory')
  : path.resolve(__dirname, '../dist', folder, folder + '.exe');
