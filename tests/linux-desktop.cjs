// Linux GUI smoke check: run under xvfb-run + dbus-run-session on a disposable CI desktop.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { firefox } = require('playwright');
const binary = path.resolve(process.argv[2] || process.env.INVENTORY_TEST_EXE || require('./executable.cjs'));
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-linux-desktop-'));
let manager, browserPID, url;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch {} await pause(100); }
  throw new Error('Timed out waiting for Linux desktop check');
}
function command(file, args, options = {}) { return execFileSync(file, args, { encoding: 'utf8', timeout: 15000, ...options }); }
function desktopQuote(value) { return '"' + value.replace(/[\\"`$]/g, '\\$&') + '"'; }
(async () => {
  assert.equal(process.platform, 'linux'); assert.ok(process.env.DISPLAY, 'Run inside a disposable X11 display');
  const appDir = path.join(artifacts, 'Portable app with spaces'); fs.mkdirSync(appDir);
  for (const name of ['inventory', 'start.sh', 'icon.png']) {
    fs.copyFileSync(path.join(path.dirname(binary), name), path.join(appDir, name));
    fs.chmodSync(path.join(appDir, name), name === 'icon.png' ? 0o644 : 0o755);
  }
  const tools = path.join(artifacts, 'commands'), profile = path.join(artifacts, 'firefox-profile');
  fs.mkdirSync(tools); fs.mkdirSync(profile);
  fs.writeFileSync(path.join(profile, 'user.js'), [
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
    'user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);',
    'user_pref("browser.download.folderList", 2);',
    `user_pref("browser.download.dir", ${JSON.stringify(path.join(artifacts, 'downloads'))});`,
  ].join('\n'));
  // Real Firefox, isolated from normal user profiles. This shim supplies only the profile.
  const shim = '#!/bin/sh\nexec "$INVENTORY_GUI_FIREFOX" --profile "$INVENTORY_GUI_PROFILE" "$@"\n';
  fs.writeFileSync(path.join(tools, 'firefox'), shim, { mode: 0o755 });
  const env = { ...process.env, PATH: tools + ':' + process.env.PATH,
    INVENTORY_GUI_FIREFOX: firefox.executablePath(), INVENTORY_GUI_PROFILE: profile,
    MOZ_ENABLE_WAYLAND: '0' };
  manager = spawn('openbox', [], { env, stdio: 'ignore' });
  await until(() => command('xprop', ['-root', '_NET_SUPPORTING_WM_CHECK']).includes('window id'));
  const listener = net.createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve)); url = `http://127.0.0.1:${port}`;
  const desktop = path.join(appDir, 'Inventory.desktop');
  fs.writeFileSync(desktop, `[Desktop Entry]\nType=Application\nName=Inventory GUI smoke\nExec=${desktopQuote(path.join(appDir, 'start.sh'))} -port ${port}\nTerminal=false\nStartupNotify=false\n`, { mode: 0o755 });
  command('gio', ['launch', desktop], { env, cwd: os.tmpdir() });
  await until(async () => (await fetch(url + '/api/ping')).ok);
  const windowID = await until(() => command('xdotool', ['search', '--onlyvisible', '--name', 'Inventory Management System']).trim().split('\n')[0], 60000);
  browserPID = Number(command('xdotool', ['getwindowpid', windowID]).trim());
  assert.ok(fs.readFileSync(`/proc/${browserPID}/cmdline`, 'utf8').includes(profile), 'Only the test Firefox profile may be used');
  const title = command('xdotool', ['getwindowname', windowID]).trim();
  assert.ok(title.includes('Inventory Management System'));
  const dbPath = path.join(appDir, 'data', 'db.json'); assert.ok(fs.existsSync(dbPath));
  const initialDB = fs.readFileSync(dbPath);
  // Reopening the desktop entry should reuse the app and restore Firefox's window.
  command('xdotool', ['windowminimize', windowID]);
  await until(() => command('xwininfo', ['-id', windowID]).includes('IsUnMapped'));
  command('gio', ['launch', desktop], { env, cwd: os.tmpdir() });
  await until(() => command('xwininfo', ['-id', windowID]).includes('IsViewable'));
  assert.ok(fs.readFileSync(dbPath).equals(initialDB), 'Reopen must not rewrite data');
  const state = await (await fetch(url + '/api/data')).json();
  const response = await fetch(url + '/api/exit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Inventory-Generation': state.generation }, body: '{}' });
  assert.equal(response.status, 200);
  await until(async () => { try { await fetch(url + '/api/ping'); return false; } catch { return true; } });
  assert.ok(fs.readFileSync(dbPath).equals(initialDB));
  console.log(JSON.stringify({ passed: true, artifacts, title, checks: 'Linux desktop entry, actual Firefox GUI, paths with spaces, minimize/reopen, portable data and clean Exit' }, null, 2));
})().catch(error => {
  console.error(error);
  const log = path.join(artifacts, 'Portable app with spaces', 'launcher.log');
  if (fs.existsSync(log)) console.error(fs.readFileSync(log, 'utf8').slice(-12000));
  console.error('Desktop test artifacts:', artifacts);
  process.exitCode = 1;
}).finally(async () => {
  if (url) {
    try { const state = await (await fetch(url + '/api/data')).json(); await fetch(url + '/api/exit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Inventory-Generation': state.generation }, body: '{}' }); } catch {}
  }
  if (browserPID) {
    try { if (fs.readFileSync(`/proc/${browserPID}/cmdline`, 'utf8').includes(artifacts)) process.kill(browserPID); } catch {}
  }
  manager?.kill();
});
