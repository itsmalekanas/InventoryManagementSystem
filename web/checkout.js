'use strict';

let checkoutWorking = false;
const pendingCheckoutKey = () => 'inventory-pending-checkout:' + state.dataDir;

function clearPendingCheckout() {
  state.pendingSale = null;
  try { sessionStorage.removeItem(pendingCheckoutKey()); } catch (err) { /* a retained key is safe to look up again */ }
}

function restorePendingCheckout() {
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingCheckoutKey()) || 'null');
    if (pending && pending.dataDir === state.dataDir && /^[0-9a-f]{32}$/.test(pending.payload?.requestId) &&
        Array.isArray(pending.payload.items) && pending.payload.customer && typeof pending.payload.customer.name === 'string') {
      state.pendingSale = pending;
      return true;
    }
  } catch (err) { /* no valid recovery record */ }
  return false;
}

async function beginSaleCheckout(payload) {
  if (state.pendingSale) { renderPendingCheckout(); return; }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  payload.requestId = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  const pending = { dataDir: state.dataDir, generation: state.generation, payload: JSON.parse(JSON.stringify(payload)) };
  // Persist the key before sending anything. Reloads keep the same checkout;
  // the server stores its receipt with the invoice and stock update.
  try { sessionStorage.setItem(pendingCheckoutKey(), JSON.stringify(pending)); }
  catch (err) { toast(t('err.checkoutStorage'), true); return; }
  state.pendingSale = pending;
  await runPendingCheckout(false);
}

function finishCheckout(result) {
  if (!result.invoiceId) throw new Error(t('err.server'));
  clearPendingCheckout();
  state.cart = [];
  state.cust = { name: '', phone: '', address: '' };
  state.invoiceOverride = null;
  leaveGuard = null;
  toast(t('saleDone'));
  const hash = '#/invoice/' + encodeURIComponent(result.invoiceId);
  if (location.hash === hash) route(); else location.hash = hash;
}

function reviewCancelledCheckout(pending) {
  clearPendingCheckout();
  state.cart = pending.payload.items.map(item => ({ ...item }));
  state.cust = { ...pending.payload.customer };
  state.invoiceOverride = pending.payload.invoiceNumber ? { year: pending.payload.invoiceYear, number: pending.payload.invoiceNumber } : null;
  fixCart();
  leaveGuard = null;
  toast(t('checkoutCancelled'));
  if (location.hash === '#/pos') route(); else location.hash = '#/pos';
}

async function runPendingCheckout(cancel) {
  if (checkoutWorking || !state.pendingSale) return;
  const pending = state.pendingSale;
  if (!cancel && pending.generation !== state.generation) return toast(t('checkoutChanged'), true);
  checkoutWorking = true;
  renderPendingCheckout(false);
  try {
    const result = await api('POST', cancel ? '/api/sales/cancel' : '/api/sales', pending.payload);
    if (result.cancelled) reviewCancelledCheckout(pending);
    else finishCheckout(result);
  } catch (err) {
    toast(err.message, true);
    if (err.key === 'err.saleDeleted') {
      clearPendingCheckout();
      state.cart = []; state.cust = { name: '', phone: '', address: '' }; state.invoiceOverride = null;
      leaveGuard = null;
      location.hash = '#/invoices';
    } else if (err.key === 'err.saleCancelled') {
      try { await api('GET', '/api/data'); } catch (ignored) { /* remain safe if offline */ }
      reviewCancelledCheckout(pending);
    }
  } finally {
    checkoutWorking = false;
    if (state.pendingSale) renderPendingCheckout();
  }
}

function renderPendingCheckout(checkStatus = true) {
  const pending = state.pendingSale;
  if (!pending) return;
  $('#app').innerHTML = `${topbar(t('pos'))}
    <div class="page" style="max-width:800px">
      <section class="bg-white rounded shadow-sm p-4">
        <h4>${t('checkoutPending')}</h4>
        <p>${t('checkoutPendingHelp')}</p>
        <p><strong>${t('customer')}:</strong> <bdi>${esc(pending.payload.customer.name)}</bdi></p>
        ${pending.generation !== state.generation ? `<p class="text-warning">${t('checkoutChanged')}</p>` : ''}
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-brand" id="checkout-retry">${t('checkoutRetry')}</button>
          <button class="btn btn-outline-secondary" id="checkout-cancel">${t('checkoutReview')}</button>
        </div>
      </section>
    </div>`;
  const retry = $('#checkout-retry'), cancel = $('#checkout-cancel');
  const update = () => { retry.disabled = checkoutWorking || pending.generation !== state.generation; cancel.disabled = checkoutWorking; };
  retry.onclick = () => runPendingCheckout(false);
  cancel.onclick = () => runPendingCheckout(true);
  leaveGuard = () => { if (checkoutWorking) { toast(t('checkoutWait')); return false; } return true; };
  update();
  if (!checkStatus || checkoutWorking) return;
  // A lookup is read-only: reopening a tab never creates a sale automatically.
  checkoutWorking = true; update();
  api('GET', '/api/sales/requests/' + pending.payload.requestId).then(async result => {
    if (result.status === 'completed') {
      await api('GET', '/api/data'); finishCheckout(result);
    } else if (result.status === 'cancelled') {
      reviewCancelledCheckout(pending);
    } else if (result.status === 'deleted') {
      clearPendingCheckout(); state.cart = []; state.cust = { name: '', phone: '', address: '' }; state.invoiceOverride = null;
      leaveGuard = null; toast(t('err.saleDeleted'), true); location.hash = '#/invoices';
    }
  }).catch(err => { if (err.key !== 'err.notFound') toast(err.message, true); })
    .finally(() => { checkoutWorking = false; update(); });
}
