const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseWhole, parseInvoiceNumber } = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '../web/numbers.js'), 'utf8') + '\n({parseWhole,parseInvoiceNumber})'
);

test('whole numbers retain Arabic/Persian input and valid thousands groups', () => {
  for (const [input, expected] of [['0',0],['25000',25000],['25,000',25000],['٢٥٬٠٠٠',25000],['۲۵,۰۰۰',25000],['  ١٢٣  ',123],['1,000,000',1000000],['9007199254740991',Number.MAX_SAFE_INTEGER]]) {
    assert.equal(parseWhole(input),expected,input);
  }
});

test('invalid input is rejected rather than converted into another number', () => {
  for (const input of ['', ' ', null, undefined, '-5', '−5', '+5', '12.5', '12٫5', '١٢٫٥', '.5', '5.', '1e3', '1/2', '25 IQD', 'abc5', '1,2', '12,34', '1,,000', '1,000,', '1 2', '25 000', '9,007,199,254,740,992', 'Infinity', 'NaN']) {
    assert.ok(Number.isNaN(parseWhole(input)),String(input));
  }
});

test('invoice numbering uses the same validation and its supported bounds', () => {
  assert.equal(parseInvoiceNumber('٥٠٠'),500);
  assert.equal(parseInvoiceNumber('1,000'),1000);
  assert.equal(parseInvoiceNumber('999999999'),999999999);
  for (const input of ['0','-500','50.5','500abc','1000000000']) assert.equal(parseInvoiceNumber(input),null,input);
});
