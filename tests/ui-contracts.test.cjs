const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const translations = source.slice(source.indexOf('const I18N'), source.indexOf('const state'));

test('English and Arabic provide the same messages and placeholder names', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(translations + ';globalThis.dict = I18N;', context);
  const { en, ar } = context.dict;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  const slots = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(en)) assert.deepEqual(slots(en[key]), slots(ar[key]), key);
  for (const file of ['app.js', 'checkout.js']) {
    const script = fs.readFileSync(path.join(__dirname, '../web', file), 'utf8');
    for (const match of script.matchAll(/\bt\(\s*(['"])(.*?)\1/g)) {
      assert.ok(Object.hasOwn(en, match[2]), `Missing translation ${match[2]} in ${file}`);
    }
  }
});

test('Home renders actual customer and invoice counts in both languages', () => {
  const elements = {};
  const state = { db: { settings: { language: 'en', storeName: 'Test', theme: 'light' }, products: [], customers: [], invoices: [] }, appVersion: 'test' };
  const context = { state, $: selector => elements[selector] || (elements[selector] = {}), $$: () => [],
    InventoryFinance: { summary: () => ({ net: 0 }) }, lowLimit: () => 5, moneyText: String, int: String, exitApp: () => {} };
  vm.createContext(context);
  vm.runInContext(translations + source.slice(source.indexOf('function lang()'), source.indexOf('// Escapes text')) +
    source.slice(source.indexOf('function renderHome()'), source.indexOf('async function exitApp()')), context);
  for (const language of ['en', 'ar']) for (const count of [0, 3]) {
    state.db.settings.language = language;
    state.db.customers = Array.from({ length: count }, () => ({}));
    state.db.invoices = Array.from({ length: count + 1 }, () => ({}));
    context.renderHome();
    const html = elements['#app'].innerHTML;
    assert.doesNotMatch(html, /\{\w+\}/);
    assert.ok(html.includes(context.t('customersSub', { n: String(count) })));
    assert.ok(html.includes(context.t('invoicesSub', { n: String(count + 1) })));
  }
});
