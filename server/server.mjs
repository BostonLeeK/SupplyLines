// Supply Lines multiplayer server: one shared world, anonymous players, server-authoritative.
// Serves the static game and runs the simulation; clients only send commands and render snapshots.
//
//   node server/server.mjs            (PORT=5177, SIM_SPEED=1 → a season lasts 15 minutes)
//   SIM_SPEED=0.0015 node server/...  (≈ a 7-day real-time season)
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import webpush from 'web-push';
import { createEngine, K, FN, REGIONS, GEVENTS, rankOf } from '../game/engine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 5177;
const SIM_SPEED = +process.env.SIM_SPEED || 1;          // sim-seconds per real second
const BOTS = +process.env.BOTS || 120;                    // simulated players per faction (filler)
const HUMAN_WEIGHT = +process.env.HUMAN_WEIGHT || 10;     // one online human replaces this many bots
const MAX_CONN_PER_IP = 6, CMD_PER_SEC = 8, SNAP_MS = 250, TICK_MS = 100, RESTART_AFTER_MS = 20000;

const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'server', 'data');
fs.mkdirSync(DATA, { recursive: true });
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { try { fs.writeFileSync(path.join(DATA, f + '.tmp'), JSON.stringify(v)); fs.renameSync(path.join(DATA, f + '.tmp'), path.join(DATA, f)); } catch (e) { console.error('save failed', e.message); } };
const NET = JSON.parse(fs.readFileSync(path.join(ROOT, 'net.js'), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const E = createEngine(NET);
// players persist across seasons and restarts (name, rank/XP); offline players are re-balanced each season
const saved = readJson('players.json', {});
// ---------- optional Google sign-in ----------
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const auth = readJson('auth.json', null) || { salt: crypto.randomBytes(16).toString('hex'), accounts: {} };
const saveAuth = () => writeJson('auth.json', auth);
if (GOOGLE_CLIENT_ID) saveAuth();
const accountKey = sub => crypto.createHash('sha256').update(auth.salt + ':' + sub).digest('hex');
async function verifyGoogle(credential) {
  if (typeof credential !== 'string' || credential.length > 4096) return null;
  if (GOOGLE_CLIENT_ID === 'test' && credential.startsWith('test:')) return credential.slice(5); // local tests only
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null; const t = await r.json();
    if (t.aud !== GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || +t.exp * 1000 < Date.now() || !t.sub) return null;
    return t.sub;
  } catch { return null; }
}
// fold an anonymous player's progress into the account's player
function mergeInto(dst, src) {
  if (!dst || !src || dst === src) return;
  dst.xp = Math.max(dst.xp || 0, src.xp || 0);
  if (src.trail && (!dst.trail || dst.trail === 'std')) dst.trail = src.trail;
  if (!dst.squad && src.squad) dst.squad = src.squad;
  if (!dst.push && src.push) dst.push = src.push;
}
for (const [code, sq] of Object.entries(readJson('squads.json', {}))) E.squads.set(code, sq);
const saveSquads = () => writeJson('squads.json', Object.fromEntries([...E.squads].filter(([code]) => E.squadMembers(code).length || [...E.players.values()].some(p => p.pendingSquad === code))));
const loadSavedPlayers = () => { for (const [pid, p] of Object.entries(saved)) { if (!E.players.has(pid)) { const pl = E.addPlayer(pid, p.f ?? 0, p.name, p.pub, p.xp || 0); pl.online = false; if (p.squad) pl.squad = p.squad; if (p.trail) pl.trail = p.trail; if (p.linked) pl.linked = true; if (p.pendingSquad) pl.pendingSquad = p.pendingSquad; } if (p.push && !E.players.get(pid).push) E.players.get(pid).push = p.push; } };
loadSavedPlayers();
// resume the running season if the server restarted mid-way
const world = readJson('world.json', null);
if (world && E.load(world)) loadSavedPlayers(), console.log(`Resumed season at day ${Math.floor(E.S.simT / K.SEASON * 7) + 1} with ${E.players.size} players`);
const saveWorld = () => writeJson('world.json', E.save());
setInterval(saveWorld, 15000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveWorld(); savePlayers(); process.exit(0); });
const archive = readJson('archive.json', []);
// ---------- real war: live public data, cached ----------
const realWar = { alerts: null, alertsAt: 0, staff: null, staffAt: 0 };
const ALWAYS_ON = ['Автономна Республіка Крим', 'Севастополь']; // occupied since before 2022: their alert never clears
async function getJson(url) { const r = await fetch(url, { headers: { 'user-agent': 'supply-lines-game' }, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error(r.status); return r.json(); }
async function pollAlerts() {
  try {
    const j = await getJson('https://ubilling.net.ua/aerialalerts/'), st = j.states || {};
    const stale = v => v.alertnow && Date.now() - Date.parse(String(v.changed).replace(' ', 'T') + '+02:00') > 7 * 864e5; // occupied regions sit under a permanent alert
    const oblasts = Object.entries(st).filter(([n, v]) => !ALWAYS_ON.includes(n) && !stale(v));
    realWar.alerts = { on: oblasts.filter(([, v]) => v.alertnow).map(([n, v]) => [n, v.changed]), total: oblasts.length, kyiv: !!(st['м. Київ'] || {}).alertnow, at: j.cachedat };
    realWar.alertsAt = Date.now();
  } catch (e) {}
}
async function pollStaff() {
  try { const j = await getJson('https://russianwarship.rip/api/v2/statistics/latest'); const d = j.data; realWar.staff = { date: d.date, day: d.day, drones: d.stats.uav_systems, dronesToday: d.increase.uav_systems, missiles: d.stats.cruise_missiles, missilesToday: d.increase.cruise_missiles }; realWar.staffAt = Date.now(); } catch (e) {}
}
pollAlerts(); pollStaff(); setInterval(pollAlerts, 60 * 1000); setInterval(pollStaff, 60 * 60 * 1000);
// ---------- web push: alerts reach players who are not in the game right now ----------
const vapid = readJson('vapid.json', null) || (() => { const k = webpush.generateVAPIDKeys(); writeJson('vapid.json', k); return k; })();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@supply-lines.invalid', vapid.publicKey, vapid.privateKey);
const lastPush = new Map();
function pushTo(p, payload, minGapMs = 90000) {
  if (!p || !p.push) return;
  if ([...sockets.values()].some(s => s.pid === p.id)) return;            // they are playing: the game shows it
  const key = p.id + ':' + (payload.tag || ''), now = Date.now(); if (now - (lastPush.get(key) || 0) < minGapMs) return; lastPush.set(key, now);
  webpush.sendNotification(p.push, JSON.stringify(payload)).catch(err => { if (err.statusCode === 404 || err.statusCode === 410) delete p.push; });
}
const factionPlayers = f => [...E.players.values()].filter(p => p.f === f);
const cname = i => E.cities[i].name;
function pushForEvent(ev) {
  if (ev.k === 'threat') {
    const v = 1 - ev.f, c = E.cities[ev.city];
    const cmdr = E.players.get(E.S.cmdr[ev.city]);
    if (cmdr) pushTo(cmdr, { title: '⚠ Your city is under attack', body: `${FN[ev.f]} is moving on ${c.name}: ${ev.n} vs ${ev.def}. Send help or fortify.`, tag: 'threat-' + ev.city, urgent: true });
    if (c.cap >= 0) for (const p of factionPlayers(v)) pushTo(p, { title: '⚠ Your capital is under attack', body: `${FN[ev.f]} is moving on ${c.name}.`, tag: 'capital', urgent: true });
  }
  if (ev.k === 'nuke_ready') for (const p of factionPlayers(ev.f)) pushTo(p, { title: '☢ Warhead ready', body: "Your faction's warhead is built. Open the game to pick a target.", tag: 'nuke' });
  if (ev.k === 'nuke_armed') for (const p of factionPlayers(ev.f)) if (p.name !== ev.by) pushTo(p, { title: '☢ A launch needs your key', body: `${ev.by} armed a strike at ${cname(ev.target)}. A second commander must confirm.`, tag: 'nukekey', urgent: true }, 10000);
  if (ev.k === 'nuke_launch') for (const p of factionPlayers(1 - ev.f)) pushTo(p, { title: '☢ NUCLEAR LAUNCH DETECTED', body: `${FN[ev.f]} launched at ${cname(ev.target)}. Boost air defence now.`, tag: 'launch', urgent: true }, 10000);
  if (ev.k === 'end') for (const p of E.players.values()) pushTo(p, { title: 'Season over', body: ev.winter ? 'Nuclear winter: nobody won.' : ev.winner >= 0 ? `${FN[ev.winner]} won ${ev.pts[0]}–${ev.pts[1]}. A new season starts now.` : 'A draw. A new season starts now.', tag: 'end' }, 1000);
}
let season = archive.length ? archive[archive.length - 1].season + 1 : 1;
function savePlayers() { saveSquads(); savePlayersInner(); }
function savePlayersInner() { const o = {}; for (const p of E.players.values()) o[p.id] = { pub: p.pub, name: p.name, xp: p.xp, f: p.f, push: p.push, squad: p.squad, pendingSquad: p.pendingSquad, trail: p.trail, linked: p.linked || undefined }; writeJson('players.json', o); }
setInterval(savePlayers, 30000);
let saveTimer = null; const savePlayersSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { savePlayers(); saveWorld(); }, 1000); };

