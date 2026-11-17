'use strict';

/* ---------------- customers ---------------- */

function customerStats() {
  const stats = {};
  for (const inv of state.db.invoices) {
    const s = stats[inv.customerId] || (stats[inv.customerId] = { count: 0, total: 0 });
    s.count++;
    s.total += InventoryFinance.netTotal(inv);
  }
  return stats;
}

function renderCustomers() {
  let q = '';
  $('#app').innerHTML = `
    ${topbar(t('customers'))}
    <div class="page">
      <div class="d-flex gap-2 mb-3">
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" id="c-search" placeholder="${esc(t('search'))}" dir="auto">
        </div>
        <button class="btn btn-brand text-nowrap" id="c-add"><i class="bi bi-person-plus"></i> ${t('addCustomer')}</button>
      </div>
      <div id="c-table"></div>
    </div>`;
  const draw = () => {
    const stats = customerStats();
    const list = state.db.customers
      .filter(c => matches(q, c.name, c.phone, normPhone(c.phone), c.address))
      .sort((a, b) => a.name.localeCompare(b.name, lang()));
    if (!list.length) {
      $('#c-table').innerHTML = `<div class="text-center text-secondary p-5">${state.db.customers.length ? t('noResults') : t('noCustomers')}</div>`;
      return;
    }
    $('#c-table').innerHTML = `<div class="table-responsive bg-white rounded shadow-sm"><table class="table table-hover align-middle m-0">
      <thead><tr><th>${t('name')}</th><th>${t('phone')}</th><th>${t('address')}</th><th class="text-end">${t('invoicesCount')}</th><th class="text-end">${t('totalSpent')}</th><th></th></tr></thead>
      <tbody>${list.map(c => {
        const s = stats[c.id] || { count: 0, total: 0 };
        return `<tr data-id="${esc(c.id)}">
          <td class="fw-semibold"><bdi>${esc(c.name)}</bdi></td>
          <td class="num"><span dir="ltr">${esc(c.phone)}</span></td>
          <td class="prewrap">${rich(c.address)}</td>
          <td class="text-end num">${int(s.count)}</td>
          <td class="text-end">${money(s.total)}</td>
          <td class="text-end text-nowrap">
            <a class="btn btn-sm btn-outline-secondary" href="#/invoices/${encodeURIComponent(c.id)}" title="${esc(t('viewInvoices'))}"><i class="bi bi-receipt"></i></a>
            <button class="btn btn-sm btn-outline-primary" data-edit title="${esc(t('edit'))}"><i class="bi bi-pencil"></i></button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
    $$('#c-table [data-edit]').forEach(b => b.onclick = () => customerForm(state.db.customers.find(c => c.id === b.closest('tr').dataset.id)));
  };
  $('#c-search').oninput = e => { q = e.target.value; draw(); };
  $('#c-add').onclick = () => customerForm(null);
  draw();
}

function customerForm(c) {
  const box = openModal(`
    <div class="modal-header">
      <h5 class="modal-title">${c ? t('editCustomer') : t('addCustomer')}</h5>
      <button type="button" class="btn-close" aria-label="${esc(t('close'))}" data-bs-dismiss="modal"></button>
    </div>
    <form class="modal-body" id="cf" novalidate>
      <div class="mb-3"><label class="form-label">${t('name')}</label>
        <input class="form-control" name="name" maxlength="200" dir="auto" value="${esc(c ? c.name : '')}"></div>
      <div class="mb-3"><label class="form-label">${t('phone')}</label>
        <input class="form-control" name="phone" maxlength="40" dir="ltr" inputmode="tel" value="${esc(c ? c.phone : '')}"></div>
      <div class="mb-3"><label class="form-label">${t('address')}</label>
        <textarea class="form-control" name="address" rows="2" maxlength="500" dir="auto">${esc(c ? c.address : '')}</textarea></div>
    </form>
    <div class="modal-footer">
      ${c ? `<button class="btn btn-outline-danger me-auto" id="cf-del"><i class="bi bi-trash"></i> ${t('delete')}</button>` : ''}
      <button class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
      <button class="btn btn-brand" id="cf-save"><i class="bi bi-check-lg"></i> ${t('save')}</button>
    </div>`);
  const f = $('#cf', box);
  f.onsubmit = e => { e.preventDefault(); $('#cf-save', box).click(); };
  $('#cf-save', box).onclick = async () => {
    const button = $('#cf-save', box);
    if (button.disabled) return;
    if (!f.name.value.trim()) return toast(t('err.nameRequired'), true);
    button.disabled = true;
    if (c) $('#cf-del', box).disabled = true;
    try {
      await api('POST', '/api/customers', { id: c ? c.id : '', name: f.name.value, phone: f.phone.value, address: f.address.value });
      closeModal(); toast(t('saved')); route();
    } catch (err) { toast(err.message, true); }
    finally { button.disabled = false; if (c) $('#cf-del', box).disabled = false; }
  };
  if (c) $('#cf-del', box).onclick = async () => {
    if (!await confirmBox(t('confirmDeleteCustomer', { name: c.name }), t('delete'))) return;
    try { await api('DELETE', '/api/customers/' + encodeURIComponent(c.id)); toast(t('deleted')); route(); }
    catch (err) { toast(err.message, true); }
  };
  setTimeout(() => f.name.focus(), 300);
}
