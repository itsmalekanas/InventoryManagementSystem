const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../web');
// Follow the browser's actual script order so tests keep covering every screen.
const scripts = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"/]+\.js)"><\/script>/g)].map(match => match[1]);
const source = scripts.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
module.exports = { scripts, source };
