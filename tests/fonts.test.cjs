const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('bundled fonts match their pinned sources and include redistribution licenses', () => {
  const root = path.join(__dirname, '../web/vendor/fonts');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'sources.json'), 'utf8'));
  assert.equal(manifest.length, 9);
  for (const entry of manifest) {
    const bytes = fs.readFileSync(path.join(root, entry.file));
    assert.equal(bytes.readUInt32BE(0), 0x00010000, entry.file + ' must be a TrueType font');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), entry.sha256);
    assert.match(entry.source, /githubusercontent\.com\/google\/fonts\/[0-9a-f]{40}\//);
    const license = fs.readFileSync(path.join(root, entry.file.split('-')[0] + '-OFL.txt'), 'utf8');
    assert.match(license, /SIL OPEN FONT LICENSE/);
  }
});
