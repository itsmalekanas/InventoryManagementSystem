const fs = require('node:fs');
const path = require('node:path');
const version = fs.readFileSync(path.join(__dirname, '../VERSION'), 'utf8').trim();
const folder = `Inventory Management System ${version}`;
const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
module.exports = process.platform === 'linux'
  ? path.resolve(__dirname, '../dist', folder + ' linux-' + arch, 'inventory')
  : path.resolve(__dirname, '../dist', folder, folder + '.exe');
