// Helper for recording the trailer: serves tools/trailer.js to the game page and saves the uploaded video to media/.
// node tools/trailer-server.mjs   (port 5199)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), media = path.join(here, '..', 'media');
fs.mkdirSync(media, { recursive: true });
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.end();
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/trailer.js') { res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store'); return res.end(fs.readFileSync(path.join(here, 'trailer.js'))); }
  if (req.method === 'POST' && u.pathname === '/save') {
    const name = path.basename(u.searchParams.get('name') || 'trailer.webm'), file = path.join(media, name), ws = fs.createWriteStream(file);
    req.pipe(ws); ws.on('finish', () => { const n = fs.statSync(file).size; console.log('saved', file, n); res.end('saved ' + n); });
    return;
  }
  res.statusCode = 404; res.end();
}).listen(5199, '127.0.0.1', () => console.log('trailer helper on http://127.0.0.1:5199'));
