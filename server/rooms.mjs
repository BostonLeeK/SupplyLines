// Private games: a player creates one on the start screen and sends the link to friends. Each game is a world of its
// own: a child copy of this server on a local port, reached through /r/CODE/ on the main server, which passes the
// page, its files and the game socket through. A game closes by itself once nobody has been in it for a while
// (IDLE_EXIT_MIN in the child), and nothing of it is kept.
import { spawn } from 'child_process';
import net from 'net';
import { proxyHttp, proxyUpgrade } from './proxy.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_MINUTES = [15, 30, 60, 120];
const ROOM_BOTS = { few: 20, many: 70 };          // bots per faction: a duel among friends, or a lively front

export function createRooms({ ROOT, PORT, max = 3, idleMin = 10 }) {
  const rooms = new Map();                          // code -> { code, port, child, ready, minutes, bots, at, dir, waiters }
  const lastBy = new Map();                         // ip -> when it last created a game
  const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
  const isReady = (room, ms) => room.ready ? Promise.resolve(true) : new Promise(r => { room.waiters.push(r); setTimeout(() => r(room.ready), ms); });

  async function create(opts, ip) {
    const minutes = ROOM_MINUTES.includes(+opts.minutes) ? +opts.minutes : 30, bots = ROOM_BOTS[opts.bots] || ROOM_BOTS.few;
    if (rooms.size >= max) return { ok: false, msg: 'All private games are taken right now. Try again in a few minutes' };
    if (Date.now() - (lastBy.get(ip) || 0) < 60000) return { ok: false, msg: 'You have just created a game. Wait a minute' };
    lastBy.set(ip, Date.now());
    let code; do code = Array.from({ length: 6 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join(''); while (rooms.has(code));
    const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-game-' + code + '-'));
    const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', ROOM: 'private', ROOM_CODE: code, DATA_DIR: dir,
      SIM_SPEED: String(15 / minutes),                                      // 900 sim-seconds in `minutes` real minutes
      CP_SECONDS: String(Math.max(5, Math.round(minutes * 60 / 160))),       // about 160 CP a season, as in the 2-hour war
      BOTS: String(bots), MAIN_URL: '/', IDLE_EXIT_MIN: String(idleMin), REALWAR_FROM: `http://127.0.0.1:${PORT}/realwar.json` };
    for (const k of ['FAST_PROXY', 'GOOGLE_CLIENT_ID', 'STATS_KEY', 'PRIVATE_GAMES']) delete env[k];   // FAST_URL stays: the game's page links to blitz too
    const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.mjs')], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const room = { code, port, child, ready: false, minutes, bots, at: Date.now(), dir, waiters: [] };
    rooms.set(code, room);
    child.stdout.on('data', d => { if (!room.ready && /room on http/.test(String(d))) { room.ready = true; room.waiters.splice(0).forEach(f => f(true)); } });
    child.stderr.on('data', d => process.stderr.write(`[game ${code}] ${d}`));
    child.on('exit', () => { rooms.delete(code); room.waiters.splice(0).forEach(f => f(false)); fs.rm(dir, { recursive: true, force: true }, () => {}); console.log(`private game ${code} closed`); });
    if (!await isReady(room, 20000)) { child.kill(); return { ok: false, msg: 'Could not start the game. Try again' }; }
    console.log(`private game ${code} opened: ${minutes}-minute seasons, ${bots} bots per side (${rooms.size}/${max})`);
    return { ok: true, code };
  }

  // POST /api/games {minutes, bots} creates one; /r/CODE/... is passed to that game's server
  function handle(req, res, p, ip) {
    if (p === '/api/games') {
      if (req.method !== 'POST') { res.writeHead(405); res.end(); return true; }
      let body = ''; req.on('data', d => { body += d; if (body.length > 2000) req.destroy(); });
      req.on('end', async () => {
        let o = {}; try { o = JSON.parse(body || '{}'); } catch {}
        const r = await create(o, ip).catch(e => ({ ok: false, msg: 'Could not start the game. Try again', err: e.message }));
        if (r.err) console.error('private game', r.err);
        res.writeHead(r.ok ? 200 : 429, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ ok: r.ok, code: r.code, msg: r.msg }));
      });
      return true;
    }
    if (p === '/api/games.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); res.end(JSON.stringify({ open: rooms.size, max, minutes: ROOM_MINUTES })); return true; }
    const m = /^\/r\/([A-Za-z0-9]{6})(\/.*)?$/.exec(p); if (!m) return false;
    const room = rooms.get(m[1].toUpperCase()), q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    if (!room) { res.writeHead(302, { location: '/?game=gone' + (/[?&]lang=uk/.test(q) ? '&lang=uk' : '') }); res.end(); return true; }
    if (!m[2] || m[1] !== room.code) { res.writeHead(301, { location: `/r/${room.code}/${q}` }); res.end(); return true; }
    isReady(room, 20000).then(ok => {
      if (!ok) { res.writeHead(502); return res.end('game is not available'); }
      proxyHttp(req, res, room.port, req.url.replace(/^\/r\/[A-Za-z0-9]{6}/, ''), ip);
    });
    return true;
  }

  // the game socket: the upgrade request goes to the game's server as it came, minus the /r/CODE prefix
  function upgrade(req, socket, head, ip) {
    const m = /^\/r\/([A-Za-z0-9]{6})(\/[^?]*)/.exec(req.url); if (!m) return false;
    const room = rooms.get(m[1].toUpperCase());
    if (!room || !room.ready) { socket.destroy(); return true; }
    proxyUpgrade(req, socket, head, room.port, req.url.replace(/^\/r\/[A-Za-z0-9]{6}/, ''), ip);
    return true;
  }

  const closeAll = () => { for (const r of rooms.values()) try { r.child.kill(); } catch {} };
  process.on('exit', closeAll);
  return { handle, upgrade, closeAll, count: () => rooms.size, max };
}
