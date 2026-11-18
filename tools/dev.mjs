// Local play with both modes: the global war on :5177 and blitz on :5178 (reached as /fast/ through the global one),
// so the start screen shows every mode and the page moves between them without reloading.
//   npm run dev                      (PORT / FAST_PORT change the ports)
// Blitz keeps its saves apart, in server/data/fast. Ctrl+C stops both.
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN = +process.env.PORT || 5177, FAST = +process.env.FAST_PORT || 5178;
const rooms = [
  // blitz is reached through the global server under /fast/, as nginx does it in production
  { tag: 'global', color: 36, env: { PORT: MAIN, FAST_URL: '/fast/', FAST_PROXY: `http://127.0.0.1:${FAST}` } },
  { tag: 'blitz ', color: 33, env: { PORT: FAST, HOST: '127.0.0.1', ROOM: 'fast', SIM_SPEED: process.env.FAST_SIM_SPEED || 1, CP_SECONDS: process.env.FAST_CP_SECONDS || 6, MAIN_URL: '/', DATA_DIR: path.join(process.env.DATA_DIR || path.join(ROOT, 'server', 'data'), 'fast') } },
];
const kids = rooms.map(r => {
  const env = { ...process.env, ...Object.fromEntries(Object.entries(r.env).map(([k, v]) => [k, String(v)])) };
  if (r.tag.trim() === 'global') { delete env.ROOM; delete env.MAIN_URL; }
  const kid = spawn(process.execPath, [path.join(ROOT, 'server', 'server.mjs')], { cwd: ROOT, env });
  const out = (stream, to) => { let buf = ''; stream.on('data', d => { buf += d; const lines = buf.split('\n'); buf = lines.pop(); for (const l of lines) to.write(`\x1b[${r.color}m[${r.tag}]\x1b[0m ${l}\n`); }); };
  out(kid.stdout, process.stdout); out(kid.stderr, process.stderr);
  kid.on('exit', code => { console.log(`[${r.tag}] stopped (${code})`); stop(); });
  return kid;
});
let stopping = false;
// Ctrl+C reaches the servers too and they save the world on their way out: give them a moment before forcing it
function stop() { if (stopping) return; stopping = true; setTimeout(() => { for (const k of kids) if (k.exitCode === null) k.kill('SIGTERM'); setTimeout(() => process.exit(0), 500); }, 2500); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
console.log(`Open http://localhost:${MAIN}/  (global war at /, blitz at /fast/)`);
