// Supply Lines Wire: news-agency style posts built from game events, in the spirit of Plague Inc headlines.
// One bulletin when a season ends, plus rare BREAKING posts (nuclear strikes, a fallen capital).
// Every post is clearly marked as the game, so a headline about a real city is never mistaken for real news.
//
//   const wire = createWire({ E, NET, FN, REGIONS, GEVENTS, url, publish });
//   E.onEvent(ev => wire.onEvent(ev, season));
// `publish(post)` gets { kind: 'season' | 'breaking', season, text, at } and decides where it goes.

const TAG = '#SupplyLines';
const HEAD = '🛰 SUPPLY LINES WIRE';
const MAX = 280, URL_LEN = 23;                     // X counts any link as 23 characters
const BREAKING_PER_SEASON = 2, BREAKING_GAP_MS = 15 * 60e3;
const pick = a => a[(Math.random() * a.length) | 0];

// Cities that never appear in a headline: a game post about a strike on Kyiv reads too much like real news.
export const QUIET = ['Kyiv', 'Odesa', 'Kharkiv', 'Lviv'];

export function createWire({ E, NET, FN, REGIONS, GEVENTS, url = 'globalwar.xyz', publish = () => {}, now = () => Date.now(), quiet = QUIET }) {
  const C = E.cities, K = E.K, hush = new Set(quiet);
  const loud = i => C[i] && !hush.has(C[i].name);
  const nation = n => (NET.nations && NET.nations[n] ? NET.nations[n][0] : 'a free nation');
  const region = r => REGIONS[r].replace(/^The /, 'the ');
  const day = () => Math.min(7, Math.floor(E.S.simT / (K.SEASON / 7)) + 1);

  let items = [], flips = new Map(), lead = 0, behind = [0, 0], breakingN = 0, lastBreaking = -Infinity, betrayed = new Set();
  const add = (score, text, extra = {}) => items.push({ score, text, d: day(), ...extra });
  const reset = () => { items = []; flips = new Map(); lead = 0; behind = [0, 0]; breakingN = 0; betrayed = new Set(); };

  // ---------- turning events into stories ----------
  function story(ev) {
    const f = ev.f, A = FN[f], B = FN[1 - f];
    switch (ev.k) {
      case 'capture': {
        const c = C[ev.city]; if (!loud(ev.city)) return;
        const fromEnemy = ev.prev === 1 - f; // early grabs of neutral cities are expansion, not news
        if (fromEnemy) flips.set(ev.city, (flips.get(ev.city) || 0) + 1);
        if (c.cap >= 0 && ev.prev === c.cap) return add(100, pick([`${c.name} falls. ${A} storms the ${B} capital`, `${B} capital ${c.name} is in ${A} hands`, `${A} takes ${c.name}: the ${B} capital has fallen`]), { breaking: true, type: 'capital', city: ev.city, after: `If ${A} holds it for 12 hours, the war is over` });
        if (c.choke >= 0) { const ch = E.chokes.find(x => x.k === c.choke); return add(fromEnemy ? 38 : 26, pick([`${A} seizes ${c.name} and takes the ${ch.name}`, `The ${ch.name} is in ${A} hands: ${c.name} falls`]), { type: 'choke', city: ev.city }); }
        if (c.tier === 3) return add(fromEnemy ? 40 : 10, fromEnemy ? pick([`${A} seizes the ${B} megahub of ${c.name}`, `${c.name} megahub falls to ${A}`, `${A} flags fly over ${c.name}`]) : pick([`${A} secures ${c.name}, a global megahub`, `${c.name} megahub joins ${A}`]), { type: 'hub', city: ev.city });
        if (c.ncap && !fromEnemy) return add(9, pick([`${A} marches into ${c.name}, capital of ${nation(c.nation)}`, `${nation(c.nation)} loses its capital ${c.name} to ${A}`]), { type: 'ncap', city: ev.city });
        if (c.tier === 2 && fromEnemy) return add(c.port ? 20 : 16, c.port ? pick([`${A} takes the ${B} port of ${c.name}`, `Port of ${c.name} changes hands: now ${A}`]) : pick([`${A} captures ${c.name} from ${B}`, `${c.name} falls to ${A}`]), { type: 'city', city: ev.city });
        return;
      }
      case 'region': if (f < 0) return; return add(ev.was >= 0 && ev.was !== f ? 55 : 28, ev.was >= 0 && ev.was !== f ? pick([`${A} wrests ${region(ev.r)} from ${FN[ev.was]}`, `${region(ev.r)} switches sides: ${A} now holds every city`]) : pick([`${A} controls all of ${region(ev.r)}`, `All of ${region(ev.r)} is now ${A}`]), { type: 'region' });
      case 'ally': { const n = (ev.cities || []).length; return add(50, pick([`${nation(ev.nation)} joins ${A}. ${n > 1 ? n + ' cities change sides overnight' : 'Its gates open to ' + A + ' convoys'}`, `Diplomatic coup: ${nation(ev.nation)} sides with ${A}`]), { type: 'ally' }); }
      case 'betray': if (betrayed.has(ev.nation) || !loud(ev.city)) return; betrayed.add(ev.nation); return add(24, pick([`${A} betrays ${nation(ev.nation)}, seizing ${C[ev.city].name}. ${B} gains a friend`, `Outrage in ${nation(ev.nation)} as ${A} troops take ${C[ev.city].name} by force`]), { type: 'betray' });
      case 'fleet_sunk': return add(20, ev.city >= 0 && loud(ev.city) ? `${A} fleet sunk off ${C[ev.city].name}` : `${A} loses a fleet at sea`, { type: 'navy' });
      case 'naval': if (!loud(ev.city)) return; return add(14, `Naval battle off ${C[ev.city].name}: ${A} holds the sea`, { type: 'navy' });
      case 'blockade': if (ev.who === 'bot' || C[ev.city].tier < 2 || !loud(ev.city)) return; return add(16, `${A} blockades ${C[ev.city].name}. Shipping halts`, { type: 'blockade' });
      case 'gevent': { const g = GEVENTS[ev.ev]; if (!g) return; return add(22, `${g.icon} ${g.name}: ${g.text.split(/[.;]/)[0]}`, { type: 'gevent' }); }
      case 'nuke_hit': if (!loud(ev.target)) return add(120, `☢ ${A} detonates a warhead. ${ev.cities.length} ${ev.cities.length === 1 ? 'city' : 'cities'} turned to fallout`, { breaking: true, type: 'nuke' }); return add(120, `☢ Nuclear strike on ${C[ev.target].name}. ${ev.cities.length} ${ev.cities.length === 1 ? 'city' : 'cities'} turned to fallout. ${A} fired it`, { breaking: true, type: 'nuke', after: E.S.strikes >= 1 && !E.S.winter ? 'One more strike this season means nuclear winter for everyone' : '' });
      case 'nuke_intercept': return add(80, `☢ ${B} air defence shoots down a ${A} warhead${loud(ev.target) ? ' over ' + C[ev.target].name : ''}`, { breaking: true, type: 'nuke' });
    }
  }
  // lead changes come from the score history (sampled by the engine)
  // only the last lead change after day 2 is a story; the biggest deficit makes the comeback line
  function trackLead() {
    const p = E.scores().pts, l = p[0] > p[1] ? 1 : p[1] > p[0] ? -1 : 0;
    if (day() >= 3) { behind[0] = Math.max(behind[0], p[1] - p[0]); behind[1] = Math.max(behind[1], p[0] - p[1]); }
    if (l && lead && l !== lead && day() >= 3) { const w = l > 0 ? 0 : 1; items = items.filter(it => it.type !== 'lead'); add(35, pick([`${FN[w]} takes the lead ${p[w]}–${p[1 - w]}`, `Momentum shifts: ${FN[w]} pulls ahead ${p[w]}–${p[1 - w]}`]), { type: 'lead' }); }
    if (l) lead = l;
  }

  // ---------- composing posts ----------
  const len = s => s.replace(/https?:\/\/\S+|\b[a-z0-9-]+\.(xyz|com|org|net)\S*/gi, 'x'.repeat(URL_LEN)).length + [...s].filter(ch => ch.codePointAt(0) > 0xffff).length;
  function fit(head, lines, tail) {
    for (let n = lines.length; n >= 0; n--) { const t = [head, ...lines.slice(0, n), tail].filter(Boolean).join('\n'); if (len(t) <= MAX) return t; }
    return [head, tail].join('\n');
  }
  function bulletin(ev, season) {
    const w = ev.winter ? -1 : ev.winner, pri = [], seen = new Map(), cities = new Set();
    if (w >= 0 && behind[w] >= 12) pri.push({ d: 7, text: `${FN[w]} came back from ${behind[w]} points down`, type: 'lead' });
    const hot = [...flips].filter(([i, n]) => n >= 3 && C[i].tier >= 2).sort((a, b) => b[1] - a[1])[0];
    if (hot) { pri.push({ d: 7, text: `${C[hot[0]].name} changed hands ${hot[1]} times`, type: 'hot' }); cities.add(hot[0]); }
    for (const it of pri) seen.set(it.type, 1);
    for (const it of [...items].sort((a, b) => b.score - a.score || a.d - b.d)) {
      const n = seen.get(it.type) || 0; if (n >= (it.type === 'city' || it.type === 'lead' ? 1 : 2)) continue;
      if (it.city >= 0 && cities.has(it.city)) continue;
      seen.set(it.type, n + 1); if (it.city >= 0) cities.add(it.city); pri.splice(it.score >= 50 ? 0 : pri.length, 0, it);
    }
    const [a, b] = ev.pts, head = `${HEAD} · Season ${season} ends\n` + (ev.winter ? '❄ Nuclear winter. Nobody wins this war' : w >= 0 && ev.capital >= 0 ? `${FN[w]} wins by holding ${loud(ev.capital) ? C[ev.capital].name : 'the enemy capital'} for 12 hours` : w >= 0 ? `${FN[w]} wins ${Math.max(a, b)}–${Math.min(a, b)}` : `A draw, ${a}–${b}`);
    const tail = `\nNext war starts now → ${url} ${TAG}`;
    for (let n = Math.min(4, pri.length); n >= 0; n--) {
      const t = [head, ...pri.slice(0, n).sort((x, y) => x.d - y.d).map(it => `▪ D${it.d} · ${it.text}`), tail].join('\n');
      if (len(t) <= MAX) return t;
    }
    return head + '\n' + tail;
  }
  function breaking(it, season) {
    const t = now(); if (breakingN >= BREAKING_PER_SEASON || t - lastBreaking < BREAKING_GAP_MS) return null;
    breakingN++; lastBreaking = t;
    return fit(`🚨 BREAKING · ${HEAD.replace('🛰 ', '')} · Season ${season}, day ${it.d}`, [it.text, it.after].filter(Boolean), `${url} ${TAG}`);
  }

  function onEvent(ev, season) {
    if (ev.k === 'start') return reset();
    const before = items.length;
    try { story(ev); trackLead(); } catch (e) { return; }
    for (const it of items.slice(before)) if (it.breaking && !E.S.ended) { const text = breaking(it, season); if (text) publish({ kind: 'breaking', season, text, at: new Date(now()).toISOString() }); }
    if (ev.k === 'end') publish({ kind: 'season', season, text: bulletin(ev, season), at: new Date(now()).toISOString() });
  }
  return { onEvent, reset, len, _items: () => items };
}
