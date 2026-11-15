// Renders the brand kit (brand/src/kit.html) to PNG with headless Chrome over the DevTools protocol.
// node tools/make-brand.mjs                 every asset, both languages
// node tools/make-brand.mjs yt-thumb-nuke   only assets whose name contains the filter
// Output: brand/logo/*.png (language-neutral), brand/en/*.png, brand/uk/*.png, and the game's icons/*.png, og.jpg, og-uk.jpg
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kit = pathToFileURL(path.join(root, 'brand', 'src', 'kit.html')).href;
const filter = process.argv[2] || '';
const chromes = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const exe = chromes.find(p => fs.existsSync(p));
if (!exe) throw new Error('Chrome not found, set CHROME=<path>');

const port = 9300 + Math.floor(Math.random() * 500);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-brand-'));
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--allow-file-access-from-files',
  '--hide-scrollbars', '--force-color-profile=srgb', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver;
for (let i = 0; i < 50 && !ver; i++) { await sleep(200); ver = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).catch(() => null); }
const page = ver.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 512 * 1024 * 1024 });
await new Promise(r => ws.once('open', r));
let id = 0; const wait = new Map(), events = [];
ws.on('message', m => { const d = JSON.parse(m); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else if (d.method) events.push(d); });
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, d => d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const evalP = async expr => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;
async function open(url, w, h, dsf, clear) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile: false });
  await cdp('Emulation.setDefaultBackgroundColorOverride', clear ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
  await cdp('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { await sleep(100); if (await evalP('typeof window.ready').catch(() => '') === 'object') break; }
  return evalP('window.ready');
}

await cdp('Page.enable'); await cdp('Runtime.enable');
await open(kit, 800, 600, 1, false);
const assets = await evalP('window.ASSETS');
let n = 0;
for (const [name, a] of Object.entries(assets)) {
  if (filter && !name.includes(filter)) continue;
  for (const lang of a.langs) {
    const dir = path.join(root, 'brand', lang === 'x' ? 'logo' : lang);
    fs.mkdirSync(dir, { recursive: true });
    const box = await open(`${kit}?a=${name}&l=${lang === 'x' ? 'en' : lang}`, a.w || 2400, a.h || 1400, a.dsf, a.clear);
    const clip = { x: box.x, y: box.y, width: Math.ceil(box.w), height: Math.ceil(box.h), scale: 1 };
    const shot = await cdp('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true, fromSurface: true });
    const file = path.join(dir, `${name}${lang === 'x' ? '' : '-' + lang}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(path.relative(root, file), `${Math.round(clip.width * a.dsf)}×${Math.round(clip.height * a.dsf)}`); n++;
    for (const [rel, dsf] of a.out[lang] || []) {   // copies the game itself uses: icons/, og.jpg
      const b = await open(`${kit}?a=${name}&l=${lang === 'x' ? 'en' : lang}`, a.w, a.h, dsf, a.clear);
      const jpg = rel.endsWith('.jpg');
      const o = await cdp('Page.captureScreenshot', { format: jpg ? 'jpeg' : 'png', quality: jpg ? 88 : undefined, captureBeyondViewport: true, fromSurface: true,
        clip: { x: b.x, y: b.y, width: Math.ceil(b.w), height: Math.ceil(b.h), scale: 1 } });
      fs.writeFileSync(path.join(root, rel), Buffer.from(o.data, 'base64'));
      console.log(rel, `${Math.round(b.w * dsf)}×${Math.round(b.h * dsf)}`); n++;
    }
  }
}
if (!filter || 'svg'.includes(filter)) {   // the mark as plain vector files (no fonts inside)
  await open(kit, 800, 600, 1, false);
  const svgs = await evalP(`[['logo-mark', mark(1000)], ['logo-mark-mono-white', mark(1000, { mono: 1 })], ['logo-mark-mono-navy', mark(1000, { mono: 1, ink: '#0b1420' })]]`);
  for (const [f, svg] of svgs) {
    fs.writeFileSync(path.join(root, 'brand', 'logo', f + '.svg'), svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ style="[^"]*"/, '').replace(/\n\s*/g, '\n'));
    console.log('brand/logo/' + f + '.svg'); n++;
  }
}
ws.close(); chrome.kill();
await sleep(300); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
console.log(n, 'files');
