'use strict';

// Use invoice snapshots, never today's product cost, for historical accounting.
const InventoryFinance = (() => {
  function returnedQty(inv, index) {
    return (inv.returns || []).reduce((sum, ret) => sum + ret.items.reduce((n, item) => n + (item.index === index ? item.qty : 0), 0), 0);
  }
  function refundTotal(inv) { return (inv.returns || []).reduce((sum, ret) => sum + ret.total, 0); }
  function netTotal(inv) { return inv.total - refundTotal(inv); }
  function summary(invoices, includes = () => true) {
    const result = { count: 0, gross: 0, refunds: 0, net: 0, profit: 0, excluded: 0, knownQty: 0, hasCosts: false };
    const account = (item, qty) => {
      if (item.costPrice == null) result.excluded += item.price * qty;
      else { result.hasCosts = true; result.profit += (item.price - item.costPrice) * qty; result.knownQty += qty; }
    };
    for (const inv of invoices) {
      if (includes(inv.date)) {
        result.count++;
        result.gross += inv.total;
        for (const item of inv.items) account(item, item.qty);
      }
      for (const ret of inv.returns || []) {
        if (!includes(ret.date)) continue;
        result.refunds += ret.total;
        for (const item of ret.items) account(inv.items[item.index], -item.qty);
      }
    }
    result.net = result.gross - result.refunds;
    return result;
  }
  return { returnedQty, refundTotal, netTotal, summary };
})();
if (typeof module !== 'undefined') module.exports = InventoryFinance;
