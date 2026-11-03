const { test } = require('node:test');
const assert = require('node:assert/strict');
const colors = require('../web/color-picker.js');

test('color entry accepts full and shorthand hex and rejects malformed values', () => {
  assert.equal(colors.normalize(' #A6E3E1 '), '#a6e3e1');
  assert.equal(colors.normalize('abc'), '#aabbcc');
  for (const value of ['', '#12', '#12345', '#12345678', 'red', '#12zz00']) assert.equal(colors.normalize(value), null);
});

test('color controls preserve exact saved colors including black and white', () => {
  for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#a6e3e1', '#714b67', '#f3edf2', '#808080']) {
    assert.equal(colors.toHex(colors.toHSV(hex)), hex);
  }
  assert.equal(colors.toHex({ h: 120, s: 1, v: 1 }), '#00ff00');
  assert.equal(colors.toHex({ h: 240, s: 0, v: 1 }), '#ffffff');
  assert.equal(colors.toHex({ h: 360, s: 1, v: 1 }), '#ff0000');
});
