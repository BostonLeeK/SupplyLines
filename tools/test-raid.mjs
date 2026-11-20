// Air raid mini-game: deterministic, replayable, and only a defender who plays keeps the city safe.
//   node tools/test-raid.mjs
import assert from 'assert/strict';
import { createRaid, replayRaid, planRaid, polar, kitCost, RAID } from '../game/raid.js';
const params = seed => ({ seed, bearings: [80, 110], size: 1, night: seed % 3 === 0 });

// the same seed plans the same raid: three waves with decoys, a hunter, hopping jets and a cruise salvo
const a = planRaid(params(7)), b = planRaid(params(7));
assert.deepEqual(a, b, 'same seed, same raid');
assert.equal(a.waves.length, 3);
for (const t of ['decoy', 'cruise', 'jet', 'hunter', 'shahed']) assert.ok(a.targets.some(x => x.type === t), t);
assert.ok(a.links.some(l => l.hop));

// nobody at the controls: most of it gets through
let idleLeaks = 0, idleWar = 0;
for (let s = 1; s <= 30; s++) { const r = createRaid(params(s)); while (!r.S.done) r.step(); const res = r.result(); idleLeaks += res.leaks; idleWar += res.warheads; assert.equal(res.rating, 'D'); }
assert.ok(idleLeaks / idleWar > 0.5, 'an undefended city takes the raid');

// a defender who deploys, jams links and spends SAMs on fast targets holds it; the server's replay agrees exactly
const deploy = r => { r.input({ a: 'kit', kit: { sam: 1, cells: 1 } }); const [sx, sy] = polar(95, 40); r.input({ a: 'place', what: 'site', x: sx, y: sy }); [75, 95, 115].forEach((bb, g) => { const [x, y] = polar(bb, 70); r.input({ a: 'place', g, x, y }); }); r.deployNow(); };
let good = 0;
for (let s = 1; s <= 30; s++) {
  const r = createRaid(params(s)), S = r.S; deploy(r);
  while (!S.done) {
    if (S.tick % 6 === 0) {
      const tg = S.targets.filter(m => r.tracked(m) && r.inSamRange(m) && !S.missiles.some(x => x.id === m.id && !x.done) && (m.type === 'cruise' || m.type === 'jet' || m.type === 'hunter'));
      tg.sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y)); if (tg[0] && S.sams > 0) r.input({ a: 'fire', id: tg[0].id });
      const live = S.links.find(l => S.targets.some(m => m.link === l.id && !m.dead && m.jammed === undefined));
      r.input(live && S.jam.battery > 0.15 ? { a: 'jam', on: true, f: live.freq } : { a: 'jam', on: false });
    }
    r.step();
  }
  const res = r.result(); if (res.leaks <= 1) good++;
  assert.deepEqual(replayRaid(params(s), r.log), res, 'replay matches seed ' + s);
}
assert.ok(good >= 26, 'a good defence holds most raids: ' + good + '/30');

// the kit costs what it says and cannot go over budget; deploying is only before the fight
{
  const r = createRaid({ ...params(2), budget: 6 }), S = r.S;
  assert.equal(kitCost({ sam: 1, group: 1 }), 5);
  r.input({ a: 'kit', kit: { sam: 2, radar: 1 } }); r.deployNow(); assert.equal(S.samsMax, 6, 'over budget: refused');
  r.input({ a: 'kit', kit: { sam: 1, group: 1 } }); r.deployNow(); assert.equal(S.samsMax, 8); assert.equal(S.groups.length, 4);
  r.input({ a: 'place', what: 'site', x: 5000, y: 0 }); r.deployNow(); assert.ok(Math.hypot(...S.site) <= RAID.DEPLOY_REACH + 1e-6);
  r.step(); const site = S.site.slice(); r.input({ a: 'place', what: 'site', x: 0, y: 0 }); r.step(); assert.deepEqual(S.site, site, 'no moving the SAM site once the raid is on');
}
// inputs are checked: no SAM at an unseen target, fire groups stay near the city
{
  const r = createRaid(params(3)), S = r.S;
  while (!S.targets.length) r.step();
  const m = S.targets[0]; m.seen = undefined; r.input({ a: 'fire', id: m.id }); r.step(); assert.equal(S.sams, r.P.sams, 'cannot fire at a target the radar has not painted');
  r.input({ a: 'move', g: 0, x: 5000, y: 0 }); r.step(); assert.ok(Math.hypot(S.groups[0].tx, S.groups[0].ty) <= RAID.GUN_REACH + 1e-6);
}
// holding fire does not pay when the city is hit
{ const r = createRaid(params(5)); while (!r.S.done) r.step(); const res = r.result(); assert.ok(res.leaks > 0 && res.score < 300, 'score ' + res.score); }
console.log('raid ok: idle leak share', (idleLeaks / idleWar).toFixed(2), '· good defence held', good, '/ 30');
