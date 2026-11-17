'use strict';

/* ---------------- invoices ---------------- */

function renderInvoices(customerId) {
  let q = '';
  const cust = customerId && state.db.customers.find(c => c.id === customerId);
  $('#app').innerHTML = `
    ${topbar(t('invoices'))}
    <div class="page">
      ${customerId ? `<div class="alert alert-light border d-flex align-items-center">
        <i class="bi bi-person me-2"></i><span>${t('filterCustomer', { name: `<bdi>${esc(cust ? cust.name : '')}</bdi>` })}</span>
        <a href="#/invoices" class="ms-auto">${t('showAll')}</a></div>` : ''}
      <div class="input-group mb-3">
        <span class="input-group-text"><i class="bi bi-search"></i></span>
        <input class="form-control" id="i-search" placeholder="${esc(t('search'))}" dir="auto">
      </div>
      <div id="i-table"></div>
    </div>`;
  const draw = () => {
    const list = state.db.invoices
      .filter(i => !customerId || i.customerId === customerId)
      .filter(i => matches(q.replace(/^#/, ''), invCode(i), i.customerName, i.customerPhone, normPhone(i.customerPhone)))
      .sort((a, b) => b.number - a.number);
    if (!list.length) {
      $('#i-table').innerHTML = `<div class="text-center text-secondary p-5">${state.db.invoices.length ? t('noResults') : t('noInvoices')}</div>`;
      return;
    }
    const sum = list.reduce((s, i) => s + i.total, 0);
    $('#i-table').innerHTML = `<div class="table-responsive bg-white rounded shadow-sm"><table class="table table-hover table-click align-middle m-0">
      <thead><tr><th>#</th><th>${t('date')}</th><th>${t('customer')}</th><th>${t('phone')}</th><th class="text-end">${t('pcs')}</th><th class="text-end">${t('total')}</th></tr></thead>
      <tbody>${list.map(i => `<tr data-id="${esc(i.id)}">
        <td class="num fw-semibold"><span dir="ltr">${esc(invCode(i))}</span></td>
        <td class="num"><span dir="ltr">${fmtDate(i.date)}</span></td>
        <td><bdi>${esc(i.customerName)}</bdi></td>
        <td class="num"><span dir="ltr">${esc(i.customerPhone)}</span></td>
        <td class="text-end num">${int(i.items.reduce((s, it) => s + it.qty, 0))}</td>
        <td class="text-end fw-semibold">${money(i.total)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr class="table-light"><td colspan="5">${esc(t('shown', { n: int(list.length) }))}</td><td class="text-end fw-bold">${money(sum)}</td></tr></tfoot>
    </table></div>`;
    $$('#i-table tbody tr').forEach(r => r.onclick = () => { location.hash = '#/invoice/' + r.dataset.id; });
  };
  $('#i-search').oninput = e => { q = e.target.value; draw(); };
  draw();
}

// The printed invoice number, e.g. INV-HS-2026-00001 (set by the program).
function invCode(inv) { return inv.code || String(inv.number); }

// What the next invoice will be called; only used for the settings preview.
function invoiceNumbering() {
  if (state.numbering) return state.numbering;
  const y = new Date().getFullYear();
  const used = (state.db.yearCounters || {})[y] || 0;
  return { year: y, nextNumber: used + 1 };
}
function formatInvoiceCode(year, number) { return `INV-HS-${year}-${String(number).padStart(5, '0')}`; }
function nextInvoiceCode() { const n = invoiceNumbering(); return formatInvoiceCode(n.year, n.nextNumber); }

// Builds the printable invoice. Used by the invoice page and the settings preview.
const invoiceTextGroups = ['store', 'title', 'labels', 'values', 'tableHeadings', 'rows', 'totals', 'header', 'footer'];

function invoiceTextStyles(styles) {
  const result = {};
  for (const key of invoiceTextGroups) {
    const source = styles?.[key] || {}, style = {};
    if (Number.isInteger(source.size) && source.size >= 8 && source.size <= 48) style.size = source.size;
    if ([400, 500, 700].includes(source.weight)) style.weight = source.weight;
    if (/^#[0-9a-fA-F]{6}$/.test(source.color || '')) style.color = source.color;
    if (Object.keys(style).length) result[key] = style;
  }
  return result;
}

function a4Layout(s) {
  const v = s.a4Layout || {};
  const number = (key, fallback, min, max) => Number.isInteger(v[key]) && v[key] >= min && v[key] <= max ? v[key] : fallback;
  return { textStyles: invoiceTextStyles(v.textStyles), margin: number('margin', 12, 5, 30), fontSize: number('fontSize', 16, 10, 22),
    storeSize: number('storeSize', 24, 14, 40), titleSize: number('titleSize', 21, 14, 36),
    headerGap: number('headerGap', 16, 0, 48), footerGap: number('footerGap', 24, 0, 48),
    font: ['system', 'sans', 'serif'].includes(v.font) ? v.font : 'system',
    englishFont: 'ibmplexsans',
    arabicFont: 'ibmplexsansarabic',
    emphasis: v.emphasis === 'headings' ? 'headings' : 'regular',
    headerAlign: ['start', 'center', 'end'].includes(v.headerAlign) ? v.headerAlign : 'center',
    footerAlign: ['start', 'center', 'end'].includes(v.footerAlign) ? v.footerAlign : 'center' };
}

function invoiceHtml(inv, s) {
  const layout = a4Layout(s);
  const textStyle = key => {
    if (s.paper === 'receipt') return '';
    const style = layout.textStyles[key];
    if (!style) return '';
    return `style="${style.size ? `font-size:${style.size}px;` : ''}${style.weight ? `font-weight:${style.weight};` : ''}${style.color ? `color:${style.color};` : ''}"`;
  };
  const align = ['start', 'center', 'end'].includes(s.logoAlign) ? s.logoAlign : 'center';
  const showName = s.showStoreName && s.storeName;
  const headText = (showName ? `<div class="inv-store" ${textStyle('store')}><bdi>${esc(s.storeName)}</bdi></div>` : '') +
    (s.header ? `<div class="prewrap" ${textStyle('header')}>${rich(s.header)}</div>` : '');
  const logo = s.logo ? `<img src="${imgUrl(s.logo)}" alt="" style="height:${Number(s.logoSize) || 80}px">` : '';
  const pieces = inv.items.reduce((sum, it) => sum + it.qty, 0);
  const fontFamily = `InvoiceLatin-${layout.englishFont}, InvoiceArabic-${layout.arabicFont}, Tahoma, Arial, sans-serif`;
  const style = `--accent:${safeColor(s.accentColor, '#714b67')};--row:${safeColor(s.rowColor, '#f3edf2')};--a4-font:${fontFamily};--a4-emphasis:${layout.emphasis === 'headings' ? 700 : 400}` +
    (s.paper !== 'receipt' && s.a4Layout ? `;--a4-margin:${layout.margin}mm;--a4-height:${297 - layout.margin * 2 - 3}mm;--a4-font:${fontFamily};--a4-size:${layout.fontSize}px;--store-size:${layout.storeSize}px;--title-size:${layout.titleSize}px;--header-align:${layout.headerAlign};--footer-align:${layout.footerAlign};--header-gap:${layout.headerGap}px;--footer-gap:${layout.footerGap}px` : '');
  return `<div class="invoice paper-${s.paper === 'receipt' ? 'receipt' : 'a4'}" data-bs-theme="light" style="${style}">
    ${logo || headText ? `<div class="inv-head align-${align}">${logo}${headText ? `<div class="inv-head-text">${headText}</div>` : ''}</div>` : ''}
    <div class="inv-title" ${textStyle('title')}><bdi>${esc(s.invoiceTitle || t('invoice'))}</bdi></div>
    <div class="inv-meta">
      <div><strong class="inv-label" ${textStyle('labels')}>${t('invoiceNo')}:</strong> <span class="inv-value num" dir="ltr" ${textStyle('values')}>${esc(invCode(inv))}</span></div>
      ${invoiceDateTime(inv.date, s) ? `<div class="inv-date-time"><strong class="inv-label" ${textStyle('labels')}>${t(s.showDate !== false ? 'date' : 'time')}:</strong> <span class="inv-value num" dir="ltr" ${textStyle('values')}>${invoiceDateTime(inv.date, s)}</span></div>` : ''}
    </div>
    <div class="inv-cust">
      <div><strong class="inv-label" ${textStyle('labels')}>${t('customer')}:</strong> <span class="inv-value" ${textStyle('values')}><bdi>${esc(inv.customerName)}</bdi></span></div>
      ${inv.customerPhone ? `<div><strong class="inv-label" ${textStyle('labels')}>${t('phone')}:</strong> <span dir="ltr" class="inv-value num" ${textStyle('values')}>${esc(inv.customerPhone)}</span></div>` : ''}
      ${inv.customerAddress ? `<div><strong class="inv-label" ${textStyle('labels')}>${t('address')}:</strong> <span class="inv-value prewrap" ${textStyle('values')}>${rich(inv.customerAddress)}</span></div>` : ''}
    </div>
    <table class="inv-table">
      <thead><tr><th ${textStyle('tableHeadings')}>#</th><th ${textStyle('tableHeadings')}>${t('product')}</th><th class="r" ${textStyle('tableHeadings')}>${t('price')}</th><th class="r" ${textStyle('tableHeadings')}>${t('qty')}</th><th class="r" ${textStyle('tableHeadings')}>${t('total')}</th></tr></thead>
      <tbody ${textStyle('rows')}>${inv.items.map((it, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><bdi>${esc(it.name)}</bdi></td>
        <td class="r num">${int(it.price)}</td>
        <td class="r num">${int(it.qty)}</td>
        <td class="r num">${int(it.total)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr class="inv-total">
        <td colspan="3" ${textStyle('totals')}>${t('total')}</td>
        <td class="r num" ${textStyle('totals')}>${int(pieces)}</td>
        <td class="r" ${textStyle('totals')}>${money(inv.total)}</td>
      </tr>${s.showPaid ? `<tr class="inv-paid-row"><td colspan="4" class="inv-blank"></td><td class="inv-paid" ${textStyle('totals')}>${t('paid')}</td></tr>` : ''}</tfoot>
    </table>
    ${s.footer ? `<div class="inv-foot" ${textStyle('footer')}>${rich(s.footer)}</div>` : ''}
  </div>`;
}

// Only a plain #rrggbb value goes into the page, never anything else.
function safeColor(v, fallback) { return /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : fallback; }

function pageCss(s) {
  return s.paper === 'receipt'
    ? '@page { size: 80mm auto; margin: 3mm; }'
    : `@page { size: A4; margin: ${a4Layout(s).margin}mm; }`;
}

function renderInvoice(id) {
  const inv = state.db.invoices.find(i => i.id === id);
  if (!inv) {
    $('#app').innerHTML = `${topbar(t('invoice'))}<div class="page text-center text-secondary p-5">${t('invoiceGone')}</div>`;
    return;
  }
  const s = state.db.settings;
  document.title = invCode(inv);
  $('#page-style').textContent = pageCss(s);
  $('#app').innerHTML = `
    ${topbar(t('invoice') + ' ' + invCode(inv))}
    <div class="page">
      <div class="d-flex flex-wrap gap-2 mb-3 no-print">
        <a class="btn btn-outline-secondary" href="#/invoices"><i class="bi bi-arrow-${lang() === 'ar' ? 'right' : 'left'}"></i> ${t('invoices')}</a>
        <a class="btn btn-outline-secondary" href="#/pos"><i class="bi bi-cart-plus"></i> ${t('pos')}</a>
        <button class="btn btn-outline-secondary" id="inv-return"><i class="bi bi-arrow-return-left"></i> ${t('returnItems')}</button>
        <button class="btn btn-outline-danger ms-auto" id="inv-del"${inv.returns?.length ? ' disabled' : ''}><i class="bi bi-trash"></i> ${t('delete')}</button>
        <button class="btn btn-outline-secondary" id="inv-pdf"><i class="bi bi-file-earmark-pdf"></i> ${t('downloadPdf')}</button>
        <button class="btn btn-outline-secondary" id="inv-png"><i class="bi bi-file-earmark-image"></i> ${t('downloadPng')}</button>
        <button class="btn btn-brand" id="inv-print"><i class="bi bi-printer"></i> ${t('print')}</button>
      </div>
      <section class="bg-white rounded p-3 mb-3 no-print" id="invoice-returns">
        <h5>${t('returns')}</h5>
        ${(inv.returns || []).map(ret => `<div class="border-bottom py-2">
          <div class="d-flex justify-content-between gap-2"><span dir="ltr">${esc(fmtDate(ret.date))}</span><strong>${money(ret.total)}</strong></div>
          <ul class="mb-1">${ret.items.map(item => `<li><bdi>${esc(inv.items[item.index].name)}</bdi> × ${int(item.qty)}</li>`).join('')}</ul>
          <small class="text-secondary">${ret.restock ? t('restockReturn') : t('noRestock')}</small>
        </div>`).join('') || `<p class="text-secondary mb-0">${t('noReturns')}</p>`}
        ${inv.returns?.length ? `<div class="mt-2">${t('refundTotal')}: ${money(InventoryFinance.refundTotal(inv))} · ${t('netSales')}: ${money(InventoryFinance.netTotal(inv))}</div>` : ''}
      </section>
      ${invoiceHtml(inv, s)}
    </div>`;
  $('#inv-print').onclick = () => window.print();
  $('#inv-return').onclick = () => returnForm(inv);
  const exportInvoice = (format, exporter) => async e => {
    if (invoiceExportInProgress) return;
    invoiceExportInProgress = true;
    const button = e.currentTarget;
    const label = button.innerHTML;
    const buttons = [$('#inv-pdf'), $('#inv-png')];
    buttons.forEach(control => { control.disabled = true; });
    button.textContent = t(format === 'png' ? 'creatingPng' : 'creatingPdf');
    try {
      await exporter(inv, s);
    } catch (err) {
      toast(t(format === 'png' ? 'pngError' : 'pdfError'), true);
    } finally {
      invoiceExportInProgress = false;
      buttons.forEach(control => { control.disabled = false; });
      button.innerHTML = label;
    }
  };
  $('#inv-pdf').onclick = exportInvoice('pdf', downloadInvoicePdf);
  $('#inv-png').onclick = exportInvoice('png', downloadInvoicePng);
  $('#inv-del').onclick = () => {
    const box = openModal(`
      <div class="modal-header"><h5 class="modal-title">${t('deleteInvoice')}</h5>
        <button type="button" class="btn-close" aria-label="${esc(t('close'))}" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <p class="fs-5">${esc(t('deleteInvoiceQ', { n: invCode(inv) }))}</p>
        <div class="d-grid gap-2">
          <button class="btn btn-danger" data-restock="1"><i class="bi bi-arrow-counterclockwise"></i> ${t('deleteRestock')}</button>
          <button class="btn btn-outline-danger" data-restock="0"><i class="bi bi-trash"></i> ${t('deleteOnly')}</button>
          <button class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
        </div>
      </div>`);
    $$('[data-restock]', box).forEach(b => b.onclick = async () => {
      try {
        await api('DELETE', `/api/invoices/${encodeURIComponent(inv.id)}?restock=${b.dataset.restock}`);
        closeModal(); toast(t('deleted')); location.hash = '#/invoices';
      } catch (err) { toast(err.message, true); }
    });
  };
}

function returnForm(inv) {
  const key = 'inventory-pending-return:' + state.dataDir + ':' + state.generation + ':' + inv.id;
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
  const box = openModal(`
    <div class="modal-header"><h5 class="modal-title">${t('returnItems')} · ${esc(invCode(inv))}</h5><button type="button" class="btn-close" aria-label="${esc(t('close'))}" data-bs-dismiss="modal"></button></div>
    <form id="return-form"><div class="modal-body">
      <p class="text-secondary">${t('returnHint')}</p>
      <fieldset id="return-fields">
        ${inv.items.map((item, index) => {
          const remaining = item.qty - InventoryFinance.returnedQty(inv, index);
          return `<div class="row g-2 align-items-center mb-3"><div class="col-7"><bdi>${esc(item.name)}</bdi><div class="small text-secondary">${t('remaining')}: ${int(remaining)} · ${money(item.price)}</div></div>
            <div class="col-5"><label class="form-label small" for="return-${index}">${t('returnQty')}</label><input class="form-control" id="return-${index}" data-return-index="${index}" inputmode="numeric" dir="ltr" value="0"${remaining === 0 ? ' disabled' : ''}></div></div>`;
        }).join('')}
        <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="return-restock" checked><label class="form-check-label" for="return-restock">${t('restockReturn')}</label></div>
      </fieldset>
      <div class="fs-5">${t('refundTotal')}: <strong id="return-total"></strong></div>
      <div class="alert alert-warning mt-3" id="return-pending" hidden>${t('returnPending')}</div>
    </div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button><button class="btn btn-brand" id="return-save" type="submit">${t('recordReturn')}</button></div></form>`, { size: 'lg' });
  const inputs = $$('[data-return-index]', box);
  const drawTotal = () => {
    const total = inputs.reduce((sum, input) => {
      const qty = parseWhole(input.value);
      return sum + (Number.isNaN(qty) ? 0 : qty * inv.items[Number(input.dataset.returnIndex)].price);
    }, 0);
    $('#return-total', box).innerHTML = money(total);
  };
  const restorePending = () => {
    if (!pending) return;
    inputs.forEach(input => { input.value = pending.items.find(item => item.index === Number(input.dataset.returnIndex))?.qty || 0; });
    $('#return-restock', box).checked = pending.restock;
    $('#return-fields', box).disabled = true;
    $('#return-pending', box).hidden = false;
    $('#return-save', box).textContent = t('returnRetry');
  };
  restorePending(); drawTotal();
  $('#return-form', box).oninput = drawTotal;
  $('#return-form', box).onsubmit = async e => {
    e.preventDefault();
    const button = $('#return-save', box);
    if (!pending) {
      const items = [];
      for (const input of inputs) {
        const qty = parseWhole(input.value);
        const index = Number(input.dataset.returnIndex);
        if (Number.isNaN(qty) || qty > inv.items[index].qty - InventoryFinance.returnedQty(inv, index)) return toast(t('err.badReturn'), true);
        if (qty) items.push({ index, qty });
      }
      if (!items.length) return toast(t('err.badReturn'), true);
      const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      pending = { requestId, items, restock: $('#return-restock', box).checked };
      try { sessionStorage.setItem(key, JSON.stringify(pending)); }
      catch { pending = null; return toast(t('err.checkoutStorage'), true); }
    }
    button.disabled = true;
    $('#return-fields', box).disabled = true;
    try {
      await api('POST', `/api/invoices/${encodeURIComponent(inv.id)}/returns`, pending);
      sessionStorage.removeItem(key);
      closeModal(); toast(t('returnSaved')); renderInvoice(inv.id);
    } catch (err) {
      if (err.key) {
        pending = null; sessionStorage.removeItem(key);
        $('#return-fields', box).disabled = false;
        $('#return-pending', box).hidden = true;
        button.textContent = t('recordReturn');
      } else restorePending();
      toast(err.message, true);
    } finally { button.disabled = false; }
  };
}
