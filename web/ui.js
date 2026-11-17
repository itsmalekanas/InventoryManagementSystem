'use strict';

const state = {
  exiting: false,
  db: null,
  appVersion: '',
  dataDir: '',
  generation: null,
  numbering: null,
  invoiceOverride: null,
  pendingSale: null,
  cart: [],                               // [{ productId, qty }]
  cust: { name: '', phone: '', address: '' },
  productSearch: '',
  productSort: 'newest',
  posSearch: '',
};

/* ---------------- helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function lang() { return state.db && state.db.settings.language === 'ar' ? 'ar' : 'en'; }

function t(key, vars) {
  let s = I18N[lang()][key] ?? I18N.en[key] ?? key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Escapes text and keeps groups of numbers such as "0770 123 4567" in
// left-to-right order, so phone numbers do not come out reversed inside
// Arabic lines.
function rich(v) {
  const s = String(v ?? '');
  let out = '', last = 0;
  for (const m of s.matchAll(/\+?\d+(?:[ \-\/.:]\d+)+/g)) {
    out += esc(s.slice(last, m.index)) + `<span dir="ltr">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}

// 25000 -> "25,000 IQD" / "25,000 د.ع"
function money(n) {
  return `<span class="num" dir="ltr">${Number(n || 0).toLocaleString('en-US')}</span> ${t('cur')}`;
}
function moneyText(n) { return `${Number(n || 0).toLocaleString('en-US')} ${t('cur')}`; }
function int(n) { return Number(n || 0).toLocaleString('en-US'); }

function normPhone(v) {
  const s = String(v ?? '').trim()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
  return (s.startsWith('+') ? '+' : '') + s.replace(/[^0-9]/g, '');
}

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function invoiceDateTime(iso, settings) {
  const value = fmtDate(iso);
  if (!value) return '';
  const [date, time] = value.split(' ');
  return [settings.showDate !== false ? date : '', settings.showTime !== false ? time : ''].filter(Boolean).join(' ');
}

function imgUrl(name) { return 'images/' + encodeURIComponent(name) + (state.generation ? '?v=' + encodeURIComponent(state.generation) : ''); }

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast-msg' + (isError ? ' error' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), isError ? 6000 : 2500);
}

async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': body instanceof Blob ? body.type : 'application/json',
        ...(state.generation && method !== 'GET' ? { 'X-Inventory-Generation': state.generation } : {}),
        ...(url === '/api/settings' && state.settingsToken ? { 'X-Inventory-Settings': state.settingsToken } : {}) },
      body: body === undefined ? undefined : (body instanceof Blob ? body : JSON.stringify(body)),
    });
  } catch (e) {
    throw new Error(t('err.offline'));
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty answer */ }
  if (!res.ok) {
    const err = new Error(t(data.error || 'err.server') + (data.error === 'err.backup' && data.detail ? ' ' + data.detail : ''));
    err.key = data.error;
    throw err;
  }
  if (data.db) {
    state.db = data.db; state.dataDir = data.dataDir; state.numbering = data.numbering || null; state.generation = data.generation; state.appVersion = data.version || ''; state.settingsToken = data.settingsToken || '';
    let warning = $('#backup-warning');
    if (!warning) { warning = document.createElement('div'); warning.id = 'backup-warning'; warning.className = 'alert alert-warning'; warning.setAttribute('role', 'alert'); document.body.appendChild(warning); }
    warning.hidden = !data.backupWarning;
    warning.textContent = data.backupWarning ? t('backupWarning') : '';
  }
  return data;
}

const productById = id => state.db.products.find(p => p.id === id);
const lowLimit = () => Number(state.db.settings.lowStock || 0);

function stockBadge(p) {
  if (p.stock <= 0) return `<span class="badge text-bg-danger">${t('outOfStock')}</span>`;
  if (p.stock <= lowLimit()) return `<span class="badge text-bg-warning">${esc(t('inStock', { n: int(p.stock) }))}</span>`;
  return `<span class="badge text-bg-light border">${esc(t('inStock', { n: int(p.stock) }))}</span>`;
}

function matches(q, ...fields) {
  q = q.trim().toLowerCase();
  if (!q) return true;
  return fields.some(f => String(f ?? '').toLowerCase().includes(q));
}

/* ---------------- modal ---------------- */

let modal, modalOpening = false, closeModalOnShown = false;
function openModal(html, opts = {}) {
  const dialog = $('#modal .modal-dialog');
  dialog.className = 'modal-dialog modal-dialog-centered modal-dialog-scrollable' + (opts.size ? ' modal-' + opts.size : '');
  $('#modal-content').innerHTML = html;
  if (!modal) {
    const element = $('#modal');
    element.addEventListener('show.bs.modal', () => { modalOpening = true; });
    element.addEventListener('shown.bs.modal', () => {
      modalOpening = false;
      if (closeModalOnShown) { closeModalOnShown = false; modal.hide(); }
    });
    element.addEventListener('hide.bs.modal', () => { modalOpening = false; closeModalOnShown = false; });
    modal = new bootstrap.Modal(element);
  }
  modal.show();
  return $('#modal-content');
}
function closeModal() {
  if (!modal) return;
  if (modalOpening) closeModalOnShown = true;
  else modal.hide();
}

