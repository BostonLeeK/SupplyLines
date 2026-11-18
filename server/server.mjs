// Supply Lines multiplayer server: one shared world, anonymous players, server-authoritative.
// Serves the static game and runs the simulation; clients only send commands and render snapshots.
//
//   node server/server.mjs            (PORT=5177, SIM_SPEED=0.125 → a season lasts 2 hours)
//   SIM_SPEED=1 node server/...       (a 15-minute season, handy for testing)
//   SIM_SPEED=0.0015 node server/...  (≈ a 7-day real-time season)
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import webpush from 'web-push';
import { createEngine, K, FN, REGIONS, GEVENTS, SCENARIOS, ERAS, rankOf } from '../game/engine.js';
import { createWire } from './wire.mjs';
import { createOps } from './ops.mjs';
import { createRooms } from './rooms.mjs';
import { createPrefixProxy } from './proxy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 5177;
const SIM_SPEED = +process.env.SIM_SPEED || 0.125;         // sim-seconds per real second
// command points refill in real time, whatever the season length: one point every CP_SECONDS.
// The warhead price and bot nuke funding scale with it, so the nuclear program keeps its pace within a season.
const CP_SECONDS = +process.env.CP_SECONDS || 45;
{ const k = K.CP_REGEN / (CP_SECONDS * SIM_SPEED); K.CP_REGEN = CP_SECONDS * SIM_SPEED; K.NUKE_COST = Math.round(K.NUKE_COST * k); K.NUKE_BOT_RATE *= k; }
// ROOM=fast runs the blitz world: no news posts, and the main world links to it (FAST_URL) and back (MAIN_URL).
// ROOM=private is a game among friends that the main server started (server/rooms.mjs); it closes itself once nobody
// has been in it for IDLE_EXIT_MIN minutes.
const ROOM = ['fast', 'private'].includes(process.env.ROOM) ? process.env.ROOM : 'main', FAST_URL = process.env.FAST_URL || '', MAIN_URL = process.env.MAIN_URL || '';
const ROOM_CODE = process.env.ROOM_CODE || '', IDLE_EXIT_MS = (+process.env.IDLE_EXIT_MIN || 0) * 60000;
const PRIVATE_GAMES = ROOM === 'main' ? Math.max(0, process.env.PRIVATE_GAMES === undefined ? 3 : +process.env.PRIVATE_GAMES || 0) : 0;
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
// ---------- callsigns: signed-in players may pick their own name, once per season ----------
// Only letters, digits, spaces and - _ . so a name is safe anywhere the client builds HTML. A name may not be a
// word the Ukrainian dictionary translates (it would turn into another word on screen), copy a reserved word, or
// look like another player's name (case and Latin/Cyrillic look-alikes ignored).
const UK_WORDS = (() => { try { const t = fs.readFileSync(path.join(ROOT, 'i18n-uk.js'), 'utf8'); const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); return new Set(Object.keys(j.dict || {}).map(k => k.toLowerCase())); } catch { return new Set(); } })();
const LOOKALIKE = { а: 'a', в: 'b', е: 'e', є: 'e', ё: 'e', і: 'i', ї: 'i', й: 'i', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', '0': 'o', '1': 'l', '3': 'e', '_': '', '-': '', '.': '', ' ': '' };
const nickKey = n => [...n.toLowerCase()].map(ch => LOOKALIKE[ch] ?? ch).join('');
const NICK_BAD = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'whore', 'hitler', 'nazi', 'kurwa', 'хуй', 'хуя', 'хує', 'хуе', 'пизд', 'бля', 'їба', 'еба', 'ёба', 'йоба', 'сука', 'суки', 'залуп', 'мудак', 'мудил', 'підор', 'пидор', 'підар', 'пидар', 'гандон', 'дроч', 'шлюх', 'курва'];
const NICK_RESERVED = ['admin', 'administrator', 'moderator', 'support', 'system', 'server', 'supplylines', 'globalwar', 'atlantica', 'pacifica', 'атлантика', 'пацифіка', 'hq', 'штаб', 'general', 'генерал', 'anthropic', 'claude'].map(nickKey);
const NICK_GRACE = 10 * 60 * 1000;
function checkNick(raw, p) {
  const n = String(raw || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (n.length < 3 || n.length > 20) return { msg: 'A callsign is 3 to 20 characters long' };
  if (!/^[\p{L}\d _.\-]+$/u.test(n)) return { msg: 'Use only letters, digits, spaces and - _ .' };
  if ((n.match(/\p{L}/gu) || []).length < 2) return { msg: 'A callsign needs at least two letters' };
  const key = nickKey(n), low = n.toLowerCase();
  if (NICK_BAD.some(w => low.includes(w) || key.includes(nickKey(w)))) return { msg: 'This callsign is not allowed' };
  if (NICK_RESERVED.includes(key) || UK_WORDS.has(low)) return { msg: 'This callsign is reserved. Pick another one' };
  for (const o of E.players.values()) if (o !== p && nickKey(o.name || '') === key) return { msg: 'This callsign is taken' };
  for (const h of E.leaderboard()) if (!h.id && nickKey(h.name || '') === key) return { msg: 'This callsign is taken' };
  return { name: n };
}
function setNick(p, raw) {
  // a private game is among friends and is gone in a few hours: anyone there may name themselves, any time
  if (ROOM !== 'private') {
    if (!p.linked) return { ok: false, msg: 'Sign in with Google to choose a callsign' };
    // once per season, with 10 minutes to fix a typo
    const grace = Date.now() - (p.nameAt || 0) < NICK_GRACE;
    if (p.nameSeason === season && !grace) return { ok: false, msg: 'You can change your callsign once per season' };
  }
  const c = checkNick(raw, p); if (!c.name) return { ok: false, msg: c.msg };
  if (c.name === p.name) return { ok: true, name: p.name };
  const old = p.name; p.name = c.name; if (p.nameSeason !== season) p.nameAt = Date.now(); p.nameSeason = season;
  // what the map already shows under that name follows the new one
  for (const arr of [E.S.gov, E.S.capBy]) if (arr) for (let i = 0; i < arr.length; i++) if (arr[i] === old) arr[i] = c.name;
  for (const x of [...(E.S.marks || []), ...(E.S.sats || [])]) if (x.by === old) x.by = c.name;
  for (const nk of E.S.nuke || []) if (nk && nk.arm && nk.arm.byName === old) nk.arm.byName = c.name;
  savePlayersSoon(); return { ok: true, name: c.name };
}
for (const [code, sq] of Object.entries(readJson('squads.json', {}))) E.squads.set(code, sq);
const saveSquads = () => writeJson('squads.json', Object.fromEntries([...E.squads].filter(([code]) => E.squadMembers(code).length || [...E.players.values()].some(p => p.pendingSquad === code))));
const loadSavedPlayers = () => { for (const [pid, p] of Object.entries(saved)) { if (!E.players.has(pid)) { const pl = E.addPlayer(pid, p.f ?? 0, p.name, p.pub, p.xp || 0); pl.online = false; if (p.squad) pl.squad = p.squad; if (p.trail) pl.trail = p.trail; if (p.linked) pl.linked = true; if (p.pendingSquad) pl.pendingSquad = p.pendingSquad;} if (p.push && !E.players.get(pid).push) E.players.get(pid).push = p.push; if (p.nameSeason) E.players.get(pid).nameSeason = p.nameSeason; } };
loadSavedPlayers();
// resume the running season if the server restarted mid-way
const world = readJson('world.json', null);
const freshWorld = !(world && E.load(world)); // a brand-new world starts below, once the season counter exists
if (!freshWorld && E.S.simT > 0) loadSavedPlayers(), console.log(`Resumed season at day ${Math.floor(E.S.simT / K.SEASON * 7) + 1} with ${E.players.size} players`);
const saveWorld = () => writeJson('world.json', E.save());
setInterval(saveWorld, 15000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveWorld(); savePlayers(); ops.saveStats(); process.exit(0); });
const archive = readJson('archive.json', []);
// ---------- real war: live public data, cached ----------
const realWar = { alerts: null, alertsAt: 0, staff: null, staffAt: 0, alertsErr: null, staffErr: null };
// the alert source can be swapped (a mirror or your own proxy) if the VPS cannot reach it directly
const ALERTS_URL = process.env.ALERTS_URL || 'https://ubilling.net.ua/aerialalerts/';
const errText = e => [e && e.message, e && e.cause && (e.cause.code || e.cause.message)].filter(Boolean).join(' / ') || String(e);
const logOnce = (() => { const last = {}; return (key, msg) => { if (last[key] === msg) return; last[key] = msg; console.warn(new Date().toISOString(), key, msg); }; })();
const ALWAYS_ON = ['Автономна Республіка Крим', 'Севастополь']; // occupied since before 2022: their alert never clears
async function getJson(url) { const r = await fetch(url, { headers: { 'user-agent': 'supply-lines-game' }, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error(r.status); return r.json(); }
async function pollAlerts() {
  try {
    const j = await getJson(ALERTS_URL), st = j.states || {}; if (!Object.keys(st).length) throw new Error('no states in response');
    const stale = v => v.alertnow && Date.now() - Date.parse(String(v.changed).replace(' ', 'T') + '+02:00') > 7 * 864e5; // occupied regions sit under a permanent alert
    const oblasts = Object.entries(st).filter(([n, v]) => !ALWAYS_ON.includes(n) && !stale(v));
    realWar.alerts = { on: oblasts.filter(([, v]) => v.alertnow).map(([n, v]) => [n, v.changed]), total: oblasts.length, kyiv: !!(st['м. Київ'] || {}).alertnow, at: j.cachedat };
    realWar.alertsAt = Date.now(); if (realWar.alertsErr) { realWar.alertsErr = null; logOnce('alerts', 'ok again'); }
  } catch (e) { realWar.alertsErr = errText(e); logOnce('alerts', 'cannot load ' + ALERTS_URL + ': ' + realWar.alertsErr); }
}
async function pollStaff() {
  try { const j = await getJson('https://russianwarship.rip/api/v2/statistics/latest'); const d = j.data; realWar.staff = { date: d.date, day: d.day, drones: d.stats.uav_systems, dronesToday: d.increase.uav_systems, missiles: d.stats.cruise_missiles, missilesToday: d.increase.cruise_missiles }; realWar.staffAt = Date.now(); realWar.staffErr = null; } catch (e) { realWar.staffErr = errText(e); logOnce('staff', 'cannot load General Staff data: ' + realWar.staffErr); }
}
// a private game takes the real-war data from the main server instead of asking the outside sources again
const REALWAR_FROM = process.env.REALWAR_FROM || '';
if (REALWAR_FROM) { const pull = async () => { try { const j = await getJson(REALWAR_FROM); realWar.alerts = j.alerts; realWar.alertsAt = j.alerts ? Date.now() : 0; realWar.staff = j.staff; realWar.staffAt = j.staff ? Date.now() : 0; } catch {} }; pull(); setInterval(pull, 60 * 1000); }
else { pollAlerts(); pollStaff(); setInterval(pollAlerts, 60 * 1000); setInterval(pollStaff, 60 * 60 * 1000); }
// ---------- web push: alerts reach players who are not in the game right now ----------
const vapid = readJson('vapid.json', null) || (() => { const k = webpush.generateVAPIDKeys(); writeJson('vapid.json', k); return k; })();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@supply-lines.invalid', vapid.publicKey, vapid.privateKey);
const lastPush = new Map();
function pushTo(p, payload, minGapMs = 90000) {
  if (!p || !p.push || ROOM !== 'main') return; // the fast room is for quick tests: no notifications
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
  if (ev.k === 'cap_hold') for (const p of factionPlayers(1 - ev.f)) pushTo(p, { title: '⚠ Our capital has fallen', body: `${FN[ev.f]} holds ${cname(ev.city)}. Retake it within 12 game hours or the war is lost.`, tag: 'capital', urgent: true }, 10000);
  if (ev.k === 'nuke_ready') for (const p of factionPlayers(ev.f)) pushTo(p, { title: '☢ Warhead ready', body: "Your faction's warhead is built. Open the game to pick a target.", tag: 'nuke' });
  if (ev.k === 'nuke_armed') for (const p of factionPlayers(ev.f)) if (p.name !== ev.by) pushTo(p, { title: '☢ A launch needs your key', body: `${ev.by} armed a strike at ${cname(ev.target)}. A second commander must confirm.`, tag: 'nukekey', urgent: true }, 10000);
  if (ev.k === 'nuke_launch') for (const p of factionPlayers(1 - ev.f)) pushTo(p, { title: '☢ NUCLEAR LAUNCH DETECTED', body: `${FN[ev.f]} launched at ${cname(ev.target)}. Boost air defence now.`, tag: 'launch', urgent: true }, 10000);
  if (ev.k === 'end') for (const p of E.players.values()) pushTo(p, { title: 'Season over', body: ev.winter ? 'Nuclear winter: nobody won.' : ev.winner >= 0 ? `${FN[ev.winner]} won ${ev.pts[0]}–${ev.pts[1]}. A new season starts now.` : 'A draw. A new season starts now.', tag: 'end' }, 1000);
}
let season = archive.length ? archive[archive.length - 1].season + 1 : 1;
// a campaign ("Great War") is CAMPAIGN_LEN seasons; its score and the fallout of its bombs carry from season to season
const CAMPAIGN_LEN = 7, campaignOf = n => Math.ceil(n / CAMPAIGN_LEN);
function campaignInfo() {
  const n = campaignOf(season), wins = [0, 0]; for (const a of archive) if (campaignOf(a.season) === n && a.winner >= 0 && !a.winter) wins[a.winner]++;
  const past = archive.filter(a => a.campaignDone).slice(-5).reverse().map(a => ({ n: campaignOf(a.season), winner: a.campaignWinner, wins: a.campaignWins }));
  return { n, k: (season - 1) % CAMPAIGN_LEN + 1, len: CAMPAIGN_LEN, wins, scenario: E.S.scenario, next: E.scenarioFor(season + 1), past };
}
function prepareSeason() { // the next season's theme, and the cities still glowing from last season's bombs
  E.nextScenario = E.scenarioFor(season);
  const last = archive[archive.length - 1]; E.nextScars = last && campaignOf(last.season) === campaignOf(season) && last.rad ? last.rad : [];
}
if (freshWorld) { prepareSeason(); E.reset(); }
function savePlayers() { saveSquads(); savePlayersInner(); }
function savePlayersInner() { const o = {}; for (const p of E.players.values()) o[p.id] = { pub: p.pub, name: p.name, xp: p.xp, f: p.f, push: p.push, squad: p.squad, pendingSquad: p.pendingSquad, trail: p.trail, linked: p.linked || undefined, nameSeason: p.nameSeason || undefined }; writeJson('players.json', o); }
setInterval(savePlayers, 30000);
let saveTimer = null; const savePlayersSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { savePlayers(); saveWorld(); }, 1000); };

