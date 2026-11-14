// Canals and straits, doctrines, railways, airfields, the government in exile and night effects.
import fs from 'fs';
import { createEngine, K, DOCTRINES, WEATHER } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const fresh = () => { const E = createEngine(NET); const p = E.addPlayer('p', 0, 'Tester'); p.online = true; p.cp = 50; while (E.S.simT < 3) E.step(0.1); return { E, S: E.S, p }; };
const idx = (E, n) => E.cities.findIndex(c => c.name === n);
const edge = (E, a, b) => E.edges.find(e => (e.a === idx(E, a) && e.b === idx(E, b)) || (e.a === idx(E, b) && e.b === idx(E, a)));

{ // canals and straits
  const { E, S } = fresh();
  for (const [a, b] of [['Port Said', 'Jeddah'], ['Jeddah', 'Aden'], ['Aden', 'Mumbai'], ['Panama City', 'Lima'], ['Lisbon', 'Algiers']]) ok(edge(E, a, b) && edge(E, a, b).type === 1, `sea lane ${a}–${b} exists`);
  const gib = edge(E, 'Lisbon', 'Algiers'), cas = idx(E, 'Casablanca');
  S.owner[idx(E, 'Lisbon')] = 0; S.owner[idx(E, 'Algiers')] = 0; S.owner[cas] = 1;
  ok(!E.edgeOpen(gib, 0) && E.edgeOpen(gib, 1), 'Gibraltar lane is shut to the enemy of whoever holds Casablanca');
  S.owner[cas] = 0; ok(E.edgeOpen(gib, 0), 'and open once you hold Casablanca');
  const before = E.scores().pts[0]; S.owner[idx(E, 'Port Said')] = 0; ok(E.scores().pts[0] - before >= K.CHOKE_PTS + 1, 'holding a canal city is worth extra points');
}
{ // doctrine
  const { E, S, p } = fresh();
  while (!E.chiefOf(0) && S.simT < 20) E.step(0.1);
  ok(E.chiefOf(0) === p, 'the only online player is the general');
  ok(E.command('p', { type: 'doctrine', kind: 'blitz' }).ok && S.doctrine[0] === 'blitz', 'general picks Blitzkrieg on day 1');
  ok(!E.command('p', { type: 'doctrine', kind: 'navy' }).ok, 'the doctrine cannot change');
  while (S.simT < K.SEASON / 7 + 1) E.step(0.1);
  ok(DOCTRINES[S.doctrine[1]], `HQ picked ${S.doctrine[1]} for the faction without a choice`);
  const own = [...Array(E.N).keys()].find(i => S.owner[i] === 0 && E.cities[i].tier === 3);
  ok(E.dropKm(0) === K.DROP_KM && E.defMult(own) < E.defMult(own) / 0.9 + 1e-9, 'Blitzkrieg: defence ×0.9');
}
{ // railway and airfield
  const { E, S, p } = fresh();
  const e = E.edges.find(x => x.type === 0 && S.owner[x.a] === 0 && S.owner[x.b] === 0);
  const cost0 = E.edgeCost(e);
  ok(E.command('p', { type: 'rail', a: e.a, b: e.b }).ok && S.rail[e.i] === 1, `railway built ${E.cities[e.a].name}–${E.cities[e.b].name}`);
  ok(E.edgeCost(e) < cost0, 'routes prefer the railway');
  const t2 = [...Array(E.N).keys()].find(i => E.cities[i].tier === 2 && S.owner[i] === 0);
  if (t2 >= 0) { const tgt = [...Array(E.N).keys()].find(i => S.owner[i] !== 0 && !S.rad[i] && E.kmBetween(t2, i) < K.DROP_KM);
    ok(!E.canDrop(t2, tgt), 'no airdrop from a large city without an airfield');
    ok(E.command('p', { type: 'airfield', city: t2 }).ok && E.canDrop(t2, tgt), `airfield in ${E.cities[t2].name} launches airdrops`); }
}
{ // government in exile
  const { E, S, p } = fresh(); E.bots = [0, 0];
  const cap = E.CAPS[0]; S.owner[cap] = 1; S.troops[cap] = 3000; E.step(0.1);
  const h = S.capHold[0], left = h.until - S.simT;
  ok(E.command('p', { type: 'exile' }).ok && S.exile[0] >= 0, `government moved to ${E.cities[S.exile[0]].name}`);
  ok(Math.abs((h.until - S.simT) - left * K.EXILE_SLOW) < 0.5, 'the countdown now runs at half speed');
  S.owner[cap] = 0; S.troops[cap] = 100; E.step(0.1); ok(S.exile[0] === -1, 'retaking the capital ends the exile');
}
{ // night
  const { E, S } = fresh(); const i = 0, h0 = E.hourAt(i);
  let n = 0, d = 0; for (let t = 0; t < 129; t += 1) { S.simT = t; E.isNight(i) ? n++ : d++; }
  ok(n > 10 && d > 60, `London has night and day (${n} night / ${d} day sim-s per game day)`);
}
{ // decoys: no troops leave, the enemy sees a standard convoy, nothing happens on arrival
  const { E, S, p } = fresh(); E.bots = [0, 0];
  const src = [...Array(E.N).keys()].find(i => S.owner[i] === 0 && E.adj[i].some(x => S.owner[x.to] !== 0 && x.e.type === 0));
  const dst = E.adj[src].find(x => S.owner[x.to] !== 0 && x.e.type === 0).to; S.owner[dst] = 1; S.troops[dst] = 30;
  const t0 = S.troops[src], own0 = S.owner[dst];
  ok(E.command('p', { type: 'send', src, dst, pct: 0.5, kind: 'decoy' }).ok, `decoy sent ${E.cities[src].name} → ${E.cities[dst].name}`);
  ok(Math.abs(S.troops[src] - t0) < 1, 'no troops left the city');
  const cv = S.convoys.find(c => c.kind === 'decoy'), view = E.snapshot(1).conv.find(c => c[0] === cv.id), mine = E.snapshot(0).conv.find(c => c[0] === cv.id);
  ok(view && view[8] === 'std' && view[2] > 0, `the enemy sees a standard convoy of ${view && view[2]}`);
  ok(mine && mine[8] === 'decoy', 'its owner sees the decoy');
  while (S.convoys.some(c => c.id === cv.id && c.alive)) E.step(0.1);
  ok(S.owner[dst] === own0 && S.troops[dst] >= 29, 'it vanished at the target without a fight');
}
{ // sabotage cuts enemy railways into the city
  const { E, S, p } = fresh();
  const e = E.edges.find(x => x.type === 0 && S.owner[x.a] === 0 && S.owner[x.b] === 0); S.rail[e.i] = 1;
  const pb = E.addPlayer('q', 1, 'Enemy'); pb.cp = 20; const t = e.a; S.owner[E.adj[t][0].to] = 1;
  const nb = E.adj[t].find(x => x.to !== e.b); S.owner[nb.to] = 1;
  ok(E.command('q', { type: 'sabotage', city: t }).ok && S.rail[e.i] === 0, 'sabotage blew up the railway');
}
{ // unrest in a free-nation city taken by force
  const { E, S } = fresh(); E.bots = [0, 0];
  const v = [...Array(E.N).keys()].find(i => E.cities[i].nation >= 0 && S.owner[i] < 0);
  const src = E.adj[v][0].to; S.owner[src] = 0; S.troops[src] = 400; S.favour[E.cities[v].nation] = [0, 0];
  E.command('p', { type: 'send', src, dst: v, pct: 0.9, kind: 'std' }); let n = 0; while (S.owner[v] !== 0 && n++ < 2000) E.step(0.1);
  ok(S.owner[v] === 0 && S.unrest[v] > S.simT, `${E.cities[v].name} taken: unrest for ${Math.round(S.unrest[v] - S.simT)} sim-s`);
  const tr = S.troops[v]; let ups = 0; E.onEvent(ev => { if ((ev.k === 'uprising' || ev.k === 'revolt') && ev.city === v) ups++; });
  while (S.simT < S.unrest[v] - 1 && S.owner[v] === 0) E.step(0.1);
  ok(S.troops[v] <= tr + 0.01, 'no production while in unrest'); console.log(`      ${ups} uprisings`);
}
{ // weather follows the calendar
  const { E, S } = fresh(); const m = new Date().getUTCMonth();
  const exp = Object.keys(WEATHER).filter(k => WEATHER[k].months.includes(m)); ok(JSON.stringify(S.weather) === JSON.stringify(exp), `weather now: ${S.weather.join(', ') || 'clear'}`);
  S.weather = ['snow']; const e = E.edges.find(x => x.type === 0 && WEATHER.snow.regions.includes(E.cities[x.a].region));
  ok(E.weatherSlow(e) === K.SNOW_SLOW, `snow slows ${E.cities[e.a].name}–${E.cities[e.b].name}`);
}
{ // bots build and deceive over a season
  const E = createEngine(NET), S = E.S, ev = {}; E.onEvent(x => { if (x.who === 'bot') ev[x.k] = (ev[x.k] || 0) + 1; });
  let decoys = 0; while (!S.ended) { E.step(0.1); for (const c of S.convoys) if (c.kind === 'decoy' && !c.seen) { c.seen = 1; decoys++; } }
  ok(ev.rail >= 2 && ev.airfield > 0 && decoys >= 1, `bots: ${ev.rail || 0} railways, ${ev.airfield || 0} airfields, ${decoys} decoys`);
}
if (fail) process.exit(1);
