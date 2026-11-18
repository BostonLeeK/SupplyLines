// Operations: browser error reports, privacy-friendly daily stats, a health check and daily backups.
//
// Stats never store IP addresses or set cookies. A visitor is counted once a day through a hash of
// (daily random salt + IP + user agent); the salt lives only in memory and changes every day.
// GET /stats shows the numbers: open it from the server itself, or set STATS_KEY and use /stats?key=...
// POST /api/contact takes a message from the contact form: it goes to messages.jsonl in the data folder and the /stats
// page. With CONTACT_DISCORD_WEBHOOK set it also arrives in a Discord channel, and with CONTACT_TG_TOKEN and
// CONTACT_TG_CHAT set, in Telegram; either, both or neither.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const EVENTS = ['visit', 'unique', 'play', 'active5', 'return'];
const BACKUP_FILES = ['messages.jsonl', 'world.json', 'players.json', 'squads.json', 'archive.json', 'auth.json', 'stats.json', 'vapid.json'];
const BACKUP_DAYS = 14, MAX_LOG = 1 << 20, MAX_BODY = 8192;
const today = () => new Date().toISOString().slice(0, 10);

export function createOps({ DATA, getHealth }) {
  const STATS_KEY = process.env.STATS_KEY || '';
  const statsFile = path.join(DATA, 'stats.json'), errFile = path.join(DATA, 'errors.log'), msgFile = path.join(DATA, 'messages.jsonl');
  const TG_TOKEN = process.env.CONTACT_TG_TOKEN || '', TG_CHAT = process.env.CONTACT_TG_CHAT || '';
  const DISCORD = process.env.CONTACT_DISCORD_WEBHOOK || '';
  if (DISCORD && !/^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\//.test(DISCORD)) console.warn('CONTACT_DISCORD_WEBHOOK does not look like a Discord webhook address; messages may not arrive');
  let stats = {}; try { stats = JSON.parse(fs.readFileSync(statsFile, 'utf8')); } catch {}
  let dirty = false, salt = '', saltDay = '', seen = new Set();
  const started = Date.now();

  const bump = (e, n = 1) => { const d = today(); (stats[d] = stats[d] || {})[e] = (stats[d][e] || 0) + n; dirty = true; };
  const saveStats = () => { if (!dirty) return; dirty = false; try { fs.writeFileSync(statsFile + '.tmp', JSON.stringify(stats)); fs.renameSync(statsFile + '.tmp', statsFile); } catch (e) { console.error('stats save failed', e.message); } };
  setInterval(saveStats, 60e3).unref();

  // simple per-IP limits so nobody can flood the logs
  const hits = new Map();
  const allow = (ip, kind, max) => { const k = kind + ip, now = Date.now(), h = hits.get(k); if (!h || now - h.t > 60e3) { hits.set(k, { t: now, n: 1 }); return true; } return ++h.n <= max; };
  setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now - h.t > 120e3) hits.delete(k); }, 300e3).unref();

  const isUnique = (ip, ua) => {
    if (saltDay !== today()) { saltDay = today(); salt = crypto.randomBytes(16).toString('hex'); seen = new Set(); }
    const h = crypto.createHash('sha256').update(salt + '|' + ip + '|' + ua).digest('hex').slice(0, 16);
    if (seen.has(h)) return false; seen.add(h); return true;
  };

  function logError(rec) {
    try {
      if (fs.existsSync(errFile) && fs.statSync(errFile).size > MAX_LOG) fs.renameSync(errFile, errFile + '.1');
      fs.appendFileSync(errFile, JSON.stringify(rec) + '\n');
    } catch {}
    bump('errors');
    console.warn('client error:', rec.msg, rec.src ? `(${rec.src}:${rec.line})` : '');
  }

  // ---------- messages from the contact form ----------
  const TOPICS = ['idea', 'bug', 'player', 'privacy', 'other'];
  const readMessages = () => { try { return fs.readFileSync(msgFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };
  function saveMessage(m) {
    try { fs.appendFileSync(msgFile, JSON.stringify(m) + '\n'); } catch (e) { console.error('message save failed', e.message); return false; }
    bump('messages'); console.log('contact message:', m.topic, m.from || '(no address)');
    if (DISCORD) toDiscord(m);
    if (TG_TOKEN && TG_CHAT) fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ chat_id: TG_CHAT, text: 'Supply Lines · ' + m.topic + (m.name ? ' · ' + m.name : '') + (m.from ? ' · ' + m.from : '') + '\n\n' + m.text }) }).catch(e => console.error('telegram', e.message));
    return true;
  }
  // a card in a Discord channel: the topic as its title and colour, the sender in fields. allowed_mentions stays empty,
  // so "@everyone" or a role written in a message cannot ping anyone.
  const TOPIC_CARD = { idea: ['Idea', 0x4aa3ff], bug: ['Bug', 0xff6b5b], player: ['Player report', 0xffad33], privacy: ['Privacy request', 0xb48cff], other: ['Message', 0x8fa6c8] };
  function toDiscord(m) {
    const [title, color] = TOPIC_CARD[m.topic] || TOPIC_CARD.other;
    const fields = [m.name && { name: 'Name', value: m.name, inline: true }, m.from && { name: 'Email', value: m.from, inline: true }, { name: 'Language', value: m.lang === 'uk' ? 'Ukrainian' : 'English', inline: true }].filter(Boolean);
    fetch(DISCORD + (DISCORD.includes('?') ? '&' : '?') + 'wait=true', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ username: 'Supply Lines', allowed_mentions: { parse: [] }, embeds: [{ title, color, description: m.text, fields, timestamp: m.at, footer: { text: 'Contact form' } }] }) })
      .then(r => { if (!r.ok) console.error('discord: HTTP', r.status); }).catch(e => console.error('discord', e.message));
  }

  // ---------- daily backups inside the data volume ----------
  function backup() {
    try {
      const dir = path.join(DATA, 'backups', today());
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        for (const f of BACKUP_FILES) { const src = path.join(DATA, f); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f)); }
        console.log('backup written', dir);
      }
      const keep = new Date(Date.now() - BACKUP_DAYS * 864e5).toISOString().slice(0, 10);
      for (const d of fs.readdirSync(path.join(DATA, 'backups'))) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < keep) fs.rmSync(path.join(DATA, 'backups', d), { recursive: true, force: true });
    } catch (e) { console.error('backup failed', e.message); }
  }
  setTimeout(backup, 60e3).unref(); setInterval(backup, 3600e3).unref();

  const readBody = (req, cb) => {
    let body = '', big = false;
    req.on('data', d => { body += d; if (body.length > MAX_BODY) { big = true; req.destroy(); } });
    req.on('end', () => { if (big) return; let j = null; try { j = JSON.parse(body); } catch {} cb(j); });
  };
  const clip = (v, n) => String(v ?? '').slice(0, n);

  function statsPage() {
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const list = readMessages().slice(-50).reverse();
    const msgs = '<h1 style="margin-top:28px">Messages</h1><p>From the contact form, newest first (messages.jsonl in the data folder).</p>' + (list.map(m => `<div style="max-width:900px;border:1px solid #1f2a37;border-radius:8px;padding:10px 12px;margin:0 0 10px"><div style="color:#7d8a9a;font-size:12px">${esc(m.at.slice(0, 16).replace('T', ' '))} · ${esc(m.topic)}${m.name ? ' · ' + esc(m.name) : ''}${m.from ? ' · <a style="color:#9fc3ef" href="mailto:' + esc(m.from) + '">' + esc(m.from) + '</a>' : ''}${m.lang ? ' · ' + esc(m.lang) : ''}</div><div style="white-space:pre-wrap;margin-top:6px">${esc(m.text)}</div></div>`).join('') || '<p>None yet.</p>');
    const days = Object.keys(stats).sort().reverse().slice(0, 30), h = getHealth();
    const row = d => { const s = stats[d] || {}; const conv = (a, b) => s[b] ? Math.round((s[a] || 0) / s[b] * 100) + '%' : '–'; return `<tr><td>${d}</td><td>${s.visit || 0}</td><td>${s.unique || 0}</td><td>${s.play || 0} <small>${conv('play', 'unique')}</small></td><td>${s.active5 || 0} <small>${conv('active5', 'play')}</small></td><td>${s.return || 0}</td><td>${s.errors || 0}</td></tr>`; };
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Supply Lines stats</title>
<style>body{margin:0;padding:24px;background:#05080d;color:#e9eef5;font:14px/1.5 system-ui,sans-serif}h1{font-size:20px;margin:0 0 4px}p{color:#7d8a9a;margin:0 0 16px}
table{border-collapse:collapse;width:100%;max-width:900px}th,td{text-align:right;padding:8px 10px;border-bottom:1px solid #1f2a37;font-variant-numeric:tabular-nums}th:first-child,td:first-child{text-align:left}th{color:#7d8a9a;font-weight:600;font-size:12px}small{color:#5d6b7c}</style>
<h1>Supply Lines</h1><p>Now: ${h.online ? h.online[0] + h.online[1] : 0} players online · season ${h.season} · up ${Math.round(h.uptime / 3600)} h · ${h.players} known players. Last 30 days (UTC):</p>
<table><tr><th>Day</th><th>Page loads</th><th>Unique visitors</th><th>Pressed PLAY</th><th>Played 5+ min</th><th>Came back</th><th>JS errors</th></tr>${days.map(row).join('') || '<tr><td colspan="7">No data yet</td></tr>'}</table>
<p style="margin-top:16px">No cookies, no stored IP addresses. Error details: errors.log in the data folder.</p>${msgs}`;
  }

  return {
    // returns true when the request was handled here
    handle(req, res, p) {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (p === '/healthz') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ ok: true, ...getHealth(), since: new Date(started).toISOString() })); return true; }
      if (p === '/api/ev' && req.method === 'POST') {
        readBody(req, j => {
          if (j && EVENTS.includes(j.e) && j.e !== 'unique' && allow(ip, 'ev', 30)) { bump(j.e); if (j.e === 'visit' && isUnique(ip, clip(req.headers['user-agent'], 300))) bump('unique'); }
          res.writeHead(204); res.end();
        });
        return true;
      }
      if (p === '/api/err' && req.method === 'POST') {
        readBody(req, j => {
          if (j && j.msg && allow(ip, 'err', 10)) logError({ at: new Date().toISOString(), msg: clip(j.msg, 300), src: clip(j.src, 120), line: +j.line || 0, col: +j.col || 0, stack: clip(j.stack, 1200), page: clip(j.page, 80), ua: clip(req.headers['user-agent'], 160), v: clip(j.v, 20) });
          res.writeHead(204); res.end();
        });
        return true;
      }
      if (p === '/api/contact' && req.method === 'POST') {
        readBody(req, j => {
          const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
          if (!j) return send(400, { ok: false, err: 'bad' });
          if (j.hp) return send(200, { ok: true });                               // the hidden field: only bots fill it
          const text = clip(j.text, 4000).trim(), from = clip(j.from, 120).trim(), name = clip(j.name, 60).trim();
          if (text.length < 5) return send(400, { ok: false, err: 'short' });
          if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) return send(400, { ok: false, err: 'email' });
          if (!allow(ip, 'msg', 3) || !allow('', 'msgall', 60)) return send(429, { ok: false, err: 'busy' });
          const ok = saveMessage({ at: new Date().toISOString(), topic: TOPICS.includes(j.topic) ? j.topic : 'other', name, from, text, lang: j.lang === 'uk' ? 'uk' : 'en', ua: clip(req.headers['user-agent'], 200) });
          send(ok ? 200 : 500, { ok });
        });
        return true;
      }
      if (p === '/stats') {
        const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
        const key = new URL(req.url, 'http://x').searchParams.get('key');
        if (!local && !(STATS_KEY && key === STATS_KEY)) { res.writeHead(403, { 'content-type': 'text/plain' }); res.end('forbidden: set STATS_KEY and open /stats?key=...'); return true; }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(statsPage()); return true;
      }
      return false;
    },
    saveStats,
  };
}
