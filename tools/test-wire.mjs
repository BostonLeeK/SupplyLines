// Runs bot-only seasons through the news wire and prints every post it would publish.
//   node tools/test-wire.mjs [seasons]
import fs from 'fs';
import { createEngine, FN, REGIONS, GEVENTS } from '../game/engine.js';
import { createWire } from '../server/wire.mjs';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const n = +process.argv[2] || 3; let fake = Date.now(), bad = 0, posts = 0;
for (let s = 1; s <= n; s++) {
  const E = createEngine(NET);
  const wire = createWire({ E, NET, FN, REGIONS, GEVENTS, now: () => fake, publish: p => { posts++; const L = wire.len(p.text); if (L > 280) bad++; console.log(`--- ${p.kind} (${L} chars)\n${p.text}\n`); } });
  E.onEvent(ev => wire.onEvent(ev, s));
  while (!E.S.ended) { E.step(0.1); fake += 800; } // 0.1 sim-s ≈ 0.8 s real at SIM_SPEED 0.125
}
console.log(`${posts} posts, ${bad} over 280 characters`);
if (bad) process.exit(1);

// breaking news: a capital falls, then a strike; the second one inside 15 minutes is held back
{
  const E = createEngine(NET), got = []; let t = 0;
  const wire = createWire({ E, NET, FN, REGIONS, GEVENTS, now: () => t, publish: p => got.push(p) });
  E.S.simT = 300; const cap = E.CAPS[1], hub = E.cities.find(c => c.tier === 3 && c.cap < 0).i, kyiv = E.cities.find(c => c.name === 'Kyiv').i;
  wire.onEvent({ k: 'capture', f: 0, city: cap, prev: 1 }, 7);
  t += 5 * 60e3; wire.onEvent({ k: 'nuke_hit', f: 1, target: hub, cities: [hub] }, 7);
  t += 20 * 60e3; wire.onEvent({ k: 'nuke_hit', f: 1, target: kyiv, cities: [kyiv] }, 7);
  for (const p of got) console.log(`--- ${p.kind} (${wire.len(p.text)} chars)\n${p.text}\n`);
  const ok = got.length === 2 && got[0].text.includes(E.cities[cap].name) && !got[1].text.includes('Kyiv');
  console.log(ok ? 'breaking: ok' : 'breaking: FAILED'); if (!ok) process.exit(1);
}
