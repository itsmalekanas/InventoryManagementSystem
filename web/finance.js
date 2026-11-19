'use strict';

// Use invoice snapshots, never today's product cost, for historical accounting.
const InventoryFinance = (() => {
  function returnedQty(inv, index) {
    return (inv.returns || []).reduce((sum, ret) => sum + ret.items.reduce((n, item) => n + (item.index === index ? item.qty : 0), 0), 0);
  }
  function refundTotal(inv) { return (inv.returns || []).reduce((sum, ret) => sum + ret.total, 0); }
  function netTotal(inv) { return inv.total - refundTotal(inv); }
  function summary(invoices, includes = () => true) {
    const result = { count: 0, gross: 0, refunds: 0, net: 0, cost: 0, profit: 0, excluded: 0,
      unknownSales: 0, unknownRefunds: 0, knownQty: 0, hasCosts: false, missing: [] };
    const account = (item, qty) => {
      if (item.costPrice == null) {
        if (qty > 0) result.unknownSales += item.price * qty;
        else result.unknownRefunds -= item.price * qty;
        return false;
      }
      result.hasCosts = true;
      result.cost += item.costPrice * qty;
      result.profit += (item.price - item.costPrice) * qty;
      result.knownQty += qty;
      return true;
    };
    for (const inv of invoices) {
      let missingSale = false;
      let missingRefund = false;
      if (includes(inv.date)) {
        result.count++;
        result.gross += inv.total;
        for (const item of inv.items) if (!account(item, item.qty)) missingSale = true;
      }
      for (const ret of inv.returns || []) {
        if (!includes(ret.date)) continue;
        result.refunds += ret.total;
        for (const item of ret.items) if (!account(inv.items[item.index], -item.qty)) missingRefund = true;
      }
      if (missingSale || missingRefund) result.missing.push({ invoice: inv, missingSale, missingRefund });
    }
    result.net = result.gross - result.refunds;
    result.excluded = result.unknownSales - result.unknownRefunds;
    return result;
  }
  return { returnedQty, refundTotal, netTotal, summary };
})();
if (typeof module !== 'undefined') module.exports = InventoryFinance;
