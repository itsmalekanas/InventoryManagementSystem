const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const invoiceTextGroups'), source.indexOf('function invoiceHtml')), context);

test('old layouts retain their original numeric and font defaults without text overrides', () => {
  const layout = context.a4Layout({ a4Layout: { font: 'serif', fontSize: 19, storeSize: 31, emphasis: 'headings' } });
  assert.equal(layout.fontSize, 19);
  assert.equal(layout.storeSize, 31);
  assert.equal(layout.englishFont, 'georgia');
  assert.equal(layout.emphasis, 'headings');
  assert.equal(JSON.stringify(layout.textStyles), '{}');
});

test('text styles admit supported values only and cannot inject printable CSS', () => {
  const styles = context.invoiceTextStyles({
    labels: { size: 14, weight: 700, color: '#123456' },
    values: { size: 99, weight: 600, color: '#123456;display:none' },
    totals: { size: 22, weight: 500 },
    unknown: { color: '#abcdef' },
  });
  assert.equal(JSON.stringify(styles), JSON.stringify({ labels: { size: 14, weight: 700, color: '#123456' }, totals: { size: 22, weight: 500 } }));
});
