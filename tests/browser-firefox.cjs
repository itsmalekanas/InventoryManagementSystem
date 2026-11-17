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
  await page.locator('#a4-englishFont').selectOption('ibmplexsans');
  await page.locator('#a4-arabicFont').selectOption('ibmplexsansarabic');
  await page.locator('#text-labels-weight').selectOption('700');
  await page.locator('#text-values-size').fill('14');
  await page.locator('#sf-save').click(); await until(async () => (await data()).db.settings.a4Layout?.textStyles?.labels?.weight === 700);
  await go('#/settings', '#sf'); await page.locator('#settings-tab-invoice').click();
  assert.equal(await page.locator('#a4-englishFont').inputValue(), 'ibmplexsans');
  assert.equal(await page.locator('#a4-arabicFont').inputValue(), 'ibmplexsansarabic');
  assert.equal(await page.locator('#text-values-size').inputValue(), '14');
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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go('#/invoice/' + saved.db.invoices[0].id, '#inv-png');
  await page.screenshot({ path: path.join(artifacts, 'invoice-arabic-firefox.png'), fullPage: true });
  assert.equal(await page.locator('.inv-label').first().evaluate(el => getComputedStyle(el).fontWeight), '700');
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
  const restarted = await data(); assert.equal(restarted.db.invoices[0].code, code); assert.equal(restarted.db.settings.a4Layout.englishFont, 'ibmplexsans');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, browser: await browser.version(), platform: process.platform, artifacts, checks: 'Firefox offline UI/fonts, English/Arabic desktop/mobile, checkout, settings persistence, PNG/PDF, ZIP preview/cancel/restore, exit/restart' }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); app?.kill(); });
