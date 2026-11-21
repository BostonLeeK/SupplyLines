// Helper for recording the trailer (port 5199):
//   GET  /trailer.js            the director script for the game page
//   GET  /start?name=&fps=      starts ffmpeg for a frame-by-frame render into media/<name>
//   POST /frame                 one JPEG frame, piped into ffmpeg
//   GET  /end                   closes the stream and waits for the mp4
//   POST /save?name=            saves an uploaded file (the audio pass, or a real-time recording) to media/
//   GET  /shorts.js, /shorts/<id>-<lang>/timeline.json   the shorts director and its voice timelines
// node tools/trailer-server.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), media = path.join(here, '..', 'media');
fs.mkdirSync(media, { recursive: true });
let ff = null, ffDone = null, frames = 0;
const body = req => new Promise(r => { const parts = []; req.on('data', d => parts.push(d)); req.on('end', () => r(Buffer.concat(parts))); });
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.end();
  const u = new URL(req.url, 'http://x');
  // shorts: the director script and each short's voice timeline (made by tools/shorts-voice.mjs)
  if (req.method === 'GET' && u.pathname === '/shorts.js') { res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store'); return res.end(fs.readFileSync(path.join(here, 'shorts.js'))); }
  if (req.method === 'GET' && u.pathname.startsWith('/shorts/')) {
    const file = path.join(media, 'shorts', ...u.pathname.slice(8).split('/').map(x => path.basename(decodeURIComponent(x))));
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('no ' + u.pathname); }
    res.setHeader('Cache-Control', 'no-store'); if (file.endsWith('.json')) res.setHeader('Content-Type', 'application/json'); return res.end(fs.readFileSync(file));
  }
  if (req.method === 'GET' && u.pathname === '/trailer.js') { res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-store'); return res.end(fs.readFileSync(path.join(here, 'trailer.js'))); }
  if (u.pathname === '/start') {
    if (ff) { ff.stdin.end(); await ffDone; }
    const file = path.join(media, path.basename(u.searchParams.get('name') || 'trailer.mp4')), fps = String(+u.searchParams.get('fps') || 60);
    ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', fps, '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    ffDone = new Promise(r => ff.on('close', code => r(code))); frames = 0;
    console.log('render →', file, fps, 'fps'); return res.end('started');
  }
  if (req.method === 'POST' && u.pathname === '/frame') {
    const b = await body(req); if (!ff) { res.statusCode = 409; return res.end('not started'); }
    ff.stdin.write(b, () => { frames++; if (frames % 300 === 0) console.log('frames', frames); res.end('ok'); }); return;
  }
  if (u.pathname === '/end') { if (!ff) return res.end('nothing'); ff.stdin.end(); const code = await ffDone; ff = null; console.log('render done', frames, 'frames, ffmpeg', code); return res.end(`done ${frames} frames, ffmpeg ${code}`); }
  if (req.method === 'POST' && u.pathname === '/save') {
    const name = path.basename(u.searchParams.get('name') || 'trailer.webm'), file = path.join(media, name), ws = fs.createWriteStream(file);
    req.pipe(ws); ws.on('finish', () => { const n = fs.statSync(file).size; console.log('saved', file, n); res.end('saved ' + n); });
    return;
  }
  res.statusCode = 404; res.end();
}).listen(5199, '127.0.0.1', () => console.log('trailer helper on http://127.0.0.1:5199'));
