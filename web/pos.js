'use strict';

/* ---------------- POS (new sale) ---------------- */

const cartQty = id => (state.cart.find(l => l.productId === id) || {}).qty || 0;

// Drops cart lines whose product is gone and caps each line at the stock.
function fixCart() {
  state.cart = state.cart
    .map(l => { const p = productById(l.productId); return p ? { ...l, qty: Math.min(l.qty, p.stock) } : null; })
    .filter(l => l && l.qty > 0);
}

const cartUnitPrice = line => line.customPrice ?? productById(line.productId).price;
function cartTotal() {
  return state.cart.reduce((sum, l) => sum + cartUnitPrice(l) * l.qty, 0);
}

function renderPos() {
  if (state.pendingSale) { renderPendingCheckout(); return; }
  fixCart();
  $('#app').innerHTML = `
    ${topbar(t('pos'))}
    <div class="page pos">
      <div class="pos-products">
        <div class="input-group mb-3">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control form-control-lg" id="pos-search" placeholder="${esc(t('search'))}" value="${esc(state.posSearch)}" dir="auto">
        </div>
        <div id="pos-list"></div>
      </div>
      <div class="pos-cart">
        <div class="p-3 border-bottom">
          <div class="small text-secondary">${t('invoiceNo')}</div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <b class="num" dir="ltr" id="sale-number"></b>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="sale-number-change">${t('changeNumber')}</button>
          </div>
        </div>
        <div class="d-flex align-items-center p-3 border-bottom">
          <h5 class="m-0"><i class="bi bi-cart3"></i> ${t('cart')}</h5>
          <button class="btn btn-sm btn-outline-danger ms-auto" id="cart-clear"><i class="bi bi-trash"></i> ${t('clearCart')}</button>
        </div>
        <div class="cart-lines" id="cart-lines"></div>
        <div class="p-3 border-top">
          <div class="d-flex justify-content-between align-items-baseline mb-3">
            <span class="text-secondary" id="cart-count"></span>
            <span class="cart-total" id="cart-total"></span>
          </div>
          <h6><i class="bi bi-person"></i> ${t('customer')}</h6>
          <div class="customer-picker mb-2">
            <input class="form-control" id="c-name" role="combobox" aria-label="${esc(t('customerName'))}" aria-autocomplete="list" aria-expanded="false" aria-controls="c-options" placeholder="${esc(t('customerSearch'))}" dir="auto" value="${esc(state.cust.name)}" autocomplete="off">
            <div class="customer-options" id="c-options" role="listbox" aria-label="${esc(t('customers'))}" hidden></div>
          </div>
          <input class="form-control mb-2" id="c-phone" placeholder="${esc(t('phone'))}" dir="ltr" inputmode="tel" value="${esc(state.cust.phone)}">
          <textarea class="form-control mb-3" id="c-address" rows="2" placeholder="${esc(t('address'))}" dir="auto">${esc(state.cust.address)}</textarea>
          <button class="btn btn-brand btn-lg w-100" id="sale-btn"><i class="bi bi-check2-circle"></i> ${t('completeSale')}</button>
        </div>
      </div>
    </div>`;

  const drawProducts = () => {
    const list = state.db.products.filter(p => matches(state.posSearch, p.name));
    $('#pos-list').innerHTML = list.length
      ? `<div class="cards">${list.map(p => productCard(p, { pos: true, inCart: cartQty(p.id) })).join('')}</div>`
      : `<div class="text-center text-secondary p-5">${state.db.products.length ? t('noResults') : t('noProducts')}</div>`;
    $$('#pos-list .pcard').forEach(c => c.onclick = () => addToCart(c.dataset.id));
  };

  const drawCart = () => {
    const box = $('#cart-lines');
    if (!state.cart.length) {
      box.innerHTML = `<div class="text-center text-secondary p-4">${t('emptyCart')}</div>`;
    } else {
      box.innerHTML = state.cart.map(l => {
        const p = productById(l.productId);
        return `<div class="cart-line" data-id="${esc(p.id)}">
          <div class="cl-name">
            <div><bdi>${esc(p.name)}</bdi></div>
            <small class="text-secondary">${money(cartUnitPrice(l))} × <span class="num">${int(l.qty)}</span></small>
            <button type="button" class="btn btn-sm btn-link p-0 d-block" data-act="price">${t(l.customPrice === undefined ? 'editSalePrice' : 'customPrice')}</button>
          </div>
          <div class="input-group input-group-sm" style="width:auto">
            <button class="btn btn-outline-secondary" data-act="dec"><i class="bi bi-dash"></i></button>
            <input class="form-control qty" value="${l.qty}" inputmode="numeric" dir="ltr">
            <button class="btn btn-outline-secondary" data-act="inc"><i class="bi bi-plus"></i></button>
          </div>
          <div class="text-end fw-semibold" style="min-width:110px">${money(cartUnitPrice(l) * l.qty)}</div>
          <button class="btn btn-sm text-danger" data-act="del"><i class="bi bi-x-lg"></i></button>
        </div>`;
      }).join('');
    }
    const pieces = state.cart.reduce((s, l) => s + l.qty, 0);
    $('#cart-count').textContent = `${t('items')}: ${int(state.cart.length)} · ${int(pieces)} ${t('pcs')}`;
    $('#cart-total').innerHTML = money(cartTotal());
    $('#sale-btn').disabled = !state.cart.length;

    $$('.cart-line').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-act=price]').onclick = () => {
        const line = state.cart.find(l => l.productId === id);
        const box = openModal(`
          <div class="modal-header"><h5 class="modal-title">${t('customPrice')}</h5><button type="button" class="btn-close" aria-label="${esc(t('close'))}" data-bs-dismiss="modal"></button></div>
          <form id="sale-price-form"><div class="modal-body">
            <p><bdi>${esc(productById(id).name)}</bdi></p>
            <label class="form-label" for="sale-price-input">${t('price')} (${t('cur')})</label>
            <input class="form-control" id="sale-price-input" inputmode="numeric" dir="ltr" value="${cartUnitPrice(line)}">
            <div class="form-text">${t('salePriceHint')}</div>
          </div><div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary me-auto" id="sale-price-reset">${t('regularPrice')} (${money(productById(id).price)})</button>
            <button type="submit" class="btn btn-brand">${t('save')}</button>
          </div></form>`);
        $('#sale-price-reset', box).onclick = () => { delete line.customPrice; closeModal(); drawCart(); };
        $('#sale-price-form', box).onsubmit = e => {
          e.preventDefault();
          const price = parseWhole($('#sale-price-input', box).value);
          if (isNaN(price) || price > 1e9) return toast(t('err.badPrice'), true);
          line.customPrice = price; closeModal(); drawCart();
        };
      };
      row.querySelector('[data-act=dec]').onclick = () => setQty(id, cartQty(id) - 1);
      row.querySelector('[data-act=inc]').onclick = () => setQty(id, cartQty(id) + 1);
      row.querySelector('[data-act=del]').onclick = () => setQty(id, 0);
      row.querySelector('.qty').onchange = e => {
        const v = parseWhole(e.target.value);
        if (isNaN(v)) { e.target.classList.add('is-invalid'); toast(t('err.badQty'), true); return; }
        e.target.classList.remove('is-invalid');
        setQty(id, v);
      };
    });
  };

  const redraw = () => { drawProducts(); drawCart(); };

  const drawInvoiceNumber = () => {
    const choice = state.invoiceOverride;
    $('#sale-number').textContent = choice ? formatInvoiceCode(choice.year, choice.number) : nextInvoiceCode();
  };
  $('#sale-number-change').onclick = () => {
    const numbering = invoiceNumbering();
    const choice = state.invoiceOverride;
    const box = openModal(`
      <div class="modal-header"><h5 class="modal-title">${t('nextInvoiceNumber')}</h5>
        <button type="button" class="btn-close" aria-label="${esc(t('close'))}" data-bs-dismiss="modal"></button></div>
      <form id="number-form">
        <div class="modal-body">
          <label class="form-label" for="number-input" dir="ltr">INV-HS-${numbering.year}-</label>
          <input class="form-control" id="number-input" inputmode="numeric" dir="ltr" value="${choice ? choice.number : numbering.nextNumber}">
          <div class="form-text">${esc(t('numberingMinimum', { code: nextInvoiceCode() }))}</div>
          <p class="small text-secondary mt-2 mb-0">${t('numberingHint')}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary me-auto" id="number-auto">${t('automaticNumber')}</button>
          <button type="submit" class="btn btn-brand">${t('save')}</button>
        </div>
      </form>`);
    $('#number-auto', box).onclick = () => { state.invoiceOverride = null; drawInvoiceNumber(); closeModal(); };
    $('#number-form', box).onsubmit = e => {
      e.preventDefault();
      const number = parseInvoiceNumber($('#number-input', box).value);
      if (!number) return toast(t('err.invoiceNumber'), true);
      if (number < numbering.nextNumber) return toast(t('err.invoiceNumberUsed'), true);
      state.invoiceOverride = { year: numbering.year, number };
      drawInvoiceNumber(); closeModal();
    };
  };
  drawInvoiceNumber();

  function setQty(id, qty) {
    const p = productById(id);
    const line = state.cart.find(l => l.productId === id);
    if (!p || !line) return;
    if (qty > p.stock) { toast(t('onlyLeft', { n: int(p.stock) }), true); qty = p.stock; }
    if (qty <= 0) state.cart = state.cart.filter(l => l.productId !== id);
    else line.qty = qty;
    redraw();
  }

  function addToCart(id) {
    const p = productById(id);
    if (!p) return;
    const line = state.cart.find(l => l.productId === id);
    if ((line ? line.qty : 0) + 1 > p.stock) { toast(p.stock > 0 ? t('onlyLeft', { n: int(p.stock) }) : t('outOfStock'), true); return; }
    if (line) line.qty++; else state.cart.push({ productId: id, qty: 1 });
    redraw();
  }

  $('#pos-search').oninput = e => { state.posSearch = e.target.value; drawProducts(); };
  $('#cart-clear').onclick = () => { state.cart = []; redraw(); };

  // Explicit selection also replaces details from a previously selected customer.
  const nameIn = $('#c-name'), phoneIn = $('#c-phone'), addrIn = $('#c-address');
  const options = $('#c-options');
  let suggestions = [], activeCustomer = -1, selectedCustomer = null;
  const closeCustomers = () => {
    options.hidden = true;
    nameIn.setAttribute('aria-expanded', 'false');
    nameIn.removeAttribute('aria-activedescendant');
    activeCustomer = -1;
  };
  const selectCustomer = c => {
    selectedCustomer = c;
    nameIn.value = state.cust.name = c.name;
    phoneIn.value = state.cust.phone = c.phone;
    addrIn.value = state.cust.address = c.address;
    closeCustomers();
  };
  const showCustomers = () => {
    const q = nameIn.value.trim();
    const phoneQuery = normPhone(q);
    suggestions = state.db.customers.filter(c => matches(q, c.name, c.phone) ||
      (phoneQuery && normPhone(c.phone).includes(phoneQuery)))
      .sort((a, b) => a.name.localeCompare(b.name, lang()));
    activeCustomer = -1;
    nameIn.removeAttribute('aria-activedescendant');
    options.innerHTML = suggestions.length ? suggestions.map((c, i) => `
      <div class="customer-option" role="option" id="c-option-${i}" data-index="${i}" aria-selected="false">
        <bdi>${esc(c.name)}</bdi>
        ${c.phone ? `<small dir="ltr">${esc(c.phone)}</small>` : ''}
        ${c.address ? `<small dir="auto">${esc(c.address)}</small>` : ''}
      </div>`).join('') : `<div class="p-3 small text-secondary" role="status">${esc(t('newCustomerHint'))}</div>`;
    options.hidden = false;
    nameIn.setAttribute('aria-expanded', 'true');
  };
  nameIn.onfocus = showCustomers;
  nameIn.onclick = () => { if (options.hidden) showCustomers(); };
  nameIn.oninput = () => {
    if (selectedCustomer) {
      if (phoneIn.value === selectedCustomer.phone) phoneIn.value = state.cust.phone = '';
      if (addrIn.value === selectedCustomer.address) addrIn.value = state.cust.address = '';
      selectedCustomer = null;
    }
    state.cust.name = nameIn.value;
    showCustomers();
  };
  nameIn.onkeydown = e => {
    if (e.key === 'Escape' || e.key === 'Tab') { closeCustomers(); return; }
    if (e.key === 'Enter' && !options.hidden && activeCustomer >= 0) {
      e.preventDefault(); selectCustomer(suggestions[activeCustomer]); return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (options.hidden) showCustomers();
    if (!suggestions.length) return;
    activeCustomer = activeCustomer < 0 ? (e.key === 'ArrowDown' ? 0 : suggestions.length - 1)
      : (activeCustomer + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    $$('.customer-option', options).forEach((el, i) => {
      el.classList.toggle('active', i === activeCustomer);
      el.setAttribute('aria-selected', String(i === activeCustomer));
    });
    const active = $('#c-option-' + activeCustomer, options);
    nameIn.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  };
  // Keep focus on the combobox while choosing with a mouse or touch.
  options.onmousedown = e => e.preventDefault();
  options.onclick = e => {
    const item = e.target.closest('[data-index]');
    if (item) { selectCustomer(suggestions[Number(item.dataset.index)]); nameIn.focus(); closeCustomers(); }
  };
  nameIn.onblur = closeCustomers;
  phoneIn.oninput = () => {
    state.cust.phone = phoneIn.value;
    const np = normPhone(phoneIn.value);
    const c = np && state.db.customers.find(c => normPhone(c.phone) === np);
    if (c) {
      if (!nameIn.value.trim()) nameIn.value = state.cust.name = c.name;
      if (!addrIn.value.trim()) addrIn.value = state.cust.address = c.address;
    }
  };
  addrIn.oninput = () => { state.cust.address = addrIn.value; };

  $('#sale-btn').onclick = async () => {
    if ($('.qty.is-invalid')) return toast(t('err.badQty'), true);
    if (!state.cart.length) return toast(t('err.cartEmpty'), true);
    if (!state.cust.name.trim()) { nameIn.focus(); return toast(t('err.customerRequired'), true); }
    const choice = state.invoiceOverride;
    await beginSaleCheckout({ customer: state.cust, items: state.cart,
      ...(choice ? { invoiceNumber: choice.number, invoiceYear: choice.year } : {}) });
  };

  redraw();
}