// ---------- static files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const PUBLIC = new Set(['/og.jpg', '/world.html', '/index.html', '/net.js', '/game/engine.js', '/sw.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/badge-96.png']);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (p === '/world') p = '/world.html';
  if (p === '/world.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache', 'access-control-allow-origin': '*' }); return res.end(JSON.stringify(worldState())); }
  if (p === '/vapid.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ key: vapid.publicKey })); }
  if (p === '/realwar.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); return res.end(JSON.stringify({ alerts: Date.now() - realWar.alertsAt < 10 * 60e3 ? realWar.alerts : null, staff: realWar.staff })); }
  if (p === '/archive.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); return res.end(JSON.stringify(archive.slice(-30).reverse())); }
  if (!PUBLIC.has(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(path.join(ROOT, p)).pipe(res);
});

// ---------- players & connections ----------
const sockets = new Map();          // ws -> { pid, ip, tokens }
const perIp = new Map();
const humansOnline = () => { const n = [0, 0]; for (const s of sockets.values()) if (s.pid) n[E.players.get(s.pid).f]++; return n; };
function pickFaction() {
  const h = humansOnline();
  if (h[0] !== h[1]) return h[0] < h[1] ? 0 : 1;
  const sc = E.scores().pts; return sc[0] <= sc[1] ? 0 : 1;   // tie: help the side that is behind
}
function rebalanceBots() { const h = humansOnline(); E.bots = h.map(x => Math.max(20, BOTS - x * HUMAN_WEIGHT)); }

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', (ws, req) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if ((perIp.get(ip) || 0) >= MAX_CONN_PER_IP) { ws.close(1008, 'too many connections'); return; }
  perIp.set(ip, (perIp.get(ip) || 0) + 1);
  const s = { pid: null, ip, tokens: CMD_PER_SEC, last: Date.now() };
  sockets.set(ws, s);

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    // simple token bucket against command spam
    const now = Date.now(); s.tokens = Math.min(CMD_PER_SEC, s.tokens + (now - s.last) / 1000 * CMD_PER_SEC); s.last = now;
    if (s.tokens < 1) return; s.tokens--;
    if (m.type === 'hello') {
      // anonymous identity: a random id kept in the browser; unknown ids get a fresh one
      let pid = typeof m.pid === 'string' && /^[a-f0-9]{24}$/.test(m.pid) ? m.pid : null;
      const inv = typeof m.squad === 'string' && /^[A-Z0-9]{6}$/.test(m.squad) && E.squads.get(m.squad);
      if (!pid || !E.players.has(pid)) { pid = pid || crypto.randomBytes(12).toString('hex'); E.addPlayer(pid, inv && E.squadMembers(inv.code).length < K.SQUAD_MAX ? inv.f : pickFaction()); savePlayersSoon(); }
      const p = E.players.get(pid); p.online = true; s.pid = pid;
      let squadMsg = null; if (m.squad) { const r = inv ? E.joinSquad(pid, inv.code) : { ok: false, msg: 'This invite link is no longer valid' }; squadMsg = r.already ? null : r.ok ? (r.msg || `You joined ${inv.name}`) : r.msg; savePlayersSoon(); }
      ws.send(JSON.stringify({ type: 'welcome', pid, pub: p.pub, f: p.f, name: p.name, speed: SIM_SPEED, caps: E.CAPS, squadMsg, google: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'test' ? GOOGLE_CLIENT_ID : GOOGLE_CLIENT_ID ? 'test' : null }));
      ws.send(JSON.stringify({ type: 'snap', ...E.snapshot(p.f), seasonNo: season, you: you(p), online: humansOnline() }));
      rebalanceBots();
      return;
    }
    if (!s.pid) return;
    if (m.type === 'push_sub') {
      const sub = m.sub; const p = E.players.get(s.pid);
      if (sub && typeof sub.endpoint === 'string' && sub.endpoint.startsWith('https://') && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string' && sub.endpoint.length < 1000) { p.push = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }; savePlayersSoon(); ws.send(JSON.stringify({ type: 'push_ok' })); }
      else if (m.sub === null) { delete p.push; savePlayersSoon(); }
      return;
    }
    if (m.type === 'signal') {
      const p = E.players.get(s.pid), city = m.city | 0;
      if (!SIGNALS.has(m.kind) || city < 0 || city >= E.N || now - (s.lastSignal || 0) < 3000) return;
      s.lastSignal = now; signals[p.f].push({ k: 'signal', f: p.f, city, kind: m.kind, name: p.name, who: p.pub, rank: E.rankOf(p.xp).name });
      return;
    }
    if (m.type === 'google') {
      if (!GOOGLE_CLIENT_ID) return;
      const pid = s.pid; s.tokens = Math.min(s.tokens, 0); // one sign-in attempt at a time
      verifyGoogle(m.credential).then(sub => {
        if (!sub) return ws.readyState === 1 && ws.send(JSON.stringify({ type: 'google_res', ok: false, msg: 'Google sign-in failed. Try again.' }));
        const key = accountKey(sub), cur = E.players.get(pid), owner = auth.accounts[key];
        if (owner && owner !== pid && E.players.has(owner)) {
          // this Google account already has a player (another device): continue as that one
          const acc = E.players.get(owner); mergeInto(acc, cur); acc.linked = true; savePlayersSoon();
          ws.send(JSON.stringify({ type: 'google_res', ok: true, pid: owner, msg: 'Welcome back: your progress is restored' }));
        } else {
          auth.accounts[key] = pid; saveAuth(); if (cur) cur.linked = true; savePlayersSoon();
          ws.send(JSON.stringify({ type: 'google_res', ok: true, msg: 'Signed in: your rank and XP are saved to your Google account' }));
        }
      });
      return;
    }
    if (m.type === 'google_out') {
      // the account keeps its player; this browser starts again as a fresh anonymous player
      ws.send(JSON.stringify({ type: 'google_res', ok: true, signedOut: true })); return;
    }
    if (m.type === 'squad') {
      const p = E.players.get(s.pid); let r;
      if (m.act === 'create') r = E.createSquad(s.pid);
      else if (m.act === 'leave') { const code = p.squad; delete p.squad; delete p.pendingSquad; r = { ok: true }; if (code) E.emit && 0; }
      else return;
      savePlayersSoon(); ws.send(JSON.stringify({ type: 'squad_res', act: m.act, ...r })); return;
    }
    if (m.type === 'cmd' && m.cmd && typeof m.cmd === 'object') {
      const res = E.command(s.pid, m.cmd); if (m.cmd.type === 'cosmetic' && res.ok) savePlayersSoon();
      if (m.cmd.type === 'volunteer' && res.ok) { rebalanceBots(); savePlayersSoon(); }
      ws.send(JSON.stringify({ type: 'res', id: m.id, ...res }));
    }
  });
  ws.on('close', () => {
    sockets.delete(ws); perIp.set(ip, Math.max(0, (perIp.get(ip) || 1) - 1));
    if (s.pid && ![...sockets.values()].some(o => o.pid === s.pid)) { const p = E.players.get(s.pid); if (p) p.online = false; }
    rebalanceBots();
  });
});
const you = p => E.publicPlayer(p);

