'use strict';

/* ---------------- reports ---------------- */

function downloadReportCsv(rows) {
  const csv = rows.map(row => row.map(value => {
    if (typeof value === 'number') return String(value);
    // Keep spreadsheet programs from evaluating product names as formulas.
    const safe = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
  downloadReport(new Blob(['\uFEFF', csv, '\r\n'], { type: 'text/csv;charset=utf-8' }), 'inventory-report.csv');
}

function downloadReport(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}

function reportDay(date) {
  return [String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

function renderReports() {
  const { invoices, products, settings } = state.db;
  const stockValue = products.reduce((sum, product) => sum + product.price * product.stock, 0);
  const stockPieces = products.reduce((sum, product) => sum + product.stock, 0);
  const threshold = lowLimit();
  const low = products.filter(product => product.stock <= threshold).sort((a, b) => a.stock - b.stock);
  const names = new Map(products.map(product => [product.id, product.name]));
  const presets = ['today', 'thisMonth', 'lastMonth', 'allTime', 'customRange'];

  $('#app').innerHTML = `
    ${topbar(t('reports'))}
    <div class="page">
      <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div><label for="report-range" class="form-label">${t('reportPeriod')}</label>
          <select id="report-range" class="form-select">
            ${presets.map(key => `<option value="${key}" ${key === 'thisMonth' ? 'selected' : ''}>${t(key)}</option>`).join('')}
          </select>
        </div>
        <div id="report-dates" class="flex-wrap gap-2" style="display:none">
          <div><label for="report-from" class="form-label">${t('reportFrom')}</label>
            <input id="report-from" class="form-control" type="date"></div>
          <div><label for="report-to" class="form-label">${t('reportTo')}</label>
            <input id="report-to" class="form-control" type="date"></div>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <button type="button" id="report-excel" class="btn btn-primary"><i class="bi bi-download" aria-hidden="true"></i> ${t('exportReportExcel')}</button>
          <button type="button" id="report-csv" class="btn btn-outline-primary">${t('exportReportCsv')}</button>
        </div>
      </div>
      <p id="report-range-error" class="text-danger" role="status" hidden></p>
      <div id="report-results"></div>
      <section class="mt-4">
        <h5>${t('reportCurrentStock')}</h5>
        <p>${t('reportRetailStockValue')}: ${money(stockValue)} <span class="text-secondary">(${t('stockPieces', { n: int(stockPieces) })})</span></p>
        <h6>${t('lowStockList')} (&le; ${int(threshold)})</h6>
        ${low.length ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>${t('product')}</th><th class="text-end">${t('reportStockQuantity')}</th></tr></thead>
          <tbody>${low.map(product => `<tr><td><bdi>${esc(product.name)}</bdi></td><td class="text-end">${stockBadge(product)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="text-secondary">${t('nothing')}</p>`}
      </section>
    </div>`;

  const range = $('#report-range');
  const from = $('#report-from');
  const to = $('#report-to');
  const excel = $('#report-excel');
  const csv = $('#report-csv');
  const results = $('#report-results');
  const currency = key => `${t(key)} (${t('cur')})`;
  let sheets;
  from.value = reportDay(new Date());
  to.value = from.value;

  function update() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const custom = range.value === 'customRange';
    $('#report-dates').style.display = custom ? 'flex' : 'none';
    const dates = {
      today: [reportDay(now), reportDay(now)],
      thisMonth: [reportDay(new Date(year, month, 1)), reportDay(new Date(year, month + 1, 0))],
      lastMonth: [reportDay(new Date(year, month - 1, 1)), reportDay(new Date(year, month, 0))],
      allTime: ['', ''],
      customRange: [from.value, to.value],
    };
    const [start, end] = dates[range.value];
    const invalid = custom && (!start || !end || from.valueAsNumber > to.valueAsNumber);
    const error = $('#report-range-error');
    error.hidden = !invalid;
    error.textContent = invalid ? t('reportInvalidRange') : '';
    excel.disabled = csv.disabled = invalid;
    if (invalid) {
      sheets = null;
      results.replaceChildren();
      return;
    }

    const includes = value => {
      if (!start) return true;
      const day = reportDay(new Date(value));
      return day >= start && day <= end;
    };
    const stats = InventoryFinance.summary(invoices, includes);
    const sold = new Map();
    const record = (item, qty) => {
      const product = sold.get(item.productId) || { name: item.name, qty: 0, total: 0 };
      product.qty += qty;
      product.total += item.price * qty;
      product.name = names.get(item.productId) || item.name;
      sold.set(item.productId, product);
    };
    for (const invoice of invoices) {
      if (includes(invoice.date)) for (const item of invoice.items) record(item, item.qty);
      for (const refund of invoice.returns || []) {
        if (includes(refund.date)) for (const item of refund.items) record(invoice.items[item.index], -item.qty);
      }
    }
    const top = [...sold.values()].filter(product => product.qty > 0)
      .sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 10);
    const figures = [
      ['reportGrossSales', stats.gross], ['reportRefunds', stats.refunds], ['netSales', stats.net],
      ...(settings.trackProfit ? [
        ['reportRecordedCost', stats.hasCosts ? stats.cost : null],
        ['grossProfit', stats.hasCosts ? stats.profit : null],
        ['reportUnknownCostSales', stats.unknownSales], ['reportUnknownCostRefunds', stats.unknownRefunds],
      ] : []),
    ];
    const reason = entry => t(entry.missingSale && entry.missingRefund ? 'reportSaleAndRefund' :
      entry.missingSale ? 'reportSale' : 'reportRefunds');
    const missing = settings.trackProfit ? stats.missing : [];
    const title = t(range.value);
    results.innerHTML = `
      <h5>${title}${start ? ` <small class="text-secondary"><bdi>${start}${start === end ? '' : ' &ndash; ' + end}</bdi></small>` : ''}</h5>
      <p class="small text-secondary">${t('salesCount', { n: int(stats.count) })}. ${t('netSalesHint')}</p>
      <div class="row g-3 mb-3" ${settings.trackProfit ? 'id="profit-report"' : ''}>
        ${figures.map(([key, value]) => `<div class="col-6 col-lg-3"><div class="bg-white rounded shadow-sm p-3 h-100">
          <div class="text-secondary">${t(key)}</div><div class="fs-5 fw-bold">${value === null ? '&mdash;' : money(value)}</div>
        </div></div>`).join('')}
      </div>
      ${settings.trackProfit ? `<p class="small text-secondary">${t('profitHint')}</p>` : ''}
      ${missing.length ? `<details class="mb-3">
        <summary>${t('reportMissingInvoices', { n: int(missing.length) })}</summary>
        <ul class="mt-2">${missing.map(entry => `<li><a href="#/invoice/${encodeURIComponent(entry.invoice.id)}"><bdi>${esc(invCode(entry.invoice))}</bdi></a> &middot; ${reason(entry)}</li>`).join('')}</ul>
      </details>` : ''}
      <h6>${t('topProducts')}</h6>
      ${top.length ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>${t('product')}</th><th class="text-end">${t('soldQty')}</th><th class="text-end">${t('revenue')}</th></tr></thead>
        <tbody>${top.map(product => `<tr><td><bdi>${esc(product.name)}</bdi></td><td class="text-end num">${int(product.qty)}</td><td class="text-end">${money(product.total)}</td></tr>`).join('')}</tbody>
      </table></div>` : `<p class="text-secondary">${t('nothing')}</p>`}`;

    sheets = [
      { name: t(settings.trackProfit ? 'reportSalesProfit' : 'netSales'), rows: [
        [t('reportPeriod'), t('reportFrom'), t('reportTo'), t('reportInvoiceCount'), ...figures.map(([key]) => currency(key))],
        [title, start, end, stats.count, ...figures.map(([, value]) => value ?? '')],
      ] },
      { name: t('reportCurrentStock'), rows: [[currency('reportRetailStockValue'), t('reportStockQuantity')], [stockValue, stockPieces]] },
      { name: t('topProducts'), filter: top.length > 0, rows: [
        [t('product'), t('soldQty'), currency('revenue')], ...top.map(product => [product.name, product.qty, product.total]),
      ] },
      { name: t('lowStockList'), filter: low.length > 0, rows: [
        [t('product'), t('reportStockQuantity')], ...low.map(product => [product.name, product.stock]),
      ] },
    ];
    if (missing.length) sheets.push({ name: t('reportMissingCosts'), filter: true, rows: [
      [t('reportInvoice'), t('reportMissingCosts')], ...missing.map(entry => [String(invCode(entry.invoice)), reason(entry)]),
    ] });
  }

  range.addEventListener('change', update);
  from.addEventListener('input', update);
  to.addEventListener('input', update);
  csv.addEventListener('click', () => {
    if (sheets) downloadReportCsv(sheets.flatMap((sheet, index) => index ? [[], [sheet.name], ...sheet.rows] : sheet.rows));
  });
  excel.addEventListener('click', () => {
    if (sheets) downloadReport(reportWorkbook(sheets, document.documentElement.dir === 'rtl'), 'inventory-report.xlsx');
  });
  update();
}
