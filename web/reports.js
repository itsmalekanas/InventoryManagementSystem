'use strict';

/* ---------------- reports ---------------- */

function renderReports() {
  const { invoices, products } = state.db;
  const now = new Date();
  const today = InventoryFinance.summary(invoices, date => isSameDay(new Date(date), now));
  const month = InventoryFinance.summary(invoices, date => { const d = new Date(date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const all = InventoryFinance.summary(invoices);
  const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const stockPieces = products.reduce((s, p) => s + p.stock, 0);
  const low = products.filter(p => p.stock <= lowLimit()).sort((a, b) => a.stock - b.stock);

  // Best sellers, grouped by product. The name shown is the current one
  // when the product still exists, otherwise the name on the last invoice.
  const sold = {};
  for (const inv of invoices) for (const [index, it] of inv.items.entries()) {
    const r = sold[it.productId] || (sold[it.productId] = { name: it.name, qty: 0, total: 0 });
    const qty = it.qty - InventoryFinance.returnedQty(inv, index);
    r.qty += qty; r.total += it.price * qty; r.name = it.name;
  }
  const top = Object.entries(sold)
    .map(([id, r]) => ({ ...r, name: (productById(id) || r).name }))
    .filter(r => r.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.total - a.total)
    .slice(0, 10);

  const card = (icon, title, value, sub) => `<div class="col-sm-6 col-lg-3"><div class="bg-white rounded shadow-sm p-3 h-100">
    <div class="text-secondary"><i class="bi ${icon}"></i> ${esc(title)}</div>
    <div class="fs-4 fw-bold my-1">${value}</div><div class="small text-secondary">${esc(sub)}</div></div></div>`;

  $('#app').innerHTML = `
    ${topbar(t('reports'))}
    <div class="page">
      <div class="row g-3 mb-4">
        ${card('bi-calendar-day', t('today'), money(today.net), t('salesCount', { n: int(today.count) }))}
        ${card('bi-calendar-month', t('thisMonth'), money(month.net), t('salesCount', { n: int(month.count) }))}
        ${card('bi-graph-up', t('allTime'), money(all.net), t('salesCount', { n: int(all.count) }))}
        ${card('bi-box-seam', t('stockValue'), money(stockValue), t('stockPieces', { n: int(stockPieces) }))}
      </div>
      <p class="small text-secondary">${t('netSalesHint')}</p>
      ${state.db.settings.trackProfit ? `<section class="mb-4" id="profit-report">
        <h5>${t('grossProfit')}</h5><p class="text-secondary">${t('profitHint')}</p>
        <div class="row g-3">
          ${[[t('today'), today], [t('thisMonth'), month], [t('allTime'), all]].map(([title, stats]) => card('bi-cash-coin', title, stats.hasCosts ? money(stats.profit) : '—', t('excludedRevenue', { v: moneyText(stats.excluded) }))).join('')}
        </div>
      </section>` : ''}
      <div class="row g-3">
        <div class="col-lg-6"><div class="bg-white rounded shadow-sm p-3 h-100">
          <h6><i class="bi bi-trophy"></i> ${t('topProducts')}</h6>
          ${top.length ? `<table class="table table-sm m-0"><thead><tr><th>${t('product')}</th><th class="text-end">${t('soldQty')}</th><th class="text-end">${t('revenue')}</th></tr></thead>
            <tbody>${top.map(r => `<tr><td><bdi>${esc(r.name)}</bdi></td><td class="text-end num">${int(r.qty)}</td><td class="text-end">${money(r.total)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="text-secondary">${t('nothing')}</div>`}
        </div></div>
        <div class="col-lg-6"><div class="bg-white rounded shadow-sm p-3 h-100">
          <h6><i class="bi bi-exclamation-triangle text-warning"></i> ${t('lowStockList')} (≤ ${int(lowLimit())})</h6>
          ${low.length ? `<table class="table table-sm m-0"><tbody>${low.map(p => `<tr><td><bdi>${esc(p.name)}</bdi></td><td class="text-end">${stockBadge(p)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="text-secondary">${t('nothing')}</div>`}
        </div></div>
      </div>
    </div>`;
}
