// Regenerate Windows icons from the user's PNG. Requires Node 22+ and Chrome.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-icon-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let output = '';
chrome.stderr.on('data', chunk => output += chunk);
let socket;
(async () => {
  const deadline = Date.now() + 20000;
  while (!output.includes('DevTools listening on')) {
    if (Date.now() > deadline) throw new Error('Chrome did not start');
    await new Promise(r => setTimeout(r, 100));
  }
  socket = new WebSocket(output.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1]);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const seq = ++id;
    pending.set(seq, msg => msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result));
    socket.send(JSON.stringify({ id: seq, method, params, sessionId }));
  });
  const { targetInfos } = await call('Target.getTargets');
  const { sessionId } = await call('Target.attachToTarget', { targetId: targetInfos.find(t => t.type === 'page').targetId, flatten: true });
  const source = fs.readFileSync(path.join(root, 'assets/app.png'));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const result = await call('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + ${JSON.stringify(source.toString('base64'))};
      await img.decode();
      return ${JSON.stringify(sizes)}.map(size => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
        const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
        ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
        return canvas.toDataURL('image/png').split(',')[1];
      });
    })()`, awaitPromise: true, returnByValue: true
  }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  const images = result.result.value.map(data => Buffer.from(data, 'base64'));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const p = 6 + i * 16;
    header[p] = header[p + 1] = size % 256;
    header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(images[i].length, p + 8); header.writeUInt32LE(offset, p + 12);
    offset += images[i].length;
  });
  fs.writeFileSync(path.join(root, 'assets/app.ico'), Buffer.concat([header, ...images]));
  fs.copyFileSync(path.join(root, 'assets/app.ico'), path.join(root, 'web/favicon.ico'));
  fs.writeFileSync(path.join(root, 'assets/tray.png'), images[sizes.indexOf(32)]);
  console.log('Generated assets/app.ico: ' + sizes.join(', '));
})().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => { socket?.close(); chrome.kill(); });
