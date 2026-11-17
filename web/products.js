'use strict';

/* ---------------- product cards ---------------- */

function productCard(p, opts = {}) {
  const img = p.images[0]
    ? `<img src="${imgUrl(p.images[0])}" alt="" loading="lazy">`
    : '<i class="bi bi-image"></i>';
  const left = p.stock - (opts.inCart || 0);
  const disabled = opts.pos && left <= 0;
  return `<button type="button" class="pcard${disabled ? ' disabled' : ''}" data-id="${esc(p.id)}">
    <div class="pimg">${img}</div>
    <span class="pstock">${opts.pos ? (left <= 0 ? `<span class="badge text-bg-danger">${t('outOfStock')}</span>` :
      `<span class="badge ${left <= lowLimit() ? 'text-bg-warning' : 'text-bg-light border'}">${int(left)}</span>`) : stockBadge(p)}</span>
    ${opts.inCart ? `<span class="pincart badge rounded-pill" style="background:var(--brand-solid);color:var(--brand-button-ink)">${int(opts.inCart)}</span>` : ''}
    <div class="pname"><bdi>${esc(p.name)}</bdi></div>
    <div class="pprice">${money(p.price)}</div>
  </button>`;
}

/* ---------------- products (inventory) ---------------- */

function renderProducts() {
  const sortOptions = [
    ['newest', 'sortNewest'], ['oldest', 'sortOldest'], ['name-asc', 'sortNameAsc'], ['name-desc', 'sortNameDesc'],
    ['price-asc', 'sortPriceAsc'], ['price-desc', 'sortPriceDesc'],
    ['stock-asc', 'sortStockAsc'], ['stock-desc', 'sortStockDesc'],
  ];
  $('#app').innerHTML = `
    ${topbar(t('products'))}
    <div class="page">
      <div class="inventory-toolbar mb-3">
        <div class="input-group inventory-search">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" id="p-search" placeholder="${esc(t('search'))}" value="${esc(state.productSearch)}" dir="auto">
        </div>
        <select class="form-select inventory-sort" id="p-sort" aria-label="${esc(t('sortInventory'))}">
          ${sortOptions.map(([value, key]) => `<option value="${value}"${state.productSort === value ? ' selected' : ''}>${esc(t(key))}</option>`).join('')}
        </select>
        <button class="btn btn-brand text-nowrap" id="p-add"><i class="bi bi-plus-lg"></i> ${t('addProduct')}</button>
      </div>
      <section class="inventory-summary mb-3" aria-label="${esc(t('products'))}">
        <div><span class="text-secondary">${t('inventoryProductCount')}</span><strong class="num" id="p-total-products"></strong></div>
        <div><span class="text-secondary">${t('inventoryPieceCount')}</span><strong class="num" id="p-total-pieces"></strong></div>
      </section>
      <p class="small text-secondary mb-3" id="p-count" role="status" aria-live="polite" aria-atomic="true"></p>
      <div id="p-list"></div>
    </div>`;
  const draw = () => {
    const list = state.db.products.filter(p => matches(state.productSearch, p.name));
    $('#p-total-products').textContent = int(state.db.products.length);
    $('#p-total-pieces').textContent = int(state.db.products.reduce((sum, p) => sum + p.stock, 0));
    $('#p-count').textContent = t('inventoryShowing', { n: int(list.length), total: int(state.db.products.length), pieces: int(list.reduce((sum, p) => sum + p.stock, 0)) });
    const byName = (a, b) => a.name.localeCompare(b.name, lang(), { numeric: true, sensitivity: 'base' });
    const sorts = {
      'name-asc': byName,
      'name-desc': (a, b) => byName(b, a),
      'price-asc': (a, b) => a.price - b.price || byName(a, b),
      'price-desc': (a, b) => b.price - a.price || byName(a, b),
      'stock-asc': (a, b) => a.stock - b.stock || byName(a, b),
      'stock-desc': (a, b) => b.stock - a.stock || byName(a, b),
      newest: (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
      oldest: (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
    };
    if (sorts[state.productSort]) list.sort(sorts[state.productSort]);
    $('#p-list').innerHTML = list.length
      ? `<div class="cards">${list.map(p => productCard(p)).join('')}</div>`
      : `<div class="text-center text-secondary p-5">${state.db.products.length ? t('noResults') : t('noProducts')}</div>`;
    $$('#p-list .pcard').forEach(c => c.onclick = () => productForm(productById(c.dataset.id)));
  };
  $('#p-search').oninput = e => { state.productSearch = e.target.value; draw(); };
  $('#p-sort').onchange = e => { state.productSort = e.target.value; draw(); };
  $('#p-add').onclick = () => productForm(null);
  draw();
}

// Shrinks a picture before upload so the data folder stays small.
// JPEG gets a white background (it has no transparency); PNG keeps it.
function resizeImage(file, maxSide, type) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error(t('err.badImage'))), type, 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('err.badImage'))); };
    img.src = url;
  });
}