function confirmBox(message, okText, danger = true) {
  return new Promise(resolve => {
    const box = openModal(`
      <div class="modal-body fs-5 py-4">${esc(message)}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-r="0">${t('cancel')}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-brand'}" data-r="1">${esc(okText)}</button>
      </div>`);
    let answer = false;
    box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { answer = b.dataset.r === '1'; closeModal(); });
    $('#modal').addEventListener('hidden.bs.modal', () => resolve(answer), { once: true });
  });
}

/* ---------------- layout ---------------- */

function applyTheme() {
  const theme = state.db.settings.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.bsTheme = theme;
  applyAccent(state.db.settings);
  try { localStorage.setItem('inventory-theme', theme); } catch (err) { /* optional first-paint cache */ }
}

let languageStylesReady = Promise.resolve(true);
function applyLang() {
  const l = lang();
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  const href = l === 'ar' ? 'vendor/bootstrap/bootstrap.rtl.min.css' : 'vendor/bootstrap/bootstrap.min.css';
  const link = $('#bs-css');
  if (!link.href.endsWith(href)) {
    languageStylesReady = new Promise(resolve => {
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
    });
    link.href = href;
  }
  applyTheme();
}

function colorLuminance(hex) {
  if (hex.length === 4) hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function colorContrast(a, b) {
  const values = [colorLuminance(a), colorLuminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function mixColor(a, b, amount) {
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
}

function contrastInk(color) {
  return colorContrast(color, '#171b22') > colorContrast(color, '#ffffff') ? '#171b22' : '#ffffff';
}

function applyAccent(settings) {
  const color = safeColor(settings.topbarColor, '#714b67');
  const ink = contrastInk(color);
  const hover = '#' + [1, 3, 5].map(i => {
    const value = parseInt(color.slice(i, i + 2), 16);
    return Math.round(ink === '#ffffff' ? value + (255 - value) * 0.12 : value * 0.9).toString(16).padStart(2, '0');
  }).join('');
  const root = document.documentElement.style;
  const dark = document.documentElement.dataset.bsTheme === 'dark';
  const surfaces = dark ? ['#2b2f36', '#353a43', '#3d444f'] : ['#f5f6f8', '#ffffff', '#f0f0f0'];
  const soft = mixColor(dark ? '#353a43' : '#ffffff', color, dark ? 0.18 : 0.12);
  surfaces.push(soft);
  const target = dark ? '#ffffff' : '#000000';
  let text = color;
  for (let step = 0; step <= 100; step++) {
    text = mixColor(color, target, step / 100);
    if (surfaces.every(surface => colorContrast(text, surface) >= 4.5)) break;
  }
  const textHover = mixColor(text, target, 0.15);
  const rgb = [1, 3, 5].map(i => parseInt(text.slice(i, i + 2), 16)).join(', ');
  root.setProperty('--brand', text);
  root.setProperty('--brand-soft', soft);
  root.setProperty('--brand-ring', `rgba(${rgb}, .25)`);
  root.setProperty('--bs-link-color', text);
  root.setProperty('--bs-link-color-rgb', rgb);
  root.setProperty('--bs-link-hover-color', textHover);
  root.setProperty('--bs-link-hover-color-rgb', [1, 3, 5].map(i => parseInt(textHover.slice(i, i + 2), 16)).join(', '));
  const svg = body => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`)}")`;
  root.setProperty('--app-check-image', svg(`<path fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="m4 8 3 3 5-6"/>`));
  root.setProperty('--app-switch-image', svg(`<circle cx="8" cy="8" r="3" fill="${ink}"/>`));
  root.setProperty('--brand-solid', color);
  root.setProperty('--brand-button-ink', ink);
  root.setProperty('--brand-hover', hover);
  root.setProperty('--brand-hover-ink', contrastInk(hover));
}

function topbarStyle(settings) {
  const color = safeColor(settings.topbarColor, '#714b67');
  return `--topbar-bg:${color};--topbar-ink:${contrastInk(color)}`;
}

function topbar(title, extra = '') {
  const s = state.db.settings;
  return `<nav class="topbar no-print" style="${topbarStyle(s)}">
    <a href="#/" class="btn btn-outline-light home-button" aria-label="${esc(t('home'))}" title="${esc(t('home'))}"><i class="bi bi-house-fill" aria-hidden="true"></i><span>${t('home')}</span></a>
    <div class="topbar-heading"><h1>${esc(title)}</h1>${s.storeName ? `<div class="store"><bdi>${esc(s.storeName)}</bdi></div>` : ''}</div>
    <div class="topbar-extra">${extra}</div>
  </nav>`;
}

function appTitle() {
  const name = state.db.settings.storeName;
  const title = [t('appName'), state.appVersion].filter(Boolean).join(' ');
  return name && name !== t('appName') ? title + ' — ' + name : title;
}