// ---------- simulation loop ----------
const SIGNALS = new Set(['attack', 'defend', 'troops', 'thanks']);
let events = [], restartAt = 0, signals = [[], []];
// ---------- public chronicle for the world page: only big, public moments ----------
const wlog = [];
const cn = i => E.cities[i] ? E.cities[i].name : '?';
function chronicle(ev) {
  let text = null, f = ev.f ?? -1;
  if (ev.k === 'capture' && E.cities[ev.city] && (E.cities[ev.city].tier >= 2 || E.cities[ev.city].cap >= 0)) text = `${FN[ev.f]} took ${cn(ev.city)}`;
  else if (ev.k === 'region' && ev.f >= 0) text = `${FN[ev.f]} controls all of ${REGIONS[ev.r]}`;
  else if (ev.k === 'nuke_launch') text = `☢ ${FN[ev.f]} launched a nuclear missile at ${cn(ev.target)}`;
  else if (ev.k === 'nuke_hit') text = `☢ ${cn(ev.target)} was destroyed`;
  else if (ev.k === 'nuke_intercept') { text = `☢ The missile at ${cn(ev.target)} was shot down`; f = 1 - ev.f; }
  else if (ev.k === 'gevent' && GEVENTS[ev.ev]) { text = `${GEVENTS[ev.ev].icon} World event: ${GEVENTS[ev.ev].name}`; f = -1; }
  else if (ev.k === 'ally') text = `🤝 ${(NET.nations[ev.nation] || ['A nation'])[0]} joined ${FN[ev.f]}`;
  else if (ev.k === 'end') { text = ev.winter ? 'Nuclear winter: the season ended with no winner' : `Season ${season} is over: ${ev.winner >= 0 ? FN[ev.winner] + ' won' : 'a draw'}`; f = ev.winter ? -1 : ev.winner ?? -1; }
  else if (ev.k === 'start') { text = `Season ${season} began`; f = -1; }
  if (!text) return;
  wlog.unshift({ at: Date.now(), t: +E.S.simT.toFixed(1), text, f }); if (wlog.length > 40) wlog.length = 40;
}
function worldState() {
  const sc = E.scores(), sq = new Map(), chief = [0, 1].map(f => { const p = E.chiefOf(f); return p ? { name: p.name, rank: rankOf(p.xp || 0).name } : null; });
  for (const p of E.players.values()) if (p.squad && E.squads.has(p.squad)) { const x = sq.get(p.squad) || { name: E.squads.get(p.squad).name, f: E.squads.get(p.squad).f, caps: 0, n: 0 }; x.caps += p.caps || 0; x.n++; sq.set(p.squad, x); }
  return {
    season, t: E.S.simT, seasonLen: K.SEASON, ended: E.S.ended, restartIn: restartAt ? Math.max(0, restartAt - Date.now()) : 0,
    pts: sc.pts, cities: sc.cities, owner: Array.from(E.S.owner), rad: Array.from(E.S.rad).map((v, i) => v ? i : -1).filter(i => i >= 0),
    regionHeld: E.S.regionHeld, strikes: E.S.strikes, winter: E.S.winter, gev: E.S.gev && E.ge(E.S.gev.k) ? E.S.gev.k : null,
    online: humansOnline(), chief, board: E.leaderboard().slice(0, 10).map(h => ({ name: h.name, f: h.f, caps: h.caps, rank: h.rank || null })),
    squads: [...sq.values()].sort((a, b) => b.caps - a.caps).slice(0, 5), log: wlog.slice(0, 20),
    history: (E.S.history || []).slice(-80), seasons: archive.slice(-6).reverse().map(a => ({ season: a.season, winner: a.winner, winter: a.winter, pts: a.pts, endedAt: a.endedAt })),
    alerts: realWar.alerts && Date.now() - realWar.alertsAt < 10 * 60e3 ? realWar.alerts.on.length : null,
  };
}
E.onEvent(ev => {
  events.push(ev); try { chronicle(ev); } catch (e) {}
  try { pushForEvent(ev); } catch (e) { console.error('push', e.message); }
  if (ev.k === 'end') {
    const top = E.leaderboard().slice(0, 5).map(h => ({ name: h.name, f: h.f, caps: h.caps }));
    archive.push({ season, endedAt: new Date().toISOString(), pts: ev.pts, cities: ev.cities, winner: ev.winner, winter: !!ev.winter, history: E.S.history, owner: Array.from(E.S.owner), frames: E.S.frames, top,
      players: [...E.players.values()].filter(p => p.caps || p.sent).length });
    writeJson('archive.json', archive.slice(-200)); savePlayers();
  }
  if (ev.k === 'start' && archive.length) season = archive[archive.length - 1].season + 1;
});
setInterval(() => {
  if (E.S.ended) {
    if (!restartAt) restartAt = Date.now() + RESTART_AFTER_MS;
    else if (Date.now() > restartAt) { restartAt = 0; for (const p of E.players.values()) if (!p.online && !p.squad) p.f = Math.random() < 0.5 ? 0 : 1; E.applyPendingSquads(); for (const p of E.players.values()) if (p.squad && E.squads.has(p.squad)) p.f = E.squads.get(p.squad).f; E.reset(); rebalanceBots(); }
    return;
  }
  let dt = TICK_MS / 1000 * SIM_SPEED;
  while (dt > 0) { const d = Math.min(0.1, dt); E.step(d); dt -= d; }
}, TICK_MS);

setInterval(() => {
  if (!sockets.size) { events = []; return; }
  const views = [E.snapshot(0), E.snapshot(1)], online = humansOnline(), evs = events, sigs = signals; events = []; signals = [[], []];  // fog of war: each faction gets its own view
  const extra = { online, bots: E.bots, board: E.leaderboard().slice(0, 12), history: E.S.ended ? E.S.history : undefined, frames: E.S.ended ? E.S.frames : undefined, restartIn: restartAt ? Math.max(0, restartAt - Date.now()) : 0 };
  for (const [ws, s] of sockets) {
    if (!s.pid || ws.readyState !== 1) continue;
    const p = E.players.get(s.pid);
    ws.send(JSON.stringify({ type: 'snap', ...views[p.f], ...extra, seasonNo: season, you: you(p), ev: sigs[p.f].length ? evs.concat(sigs[p.f]) : evs }));
  }
}, SNAP_MS);

server.listen(PORT, () => console.log(`Supply Lines server on http://localhost:${PORT}  (season ${(K.SEASON / SIM_SPEED / 60).toFixed(0)} min real time, ${BOTS} bots per faction)`));
