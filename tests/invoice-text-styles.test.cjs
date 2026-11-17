const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = require('./frontend-source.cjs').source;
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const invoiceTextGroups'), source.indexOf('function invoiceHtml')), context);

test('old layouts retain sizes and emphasis while using IBM Plex Sans', () => {
  const layout = context.a4Layout({ a4Layout: { font: 'serif', fontSize: 19, storeSize: 31, emphasis: 'headings' } });
  assert.equal(layout.fontSize, 19);
  assert.equal(layout.storeSize, 31);
  assert.equal(layout.englishFont, 'ibmplexsans');
  assert.equal(layout.arabicFont, 'ibmplexsansarabic');
  assert.equal(layout.emphasis, 'headings');
  assert.equal(JSON.stringify(layout.textStyles), '{}');
});

test('retired font layouts render as IBM Plex Sans without changing stored settings', () => {
  const saved = { a4Layout: { englishFont: 'googlesans', arabicFont: 'cairo', fontSize: 18 } };
  const layout = context.a4Layout(saved);
  assert.equal(layout.englishFont, 'ibmplexsans');
  assert.equal(layout.arabicFont, 'ibmplexsansarabic');
  assert.equal(layout.fontSize, 18);
  assert.equal(saved.a4Layout.englishFont, 'googlesans');
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
