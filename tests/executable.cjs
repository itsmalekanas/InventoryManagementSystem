const fs = require('node:fs');
const path = require('node:path');
const version = fs.readFileSync(path.join(__dirname, '../VERSION'), 'utf8').trim();
const folder = `Inventory Management System ${version}`;
module.exports = path.resolve(__dirname, '../dist', folder, folder + '.exe');