// ---------- static files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const PUBLIC = new Set(['/icons.js', '/i18n.js', '/i18n-uk.js', '/og.jpg', '/og-uk.jpg', '/world.html', '/index.html', '/net.js', '/game/engine.js', '/sw.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/badge-96.png', '/icons/favicon.svg', '/icons/apple-touch-icon.png', ...['convoys', 'drones', 'front', 'world', 'phone1', 'phone2', 'phone3'].map(n => '/img/lp-' + n + '.webp')]);
// static files are compressed once (brotli and gzip) and kept in memory; ETag lets browsers revalidate with a 304
const fileCache = new Map(), PACK = /\.(html|js|json|css|svg|webmanifest)$/;
function cachedFile(p) {
  const fp = path.join(ROOT, p), st = fs.statSync(fp); let c = fileCache.get(p);
  if (!c || c.mtime !== st.mtimeMs) {
    const raw = fs.readFileSync(fp), pack = PACK.test(p);
    c = { mtime: st.mtimeMs, raw, etag: `"${st.mtimeMs.toString(36)}-${raw.length.toString(36)}"`,
      gz: pack ? zlib.gzipSync(raw, { level: 9 }) : null, br: pack ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }) : null };
    fileCache.set(p, c);
  }
  return c;
}
function sendPacked(req, res, type, body, extra = {}) {
  const ae = String(req.headers['accept-encoding'] || ''), buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const head = { 'content-type': type, vary: 'Accept-Encoding', ...extra };
  if (buf.length > 1024 && /\bbr\b/.test(ae)) { res.writeHead(200, { ...head, 'content-encoding': 'br' }); return res.end(zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })); }
  if (buf.length > 1024 && /\bgzip\b/.test(ae)) { res.writeHead(200, { ...head, 'content-encoding': 'gzip' }); return res.end(zlib.gzipSync(buf)); }
  res.writeHead(200, head); res.end(buf);
}
// the Ukrainian version of a page (?lang=uk) as search engines and link previews should see it:
// [page title, search description, preview title, preview description, address]
const OG_UK = {
  '/index.html': ['Supply Lines: безкоштовна браузерна стратегія на 3D-глобусі',
    'Безкоштовна браузерна стратегія на живому 3D-глобусі. Дві фракції ведуть одну війну логістики: веди конвої, ріж лінії постачання, грай бліц або з друзями. Без реєстрації.',
    'Supply Lines: безкоштовна браузерна війна логістики', 'Дві фракції, одна планета, без реєстрації. Веди конвої по 3D-глобусу й захоплюй світ місто за містом.', 'https://globalwar.xyz/?lang=uk'],
  '/world.html': ['Supply Lines · Звіт зі світу',
    'Живий звіт із Supply Lines, безкоштовної браузерної війни логістики: хто тримає світ просто зараз, найкращі командири й останні битви. Без реєстрації.',
    'Supply Lines: світ у війні просто зараз', 'Дві фракції, одна планета, без реєстрації. Подивись, хто тримає світ, і стань на лінію фронту.', 'https://globalwar.xyz/world?lang=uk'],
};
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
function ukPreview(html, p) {
  const [title, desc, ogTitle, ogDesc, url] = OG_UK[p].map(attr);
  return html.replace('<html lang="en">', '<html lang="uk">').replaceAll('https://globalwar.xyz/og.jpg', 'https://globalwar.xyz/og-uk.jpg')
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(/(<meta name="description" content=")[^"]*/, '$1' + desc)
    .replace(/(<link rel="canonical" href=")[^"]*/, '$1' + url)
    .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + ogTitle).replace(/(<meta property="og:description" content=")[^"]*/, '$1' + ogDesc)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, '$1' + ogTitle).replace(/(<meta name="twitter:description" content=")[^"]*/, '$1' + ogDesc)
    .replace(/(<meta property="og:url" content=")[^"]*/, '$1' + url)
    .replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="uk_UA">').replace('<meta property="og:locale:alternate" content="uk_UA">', '<meta property="og:locale:alternate" content="en_US">');
}
// privacy, terms and contact: one page (legal.html) with its title, description and address filled in per path
const LEGAL = {
  '/privacy': { en: ['Privacy · Supply Lines', 'What Supply Lines keeps about players and why: no ads, no tracking cookies, play without an account.'],
    uk: ['Конфіденційність · Supply Lines', 'Що Supply Lines зберігає про гравців і навіщо: без реклами, без cookie для стеження, грати можна без акаунта.'] },
  '/terms': { en: ['Terms of play · Supply Lines', 'The terms of Supply Lines, a free browser strategy game: play fair, names, accounts and the real-war data.'],
    uk: ['Умови гри · Supply Lines', 'Умови Supply Lines, безкоштовної браузерної стратегії: чесна гра, імена, акаунти й дані про справжню війну.'] },
  '/contact': { en: ['Contact · Supply Lines', 'Write to the Supply Lines team: bugs, ideas, player reports and privacy requests.'],
    uk: ["Зв'язок · Supply Lines", 'Напиши команді Supply Lines: помилки, ідеї, скарги на гравців і запити щодо даних.'] },
};
function legalPage(p, uk) {
  const [title, desc] = LEGAL[p][uk ? 'uk' : 'en'].map(attr), page = p.slice(1);
  let h = cachedFile('/legal.html').raw.toString('utf8').replaceAll('{{TITLE}}', title).replaceAll('{{DESC}}', desc).replaceAll('{{PATH}}', p).replaceAll('{{Q}}', uk ? '?lang=uk' : '').replace('{{PAGE}}', page);
  if (uk) h = h.replace('<html lang="en">', '<html lang="uk">').replaceAll('https://globalwar.xyz/og.jpg', 'https://globalwar.xyz/og-uk.jpg');
  return ROOM === 'main' ? h : noIndex(h);
}
// blitz and private games repeat the main page: keep them out of search results
const noIndex = html => html.replace('<head>', '<head>\n<meta name="robots" content="noindex">');
const SITE = (process.env.SITE_URL || 'https://globalwar.xyz').replace(/\/$/, '');
const ROBOTS = ROOM === 'main' ? `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /r/\nDisallow: /fast/\n\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
const SITEMAP = (() => {
  const alt = p => `<xhtml:link rel="alternate" hreflang="en" href="${SITE}${p}"/><xhtml:link rel="alternate" hreflang="uk" href="${SITE}${p}?lang=uk"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p}"/>`;
  const url = (p, q, f, pr) => `  <url><loc>${SITE}${p}${q}</loc>${alt(p)}<changefreq>${f}</changefreq><priority>${pr}</priority></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`
    + [url('/', '', 'daily', '1.0'), url('/', '?lang=uk', 'daily', '1.0'), url('/world', '', 'hourly', '0.8'), url('/world', '?lang=uk', 'hourly', '0.8'), ...['/privacy', '/terms', '/contact'].flatMap(p => [url(p, '', 'yearly', '0.3'), url(p, '?lang=uk', 'yearly', '0.3')])].join('\n') + '\n</urlset>\n';
})();
// error reports, stats, health check, backups
const ops = createOps({ DATA, getHealth: () => ({ season, simT: Math.round(E.S.simT), ended: !!E.S.ended, online: humansOnline(), players: E.players.size, uptime: Math.round(process.uptime()) }) });
const games = PRIVATE_GAMES ? createRooms({ ROOT, PORT, max: PRIVATE_GAMES }) : null;
// all modes live on one site so the page can move between them without reloading. In production nginx serves blitz
// under /fast/; without nginx (npm run dev) FAST_PROXY=http://127.0.0.1:5178 makes this server pass /fast/ through.
const fastProxy = ROOM === 'main' && process.env.FAST_PROXY ? createPrefixProxy('/fast/', process.env.FAST_PROXY) : null;
const clientIp = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (games && games.handle(req, res, p, clientIp(req))) return;
  if (fastProxy && fastProxy.handle(req, res, p, clientIp(req))) return;
  if (p === '/') p = '/index.html'; if (p === '/world') p = '/world.html';
  if (ops.handle(req, res, p)) return;
  if (p === '/world.json') return sendPacked(req, res, 'application/json', JSON.stringify(worldState()), { 'cache-control': 'no-cache', 'access-control-allow-origin': '*' });
  // the start screen of the other mode reads this: how long a season is here and how many people play now
  if (p === '/room.json') { const on = humansOnline(); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache', 'access-control-allow-origin': '*' }); return res.end(JSON.stringify({ room: ROOM, code: ROOM_CODE || undefined, minutes: Math.round(K.SEASON / SIM_SPEED / 60), online: on[0] + on[1], season, day: Math.min(7, Math.floor(E.S.simT / K.SEASON * 7) + 1), games: games ? { open: games.count(), max: games.max } : undefined })); }
  if (p === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' }); return res.end(ROBOTS); }
  if (p === '/sitemap.xml') { res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' }); return res.end(SITEMAP); }
  if (p === '/vapid.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ key: vapid.publicKey })); }
  if (p === '/realwar.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); return res.end(JSON.stringify({ alerts: Date.now() - realWar.alertsAt < 15 * 60e3 ? realWar.alerts : null, staff: realWar.staff, status: { alerts: realWar.alertsErr ? 'error: ' + realWar.alertsErr : realWar.alertsAt ? 'ok' : 'loading', staff: realWar.staffErr ? 'error: ' + realWar.staffErr : realWar.staffAt ? 'ok' : 'loading' } })); }
  if (p === '/wire.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); return res.end(JSON.stringify(wireLog.slice(0, 30))); }
  if (p === '/archive.json') return sendPacked(req, res, 'application/json', JSON.stringify(archive.slice(-30).reverse()), { 'cache-control': 'no-cache' });
  if (LEGAL[p]) return sendPacked(req, res, TYPES['.html'], legalPage(p, /[?&]lang=uk(&|$)/.test(req.url)), { 'cache-control': 'no-cache' });
  if (!PUBLIC.has(p)) { res.writeHead(404); return res.end('not found'); }
  let c; try { c = cachedFile(p); } catch { res.writeHead(404); return res.end('not found'); }
  // a shared link with ?lang=uk gets the Ukrainian link preview (the page itself switches language from the same parameter)
  if (p === '/index.html' || p === '/world.html') {
    const uk = /[?&]lang=uk(&|$)/.test(req.url);
    if (uk || ROOM !== 'main') { let h = c.raw.toString('utf8'); if (uk) h = ukPreview(h, p); if (ROOM !== 'main') h = noIndex(h); return sendPacked(req, res, TYPES['.html'], h, { 'cache-control': 'no-cache' }); }
  }
  const ae = String(req.headers['accept-encoding'] || ''), enc = c.br && /\bbr\b/.test(ae) ? 'br' : c.gz && /\bgzip\b/.test(ae) ? 'gzip' : null;
  const head = { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache', etag: c.etag, vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, head); return res.end(); }
  res.writeHead(200, enc ? { ...head, 'content-encoding': enc } : head); res.end(enc === 'br' ? c.br : enc === 'gzip' ? c.gz : c.raw);
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
function rebalanceBots() { const h = humansOnline(); E.bots = h.map(x => Math.max(Math.min(20, BOTS), BOTS - x * HUMAN_WEIGHT)); }

// the game socket is /ws; with private games on, /r/CODE/ws goes through to that game's server
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  if (req.url.split('?')[0] === '/ws') return wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  if (games && games.upgrade(req, socket, head, clientIp(req))) return;
  if (fastProxy && fastProxy.upgrade(req, socket, head, clientIp(req))) return;
  socket.destroy();
});
// a private game shuts itself down once it has been empty for a while
if (IDLE_EXIT_MS) { let busyAt = Date.now(); setInterval(() => { if (sockets.size) busyAt = Date.now(); else if (Date.now() - busyAt > IDLE_EXIT_MS) { console.log('empty for a while: closing'); process.exit(0); } }, 15000); }
wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
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
      ws.send(JSON.stringify({ type: 'welcome', pid, pub: p.pub, f: p.f, name: p.name, speed: SIM_SPEED, cpRegen: K.CP_REGEN, room: ROOM, code: ROOM_CODE || undefined, games: !!games, fastUrl: ROOM !== 'fast' ? FAST_URL : '', mainUrl: ROOM !== 'main' ? MAIN_URL : '', caps: E.CAPS, squadMsg, google: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'test' ? GOOGLE_CLIENT_ID : GOOGLE_CLIENT_ID ? 'test' : null }));
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
    if (m.type === 'nick') {
      const r = setNick(E.players.get(s.pid), m.name); ws.send(JSON.stringify({ type: 'nick_res', ...r, quiet: m.quiet ? 1 : undefined })); return;
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
const you = p => ({ ...E.publicPlayer(p), nickFree: ROOM === 'private' || !!p.linked && (p.nameSeason !== season || Date.now() - (p.nameAt || 0) < NICK_GRACE) });

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
  else if (ev.k === 'cap_hold') text = `⚑ ${FN[ev.f]} holds the enemy capital ${cn(ev.city)}: 12 hours to victory`;
  else if (ev.k === 'cap_freed' && ev.f >= 0) text = `🛡 ${FN[ev.f]} retook ${cn(ev.city)}`;
  else if (ev.k === 'ally') text = `🤝 ${(NET.nations[ev.nation] || ['A nation'])[0]} joined ${FN[ev.f]}`;
  else if (ev.k === 'end') { text = ev.winter ? 'Nuclear winter: the season ended with no winner' : `Season ${season} is over: ${ev.winner >= 0 ? FN[ev.winner] + ' won' + (ev.capital >= 0 ? ' by holding ' + cn(ev.capital) : '') : 'a draw'}`; f = ev.winter ? -1 : ev.winner ?? -1; }
  else if (ev.k === 'start') { text = `Season ${season} began: ${(SCENARIOS[E.S.scenario] || SCENARIOS.classic).name}`; f = -1; }
  if (!text) return;
  wlog.unshift({ at: Date.now(), t: +E.S.simT.toFixed(1), text, f }); if (wlog.length > 40) wlog.length = 40;
}
function worldState() {
  const sc = E.scores(), sq = new Map(), chief = [0, 1].map(f => { const p = E.chiefOf(f); return p ? { name: p.name, rank: rankOf(p.xp || 0).name } : null; });
  for (const p of E.players.values()) if (p.squad && E.squads.has(p.squad)) { const x = sq.get(p.squad) || { name: E.squads.get(p.squad).name, f: E.squads.get(p.squad).f, caps: 0, n: 0 }; x.caps += p.caps || 0; x.n++; sq.set(p.squad, x); }
  return {
    season, t: E.S.simT, seasonLen: K.SEASON, ended: E.S.ended, restartIn: restartAt ? Math.max(0, restartAt - Date.now()) : 0,
    pts: sc.pts, cities: sc.cities, owner: Array.from(E.S.owner), rad: Array.from(E.S.rad).map((v, i) => v ? i : -1).filter(i => i >= 0),
    regionHeld: E.S.regionHeld, strikes: E.S.strikes, winter: E.S.winter, gev: E.S.gev && E.ge(E.S.gev.k) ? E.S.gev.k : null, era: E.S.era && ERAS[E.S.era.k] ? { k: E.S.era.k, end: E.S.era.end, name: ERAS[E.S.era.k].name, icon: ERAS[E.S.era.k].icon, text: ERAS[E.S.era.k].text } : null,
    online: humansOnline(), chief, board: E.leaderboard().slice(0, 10).map(h => ({ name: h.name, f: h.f, caps: h.caps, rank: h.rank || null })),
    squads: [...sq.values()].sort((a, b) => b.caps - a.caps).slice(0, 5), log: wlog.slice(0, 20),
    campaign: campaignInfo(), history: (E.S.history || []).slice(-80), seasons: archive.slice(-6).reverse().map(a => ({ season: a.season, winner: a.winner, winter: a.winter, pts: a.pts, endedAt: a.endedAt })),
    alerts: realWar.alerts && Date.now() - realWar.alertsAt < 10 * 60e3 ? realWar.alerts.on.length : null,
  };
}
// ---------- news wire: season bulletins and breaking posts (dry run: kept in wire.json, not posted anywhere yet) ----------
const wireLog = readJson('wire.json', []);
const wire = createWire({ E, NET, FN, REGIONS, GEVENTS, url: process.env.WIRE_URL || 'globalwar.xyz', publish: post => {
  wireLog.unshift(post); wireLog.length = Math.min(wireLog.length, 100); writeJson('wire.json', wireLog);
  console.log(`[wire] ${post.kind}\n${post.text}\n`);
} });
E.onEvent(ev => {
  events.push(ev); try { chronicle(ev); } catch (e) {}
  if (ROOM === 'main') try { wire.onEvent(ev, season); } catch (e) { console.error('wire', e.message); }
  try { pushForEvent(ev); } catch (e) { console.error('push', e.message); }
  if (ev.k === 'end') {
    const top = E.leaderboard().slice(0, 5).map(h => ({ name: h.name, f: h.f, caps: h.caps }));
    const cw = [0, 0]; for (const a of archive) if (campaignOf(a.season) === campaignOf(season) && a.winner >= 0 && !a.winter) cw[a.winner]++; if (ev.winner >= 0 && !ev.winter) cw[ev.winner]++;
    const campaignDone = season % CAMPAIGN_LEN === 0, campaignWinner = cw[0] === cw[1] ? -1 : cw[0] > cw[1] ? 0 : 1;
    archive.push({ season, endedAt: new Date().toISOString(), pts: ev.pts, cities: ev.cities, winner: ev.winner, winter: !!ev.winter, scenario: E.S.scenario, capital: ev.capital,
      rad: Array.from(E.S.rad).map((v, i) => v ? i : -1).filter(i => i >= 0), campaignDone, campaignWinner: campaignDone ? campaignWinner : undefined, campaignWins: campaignDone ? cw : undefined, history: E.S.history, owner: Array.from(E.S.owner), frames: E.S.frames, top,
      players: [...E.players.values()].filter(p => p.caps || p.sent).length });
    writeJson('archive.json', archive.slice(-200)); savePlayers();
  }
  if (ev.k === 'start' && archive.length) season = archive[archive.length - 1].season + 1;
});
// events are part of the fog of war too: intel, plans and launch keys stay inside the faction that made them,
// and a convoy closing in is news only for the side it is coming at
const PRIVATE_EVENTS = new Set(['op_start', 'op_done', 'op_failed', 'pirates', 'raid', 'decoy', 'spy', 'sat', 'mark', 'unmark', 'rally', 'chief', 'fortify', 'envoy', 'squad', 'combo', 'nuke_armed', 'nuke_abort', 'nuke_confirmed', 'fake', 'donate']);
const seesEvent = (ev, f) => ev.k === 'threat' ? ev.f !== f : PRIVATE_EVENTS.has(ev.k) ? ev.f === f : true;
setInterval(() => {
  if (E.S.ended) {
    if (!restartAt) restartAt = Date.now() + RESTART_AFTER_MS;
    else if (Date.now() > restartAt) { restartAt = 0; for (const p of E.players.values()) if (!p.online && !p.squad) p.f = Math.random() < 0.5 ? 0 : 1; E.applyPendingSquads(); for (const p of E.players.values()) if (p.squad && E.squads.has(p.squad)) p.f = E.squads.get(p.squad).f; season = archive.length ? archive[archive.length - 1].season + 1 : season + 1; prepareSeason(); E.reset(); rebalanceBots(); }
    return;
  }
  let dt = TICK_MS / 1000 * SIM_SPEED;
  while (dt > 0) { const d = Math.min(0.1, dt); E.step(d); dt -= d; }
}, TICK_MS);

setInterval(() => {
  if (!sockets.size) { events = []; return; }
  const views = [E.snapshot(0), E.snapshot(1)], online = humansOnline(), sigs = signals; signals = [[], []];  // fog of war: each faction gets its own view
  const evs = [0, 1].map(f => events.filter(ev => seesEvent(ev, f))); events = [];
  const extra = { online, campaign: campaignInfo(), bots: E.bots, board: E.leaderboard().slice(0, 12), history: E.S.ended ? E.S.history : undefined, frames: E.S.ended ? E.S.frames : undefined, restartIn: restartAt ? Math.max(0, restartAt - Date.now()) : 0 };
  for (const [ws, s] of sockets) {
    if (!s.pid || ws.readyState !== 1) continue;
    const p = E.players.get(s.pid);
    ws.send(JSON.stringify({ type: 'snap', ...views[p.f], ...extra, seasonNo: season, you: you(p), ev: sigs[p.f].length ? evs[p.f].concat(sigs[p.f]) : evs[p.f] }));
  }
}, SNAP_MS);

server.listen(PORT, process.env.HOST || undefined, () => console.log(`Supply Lines ${ROOM} room on http://localhost:${PORT}  (season ${(K.SEASON / SIM_SPEED / 60).toFixed(0)} min real time, 1 CP every ${CP_SECONDS} s, warhead ${K.NUKE_COST} CP, ${BOTS} bots per faction)`));
