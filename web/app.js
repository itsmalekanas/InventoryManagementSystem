'use strict';

/* =========================================================
   Inventory Management System – browser interface, no build step.
   All amounts are whole Iraqi dinars (integers).
   ========================================================= */

/* ---------------- router ---------------- */

let leaveGuard = null; // returns true when the page may be left
const dirtyForms = new WeakSet();
let settingsBusy = () => false;
for (const eventName of ['input', 'change']) document.addEventListener(eventName, event => {
  const form = event.target.closest?.('form');
  if (form) dirtyForms.add(form);
});

const routes = {
  '': renderHome,
  pos: renderPos,
  products: renderProducts,
  customers: renderCustomers,
  invoices: renderInvoices,
  invoice: renderInvoice,
  reports: renderReports,
  settings: renderSettings,
  backup: renderBackup,
};

function route() {
  settingsBusy = () => false;
  if (state.exiting) return;
  applyAccent(state.db.settings);
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const fn = routes[parts[0]] || renderHome;
  $('#page-style').textContent = '';
  document.title = appTitle();
  fn(...parts.slice(1));
  window.scrollTo(0, 0);
}

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, '', lastHash);
    return;
  }
  leaveGuard = null;
  lastHash = location.hash;
  route();
});

/* ---------------- home ---------------- */

function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function renderHome() {
  const { products, customers, invoices, settings } = state.db;
  const low = products.filter(p => p.stock <= lowLimit()).length;
  const now = new Date();
  const today = InventoryFinance.summary(invoices, date => isSameDay(new Date(date), now)).net;
  const tile = (href, icon, color, title, sub) => `
    <a class="tile" href="${href}">
      <i class="bi ${icon}" style="color:${color}"></i>
      <div class="tile-title">${esc(title)}</div>
      <div class="tile-sub">${sub}</div>
    </a>`;
  $('#app').innerHTML = `
    <div class="home">
      <div class="home-head">
        <div class="home-brand" dir="ltr">
          ${settings.logo ? `<img src="${imgUrl(settings.logo)}" alt="">` : '<i class="bi bi-shop fs-1 text-brand"></i>'}
          <div class="home-brand-text">
            <h1><bdi>${esc(settings.storeName || t('appName'))}</bdi></h1>
            <div class="small text-secondary">
              ${settings.storeName && settings.storeName !== t('appName') ? `<bdi>${esc(t('appName'))}</bdi>` : ''}
              ${state.appVersion ? `<span class="badge text-bg-light border app-version" dir="ltr">${esc(state.appVersion)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="home-actions">
          <button class="btn btn-outline-secondary language-button" id="lang-btn"><i class="bi bi-translate" aria-hidden="true"></i> ${t('switchLang')}</button>
          <button class="btn btn-outline-secondary theme-button" id="theme-btn" title="${esc(t(settings.theme === 'dark' ? 'lightMode' : 'darkMode'))}" aria-label="${esc(t('toggleTheme'))}" aria-pressed="${settings.theme === 'dark'}"><i class="bi ${settings.theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}" aria-hidden="true"></i></button>
          <button class="btn btn-outline-danger exit-button" id="exit-btn" title="${esc(t('exitApp'))}" aria-label="${esc(t('exitApp'))}"><i class="bi bi-power" aria-hidden="true"></i><span dir="auto">${t('exitLabel')}</span></button>
        </div>
      </div>
      <div class="tiles">
        ${tile('#/pos', 'bi-cart-plus', '#E45B35', t('pos'), esc(t('posSub')))}
        ${tile('#/products', 'bi-box-seam', '#377DCE', t('products'), esc(t('productsSub', { n: int(products.length), low: int(low) })))}
        ${tile('#/customers', 'bi-people', '#8864C8', t('customers'), esc(t('customersSub', { n: int(customers.length) })))}
        ${tile('#/invoices', 'bi-receipt', '#C88719', t('invoices'), esc(t('invoicesSub', { n: int(invoices.length) })))}
        ${tile('#/reports', 'bi-graph-up', '#26865D', t('reports'), esc(t('reportsSub', { v: moneyText(today) })))}
        ${tile('#/settings', 'bi-gear', '#64748B', t('settings'), esc(t('settingsSub')))}
        ${tile('#/backup', 'bi-shield-check', '#5965BE', t('backup'), esc(t('backupSub')))}
      </div>
    </div>`;
  const savePreference = async changes => {
    const buttons = $$('.home-actions button');
    buttons.forEach(button => { button.disabled = true; });
    try {
      await api('PUT', '/api/settings', { ...state.db.settings, ...changes });
      applyLang(); route();
    } catch (err) {
      toast(err.message, true);
      buttons.forEach(button => { button.disabled = false; });
    }
  };
  $('#lang-btn').onclick = () => savePreference({ language: lang() === 'ar' ? 'en' : 'ar' });
  $('#theme-btn').onclick = () => savePreference({ theme: state.db.settings.theme === 'dark' ? 'light' : 'dark' });
  $('#exit-btn').onclick = exitApp;
}

async function exitApp() {
  if (state.exiting) return;
  if (transferInProgress || checkoutWorking || state.pendingSale) return toast(t('exitBusy'), true);
  if (!await confirmBox(t('exitConfirm'), t('exitApp'))) return;
  state.exiting = true;
  const status = (title, help, spinner = false) => {
    document.title = title + ' — ' + t('appName');
    $('#app').innerHTML = `<main class="page text-center py-5" role="status">${spinner ? '<div class="spinner-border text-brand mb-3" aria-hidden="true"></div>' : '<i class="bi bi-power display-4 text-brand d-block mb-3" aria-hidden="true"></i>'}<h1 class="h3">${esc(title)}</h1><p class="text-secondary">${esc(help)}</p></main>`;
    $('#toasts').replaceChildren();
  };
  status(t('appClosing'), t('appClosingHelp'), true);
  try {
    const result = await api('POST', '/api/exit', {});
    if (!result.closed) throw new Error(t('exitUncertain'));
    state.cart = [];
    leaveGuard = null;
    status(t('appClosed'), t('appClosedHelp'));
  } catch (err) {
    if (err.key) { state.exiting = false; route(); toast(err.message, true); }
    else status(t('exitApp'), t('exitUncertain'));
  }
}

/* ---------------- start ---------------- */

(async function start() {
  try {
    await api('GET', '/api/data');
  } catch (e) {
    $('#app').innerHTML = `<div class="p-5 text-center text-danger">${esc(e.message)}</div>`;
    return;
  }
  applyLang();
  if (restorePendingCheckout()) location.hash = '#/pos';
  route();
})();
