// Cross-platform Firefox checks. All app data, profiles and downloads are temporary.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { firefox } = require('playwright');
const executable = path.resolve(process.argv[2] || process.env.INVENTORY_TEST_EXE || require('./executable.cjs'));
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-firefox-'));
let browser, app;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await pause(80); }
  throw new Error('Timed out');
}
(async () => {
  const listener = net.createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  const appData = path.join(artifacts, 'synthetic-data');
  const launch = () => { app = spawn(executable, ['-port', String(port), '-data', appData, '-no-browser', '-no-tray'], { windowsHide: true, stdio: 'ignore' }); };
  const data = async () => (await fetch(url + '/api/data')).json();
  const ready = () => until(async () => { try { return (await data()).db; } catch { return false; } });
  launch(); await ready();
  browser = await firefox.launch({ headless: true, downloadsPath: path.join(artifacts, 'browser-downloads') });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  // No internet is available to the tested app, even when the test host has it.
  await context.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [], downloads = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('download', download => downloads.push(download));
  const go = async (hash, selector) => { await page.goto(url + '/' + hash); await page.locator(selector).waitFor({ state: 'attached' }); await page.evaluate(() => languageStylesReady); await page.evaluate(() => document.fonts.ready); };
  await go('#/', '#lang-btn');
  for (const language of ['en', 'ar']) {
    if (await page.evaluate(() => state.db.settings.language) !== language) await page.locator('#lang-btn').click();
    await page.waitForFunction(lang => document.documentElement.dir === (lang === 'ar' ? 'rtl' : 'ltr') && !document.querySelector('#lang-btn').disabled, language);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('AppPlexLatin')), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('AppPlexArabic')), true);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(artifacts, `home-${language}-${width}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Create stock through the browser, then complete an actual checkout.
  await go('#/products', '#p-add'); await page.locator('#p-add').click();
  await page.locator('#pf [name=name]').fill('Firefox synthetic product');
  await page.locator('#pf [name=price]').fill('25000'); await page.locator('#pf [name=stock]').fill('10');
  await page.locator('#pf-save').click(); await until(async () => (await data()).db.products.length === 1);
  await go('#/pos', '#sale-btn'); await page.locator('.pcard').first().click();
  await page.locator('#c-name').fill('Firefox synthetic buyer'); await page.locator('#sale-btn').click();
  await page.locator('#inv-png').waitFor();
  const saved = await data(); assert.equal(saved.db.products[0].stock, 9); assert.equal(saved.db.invoices.length, 1);
  const code = saved.db.invoices[0].code;
  assert.equal(downloads.length, 0, 'Ordinary navigation/checkout must not download files');
  // Configure new offline fonts and text overrides, save, and reload.
  await go('#/settings', '#sf'); await page.locator('#settings-tab-invoice').click();
  // Burst edits must produce a single invoice render with the final draft.
  const burst = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    const target = document.querySelector('#sf-preview');
    const input = document.querySelector('#sf').storeName;
    const original = input.value;
    let renders = 0;
    const observer = new MutationObserver(records => { renders += records.filter(record => record.target === target).length; });
    observer.observe(target, { childList: true });
    for (let i = 0; i < 20; i++) {
      input.value = 'Preview burst ' + i;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const dirtyImmediately = document.querySelector('#sf-save-status').dataset.unsaved;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const result = { renders, dirtyImmediately, latest: target.textContent.includes('Preview burst 19') };
    observer.disconnect();
    input.value = original; input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(requestAnimationFrame);
    return result;
  });
  assert.deepEqual(burst, { renders: 1, dirtyImmediately: 'true', latest: true });
  // A first typography edit must preserve the header alignment inherited from the logo.
  assert.equal((await data()).db.settings.a4Layout, undefined);
  await page.locator('#sf [name=logoAlign]').selectOption('start');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#sf-preview .inv-store')).textAlign === 'end');
  assert.equal(await page.locator('#sf-a4').isVisible(), true);
  assert.equal(await page.locator('[data-font-sample]').count(), 2);
  await page.locator('#text-store-weight').selectOption('500');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#sf-preview .inv-store')).fontWeight === '500');
  assert.equal(await page.locator('#sf-preview .inv-store').evaluate(el => getComputedStyle(el).textAlign), 'end');
  await page.locator('#sf-design').selectOption('compact');
  assert.equal(await page.locator('#sf-a4').isVisible(), true);
  assert.equal(await page.locator('#a4-margin').inputValue(), '8');
  assert.equal(await page.locator('#text-store-weight').inputValue(), '');
  assert.equal((await data()).db.settings.a4Layout, undefined);
  await page.locator('#sf-design').selectOption('spacious');
  assert.equal(await page.locator('#a4-fontSize').inputValue(), '18');
  await page.locator('#sf-design').selectOption('custom');
  assert.equal(await page.locator('#sf-a4').isVisible(), true);
  assert.equal(await page.locator('#text-store-weight').inputValue(), '500');
  assert.equal(await page.locator('#a4-headerAlign').inputValue(), 'end');
  await page.locator('#sf-paper').selectOption('receipt');
  assert.equal(await page.locator('#sf-a4').isVisible(), false);
  await page.locator('#sf-paper').selectOption('a4');
  assert.equal(await page.locator('#text-store-weight').inputValue(), '500');
  await page.locator('#text-labels-weight').selectOption('700');
  await page.locator('#text-values-size').fill('14');
  await page.locator('#sf-custom-widths').check();
  await page.locator('#a4-englishFont').selectOption('systemarial');
  assert.equal(await page.locator('#a4-arabicFont').inputValue(), 'ibmplexsansarabic');
  await page.locator('#a4-arabicFont').selectOption('systemarial');
  await page.waitForFunction(() => {
    const font = getComputedStyle(document.querySelector('#sf-preview .invoice')).fontFamily;
    return font.includes('InvoiceLatin-systemarial') && font.includes('InvoiceArabic-systemarial');
  });
  if (process.platform === 'win32') {
    assert.equal(await page.evaluate(async () => {
      for (const [family, sample] of [['InvoiceLatin-systemarial', 'Invoice'], ['InvoiceArabic-systemarial', '\u0641\u0627\u062A\u0648\u0631\u0629']]) {
        for (const weight of [400, 700]) {
          const faces = await document.fonts.load(`${weight} 16px ${family}`, sample);
          if (!faces.length || faces.some(face => face.status !== 'loaded')) return false;
        }
      }
      return true;
    }), true);
  }
  await page.locator('#invoice-width-price').fill('12');
  await page.waitForFunction(() => document.querySelector('#sf-preview col:nth-child(3)')?.style.width === '12%');
  await page.locator('#invoice-width-price').fill('35');
  await page.locator('#invoice-width-total').fill('35');
  assert.equal(await page.locator('#invoice-width-number').evaluate(input => input.validity.customError), true);
  await page.locator('#invoice-width-total').fill('18');
  await page.locator('#invoice-width-price').fill('12');
  await page.locator('#sf-custom-widths').uncheck();
  await page.locator('#sf-preview colgroup').waitFor({ state: 'detached' });
  await page.locator('#sf-custom-widths').check();
  assert.equal(await page.locator('#sf-text-styles input[type=color]').count(), 0);
  assert.equal(await page.locator('#sf-text-styles .color-picker-trigger').count(), 9);
  await page.locator('[data-color-picker=textStyle_labels] .color-picker-trigger').click();
  const styleHex = page.locator('#picker-textStyle_labels .color-picker-hex');
  await styleHex.fill('#12'); await page.locator('#sf-save').click();
  assert.equal(await styleHex.getAttribute('aria-invalid'), 'true');
  assert.equal(await styleHex.evaluate(el => el === document.activeElement), true);
  await page.locator('#sf-text-reset').click();
  assert.equal(await styleHex.getAttribute('aria-invalid'), 'false');
  await page.locator('#text-store-weight').selectOption('500');
  await page.locator('#text-labels-weight').selectOption('700');
  await page.locator('#text-values-size').fill('14');
  await styleHex.fill('#123456'); await styleHex.press('Escape');
  assert.equal(await page.locator('#picker-textStyle_labels').isVisible(), false);
  await page.locator('#sf-save').click(); await until(async () => (await data()).db.settings.a4Layout?.textStyles?.labels?.weight === 700);
  await go('#/settings', '#sf'); await page.locator('#settings-tab-invoice').click();
  assert.equal(await page.locator('#text-values-size').inputValue(), '14');
  assert.equal(await page.locator('#text-labels-color').inputValue(), '#123456');
  assert.equal(await page.locator('#invoice-width-price').inputValue(), '12');
  assert.equal(await page.locator('#a4-englishFont').inputValue(), 'systemarial');
  assert.equal(await page.locator('#a4-arabicFont').inputValue(), 'systemarial');
  assert.equal(await page.locator('#sf-save-status').getAttribute('data-unsaved'), 'false');
  assert.equal(await page.evaluate(async () => {
    for (const family of ['AppPlexLatin', 'AppPlexArabic', 'InvoiceLatin-ibmplexsans', 'InvoiceArabic-ibmplexsansarabic']) {
      for (const weight of [400, 500, 700]) {
        const faces = await document.fonts.load(`${weight} 18px ${family}`, family.includes('Arabic') ? 'فاتورة' : 'Invoice');
        if (!faces.length || faces.some(face => face.status !== 'loaded')) return false;
      }
    } return true;
  }), true);
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('[data-color-picker=textStyle_labels] .color-picker-trigger').click();
  const panelBox = await page.locator('#picker-textStyle_labels').boundingBox();
  assert.ok(panelBox.x >= 0 && panelBox.x + panelBox.width <= 390);
  assert.ok(panelBox.y >= 0 && panelBox.y + panelBox.height <= 900);
  await page.screenshot({ path: path.join(artifacts, 'text-style-picker-mobile.png') });
  await styleHex.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo({ top: document.querySelector('#sf-text-styles').getBoundingClientRect().top + scrollY - document.querySelector('.settings-toolbar').getBoundingClientRect().height - 12, behavior: 'instant' }));
  await page.screenshot({ path: path.join(artifacts, 'text-styles-compact.png') });
  await go('#/invoice/' + saved.db.invoices[0].id, '#inv-png');
  await page.screenshot({ path: path.join(artifacts, 'invoice-arabic-firefox.png'), fullPage: true });
  assert.equal(await page.locator('.inv-label').first().evaluate(el => getComputedStyle(el).fontWeight), '700');
  assert.deepEqual(await page.locator('.inv-store').evaluate(el => {
    const style = getComputedStyle(el);
    return [style.textAlign, style.fontWeight];
  }), ['end', '500']);
  for (const format of ['png', 'pdf']) {
    const pending = page.waitForEvent('download', { timeout: 60000 });
    await page.locator('#inv-' + format).click(); const download = await pending;
    assert.equal(download.suggestedFilename(), code + '.' + format);
    const target = path.join(artifacts, code + '.' + format); await download.saveAs(target);
    const bytes = fs.readFileSync(target);
    assert.equal(format === 'png' ? bytes.subarray(0, 8).toString('hex') : bytes.subarray(0, 5).toString(), format === 'png' ? '89504e470d0a1a0a' : '%PDF-');
    await page.locator('#inv-' + format).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#inv-pdf').disabled);
  }
  // Keep long product names within the page and verify that pagination
  // includes every row in order, with identical columns and no blank pages.
  const longPdf = page.waitForEvent('download', { timeout: 60000 });
  const pages = await page.evaluate(async () => {
    const original = window.html2pdf;
    const pages = [];
    window.html2pdf = () => {
      const worker = original();
      const set = worker.set;
      worker.set = function(options) {
        options.html2canvas.onclone = doc => {
          const invoice = doc.querySelector('.html2pdf__container .invoice');
          const table = invoice.querySelector('.inv-table');
          pages.push({
            rows: Array.from(table.tBodies[0].rows, row => Number(row.cells[0].textContent)),
            columns: Array.from(table.querySelectorAll('col'), col => col.style.width),
            fits: table.getBoundingClientRect().width <= invoice.getBoundingClientRect().width,
            totals: Boolean(table.tFoot),
            logo: Boolean(invoice.querySelector('img')),
          });
        };
        return set.call(this, options);
      };
      return worker;
    };
    try {
      const inv = state.db.invoices[0];
      const items = Array.from({ length: 65 }, (_, index) => ({
        ...inv.items[0], name: index === 0 ? 'LongProductCode'.repeat(10) : 'Synthetic row ' + index,
      }));
      await downloadInvoicePdf({ ...inv, code: 'LONG-INVOICE', items }, { ...state.db.settings, logo: 'missing.png' });
      return pages;
    } finally {
      window.html2pdf = original;
    }
  });
  const longPdfFile = path.join(artifacts, 'long-invoice.pdf');
  await (await longPdf).saveAs(longPdfFile);
  const pdfPageCount = Array.from(fs.readFileSync(longPdfFile).toString('latin1').matchAll(/\/Type \/Page\b/g)).length;
  assert.ok(pages.length > 1);
  assert.equal(pdfPageCount, pages.length);
  assert.equal(pages[0].columns.length, 5);
  assert.equal(pages[0].columns[2], '12%');
  assert.ok(pages.every(page => page.fits && !page.logo && JSON.stringify(page.columns) === JSON.stringify(pages[0].columns)));
  assert.deepEqual(pages.flatMap(page => page.rows), Array.from({ length: 65 }, (_, index) => index + 1));
  assert.equal(pages.findIndex(page => page.totals), pages.length - 1);
  // Browser ZIP download, restore-preview/cancel, then actual restore.
  await go('#/backup', '#backup-export');
  const pendingBackup = page.waitForEvent('download'); await page.locator('#backup-export').click();
  const backup = await pendingBackup, zipPath = path.join(artifacts, backup.suggestedFilename()); await backup.saveAs(zipPath);
  assert.equal(fs.readFileSync(zipPath).subarray(0, 2).toString(), 'PK');
  await page.locator('#backup-file').setInputFiles(zipPath); await page.locator('#backup-commit').waitFor();
  assert.equal((await data()).db.invoices.length, 1); await page.locator('#backup-cancel').click();
  await page.locator('#backup-commit').waitFor({ state: 'detached' });
  const beforeRestore = (await data()).db;
  await page.locator('#backup-file').setInputFiles(zipPath); await page.locator('#backup-commit').waitFor();
  await page.locator('#backup-commit').click(); await page.locator('#modal.show [data-r]:last-child').click();
  await page.locator('.alert-success code').waitFor();
  assert.deepEqual((await data()).db, beforeRestore);
  // Clean exit/restart preserves the synthetic invoice and the selected fonts.
  await go('#/', '#exit-btn'); await page.locator('#exit-btn').click();
  await page.locator('#modal.show [data-r]:last-child').click();
  await until(() => app.exitCode !== null);
  launch(); await ready();
  const restarted = await data(); assert.equal(restarted.db.invoices[0].code, code);
  assert.equal(restarted.db.settings.a4Layout.englishFont, 'systemarial');
  assert.equal(restarted.db.settings.a4Layout.arabicFont, 'systemarial');
  await page.goto(url + '/?restart=1#/settings');
  await page.locator('#sf').waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    const settings = state.db.settings;
    await api('PUT', '/api/settings', { ...settings, a4Layout: { ...settings.a4Layout, englishFont: 'googlesans' } });
    route();
  });
  const legacy = (await data()).db;
  await page.locator('#settings-tab-invoice').click();
  await page.locator('#sf-design').selectOption('compact');
  await page.locator('#sf-save').click();
  const updated = await until(async () => {
    const db = (await data()).db;
    if (db.settings.a4Layout.margin === 8) return db;
  });
  assert.equal(updated.settings.a4Layout.englishFont, 'googlesans');
  assert.equal(updated.settings.a4Layout.headerAlign, legacy.settings.a4Layout.headerAlign);
  assert.deepEqual(updated.invoices, legacy.invoices);
  await go('#/settings', '#sf');
  await page.locator('#settings-tab-invoice').click();
  assert.equal(await page.locator('#sf-design').inputValue(), 'compact');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, browser: await browser.version(), platform: process.platform, artifacts, checks: 'Firefox offline UI/fonts, English/Arabic desktop/mobile, checkout, settings persistence, PNG/PDF, ZIP preview/cancel/restore, exit/restart' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); app?.kill(); });
