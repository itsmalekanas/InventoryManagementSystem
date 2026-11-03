const { test } = require('node:test');
const assert = require('node:assert/strict');
const finance = require('../web/finance.js');

test('legacy sales remain unchanged and unknown costs are excluded', () => {
  const inv = { date: '2026-10-01', total: 100, items: [{ price: 50, qty: 2 }] };
  const report = finance.summary([inv]);
  assert.equal(report.net, 100); assert.equal(report.profit, 0);
  assert.equal(report.excluded, 100); assert.equal(report.knownQty, 0);
});

test('profit includes known zero costs and losses, with refunds on their own dates', () => {
  const inv = { date: '2026-10-01', total: 180, items: [
    { price: 50, costPrice: 30, qty: 2 },
    { price: 20, costPrice: 0, qty: 1 },
    { price: 10, costPrice: 15, qty: 1 },
    { price: 50, qty: 1 },
  ], returns: [{ date: '2026-11-03', total: 100, items: [{ index: 0, qty: 1 }, { index: 3, qty: 1 }] }] };
  const all = finance.summary([inv]);
  assert.equal(all.net, 80); assert.equal(all.profit, 35); assert.equal(all.excluded, 0);
  const day = finance.summary([inv], date => date === '2026-11-03');
  assert.equal(day.count, 0); assert.equal(day.net, -100); assert.equal(day.profit, -20); assert.equal(day.excluded, -50);
  assert.equal(finance.returnedQty(inv, 0), 1); assert.equal(finance.netTotal(inv), 80);
});

test('fully refunded known-cost sales report zero profit with known coverage', () => {
  const report = finance.summary([{ date: '2026-11-03', total: 100,
    items: [{ price: 100, costPrice: 60, qty: 1 }],
    returns: [{ date: '2026-11-03', total: 100, items: [{ index: 0, qty: 1 }] }],
  }]);
  assert.equal(report.hasCosts, true); assert.equal(report.profit, 0); assert.equal(report.net, 0);
});
