// Tiny helper: serves the game statically (offline mode) and accepts POST /save?name=x.png
// with a data: URL body, writing it to screens/. Used to capture explosion frames from the browser.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'screens'); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (q.method === 'POST' && u.pathname === '/save') {
    let body = ''; q.on('data', d => body += d); q.on('end', () => {
      const name = (u.searchParams.get('name') || 'shot.png').replace(/[^a-z0-9._-]/gi, '');
      fs.writeFileSync(path.join(out, name), Buffer.from(body.split(',')[1], 'base64')); r.end('ok');
    }); return;
  }
  let p = u.pathname === '/' ? '/index.html' : u.pathname; const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(+process.env.PORT || 5198);