async function uploadImage(file, maxSide, type) {
  const blob = await resizeImage(file, maxSide, type);
  const res = await api('POST', '/api/images', blob);
  return res.name;
}

function productForm(p) {
  const draft = p ? { ...p, images: [...p.images] } : { id: '', name: '', price: '', stock: '', images: [] };
  const box = openModal(`
    <div class="modal-header">
      <h5 class="modal-title">${p ? t('editProduct') : t('addProduct')}</h5>
      <button type="button" class="btn-close" aria-label="${esc(t('close'))}" data-bs-dismiss="modal"></button>
    </div>
    <form class="modal-body" id="pf" novalidate>
      <div class="mb-3">
        <label class="form-label">${t('name')}</label>
        <input class="form-control form-control-lg" name="name" required maxlength="200" dir="auto" value="${esc(draft.name)}">
      </div>
      <div class="row g-3 mb-3">
        <div class="col-6">
          <label class="form-label">${t('price')} (${t('cur')})</label>
          <input class="form-control form-control-lg" name="price" inputmode="numeric" dir="ltr" value="${draft.price === '' ? '' : int(draft.price)}">
        </div>
        <div class="col-6">
          <label class="form-label">${t('pieces')}</label>
          <div class="input-group input-group-lg">
            <button class="btn btn-outline-secondary" type="button" data-step="-1"><i class="bi bi-dash-lg"></i></button>
            <input class="form-control text-center" name="stock" inputmode="numeric" dir="ltr" value="${draft.stock === '' ? '' : int(draft.stock)}">
            <button class="btn btn-outline-secondary" type="button" data-step="1"><i class="bi bi-plus-lg"></i></button>
          </div>
        </div>
      </div>
      ${state.db.settings.trackProfit ? `<div class="mb-3">
        <label class="form-label" for="pf-cost">${t('costPrice')} (${t('cur')})</label>
        <input class="form-control form-control-lg" id="pf-cost" name="costPrice" inputmode="numeric" dir="ltr" value="${draft.costPrice == null ? '' : int(draft.costPrice)}">
        <div class="form-text">${t('costHint')}</div>
      </div>` : ''}
      <label class="form-label">${t('pictures')}</label>
      <div class="thumbs mb-2" id="pf-thumbs"></div>
      <label class="btn btn-outline-secondary btn-sm">
        <i class="bi bi-image"></i> ${t('addPictures')}
        <input type="file" accept="image/*" multiple hidden id="pf-files">
      </label>
      <span class="spinner-border spinner-border-sm d-none ms-2" id="pf-spin"></span>
    </form>
    <div class="modal-footer">
      ${p ? `<button class="btn btn-outline-danger me-auto" id="pf-del"><i class="bi bi-trash"></i> ${t('delete')}</button>` : ''}
      <button class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
      <button class="btn btn-brand" id="pf-save"><i class="bi bi-check-lg"></i> ${t('save')}</button>
    </div>`);
  const f = $('#pf', box);
  let uploadsInFlight = 0;

  const drawThumbs = () => {
    $('#pf-thumbs', box).innerHTML = draft.images.map((img, i) => `
      <div class="thumb${i === 0 ? ' main' : ''}">
        <img src="${imgUrl(img)}" alt="">
        ${i > 0 ? `<button type="button" class="tbtn star" data-i="${i}" title="${esc(t('mainPicture'))}"><i class="bi bi-star-fill"></i></button>` : ''}
        <button type="button" class="tbtn del" data-i="${i}" title="${esc(t('removePicture'))}"><i class="bi bi-x-lg"></i></button>
      </div>`).join('');
    $$('.tbtn.del', box).forEach(b => b.onclick = () => { draft.images.splice(+b.dataset.i, 1); drawThumbs(); });
    $$('.tbtn.star', box).forEach(b => b.onclick = () => {
      const [img] = draft.images.splice(+b.dataset.i, 1);
      draft.images.unshift(img);
      drawThumbs();
    });
  };
  drawThumbs();

  $$('[data-step]', box).forEach(b => b.onclick = () => {
    const cur = f.stock.value.trim() === '' ? 0 : parseWhole(f.stock.value);
    if (isNaN(cur) || cur > 1e6) return toast(t('err.badStock'), true);
    const next = Math.max(0, cur + Number(b.dataset.step));
    if (next > 1e6) return toast(t('err.badStock'), true);
    f.stock.value = int(next);
  });
  // Format valid prices only after editing, preserving invalid input for a
  // clear validation error instead of silently turning -5 or 12.5 into 5/125.
  f.price.onblur = () => {
    const v = parseWhole(f.price.value);
    if (!isNaN(v)) f.price.value = int(v);
  };

  $('#pf-files', box).onchange = async e => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    uploadsInFlight++;
    $('#pf-save', box).disabled = true;
    $('#pf-spin', box).classList.remove('d-none');
    for (const file of files) {
      if (draft.images.length >= 10) break;
      try { draft.images.push(await uploadImage(file, 1000, 'image/jpeg')); drawThumbs(); }
      catch (err) { toast(err.message, true); }
    }
    uploadsInFlight--;
    if (!uploadsInFlight) {
      $('#pf-spin', box).classList.add('d-none');
      $('#pf-save', box).disabled = false;
    }
  };

  f.onsubmit = e => { e.preventDefault(); $('#pf-save', box).click(); };
  $('#pf-save', box).onclick = async () => {
    const button = $('#pf-save', box);
    if (button.disabled) return;
    const name = f.name.value.trim();
    const price = parseWhole(f.price.value);
    const stock = parseWhole(f.stock.value);
    const costPrice = f.costPrice ? (f.costPrice.value.trim() === '' ? null : parseWhole(f.costPrice.value)) : draft.costPrice;
    if (costPrice != null && (isNaN(costPrice) || costPrice > 1e9)) return toast(t('err.badCost'), true);
    if (!name) return toast(t('err.nameRequired'), true);
    if (isNaN(price) || price > 1e9) return toast(t('err.badPrice'), true);
    if (isNaN(stock) || stock > 1e6) return toast(t('err.badStock'), true);
    button.disabled = true;
    $('#pf-files', box).disabled = true;
    if (p) $('#pf-del', box).disabled = true;
    try {
      await api('POST', '/api/products', { id: draft.id, name, price, stock, costPrice, images: draft.images });
      closeModal(); toast(t('saved')); route();
    } catch (err) { toast(err.message, true); }
    finally {
      button.disabled = false;
      $('#pf-files', box).disabled = false;
      if (p) $('#pf-del', box).disabled = false;
    }
  };
  if (p) $('#pf-del', box).onclick = async () => {
    if (!await confirmBox(t('confirmDeleteProduct', { name: p.name }), t('delete'))) return;
    try {
      await api('DELETE', '/api/products/' + encodeURIComponent(p.id));
      state.cart = state.cart.filter(l => l.productId !== p.id);
      toast(t('deleted')); route();
    } catch (err) { toast(err.message, true); }
  };
  setTimeout(() => f.name.focus(), 300);
}
