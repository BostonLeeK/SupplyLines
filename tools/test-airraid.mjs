// Air raids in the war: a drone strike on a city whose faction has players online becomes a raid one of them fights;
// the server replays the player's inputs and the warheads that got through decide the blackout.
//   node tools/test-airraid.mjs
import fs from 'fs';
import assert from 'assert/strict';
import { createEngine } from '../game/engine.js';
import { createRaid, polar } from '../game/raid.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const E = createEngine(NET), K = E.K, S = E.S;
const atk = E.addPlayer('a1', 0), def = E.addPlayer('d1', 1), def2 = E.addPlayer('d2', 1), evs = []; E.onEvent(e => evs.push(e));
for (let k = 0; k < 200; k++) E.step(0.1);
for (const c of E.cities) S.owner[c.i] = c.lng < 20 ? 0 : 1;   // a front through Europe, so there are hubs in strike range
S.ew = []; S.airraids = [];
const target = () => E.cities.find(c => E.strikeOk(0, c.i) && !S.airraids.some(r => r.i === c.i));

// a strike opens a raid instead of rolling dice, and only the defenders see it
let t = target(); atk.cp = 99; S.ew = [];
assert.equal(E.command('a1', { type: 'strike', city: t.i }).result, 'raid');
assert.equal(S.airraids.length, 1); const r = S.airraids[0];
assert.ok(evs.some(e => e.k === 'airraid' && e.city === t.i));
assert.equal(E.snapshot(0).airraids.length, 0, 'the attacker does not see the raid');
assert.equal(E.snapshot(1).airraids[0].params.seed, r.params.seed);
assert.ok(r.params.bearings.length >= 1 && r.params.bearings.every(b => b >= 0 && b < 360));
assert.equal(E.command('a1', { type: 'airraid_take', id: r.id }).ok, false, 'the attacker cannot take it');

// one defender takes it; the second one is told who did
const tk = E.command('d1', { type: 'airraid_take', id: r.id }); assert.ok(tk.ok); assert.equal(tk.raid, r.id); assert.equal(tk.id, undefined, 'id is the request id on the wire'); assert.equal(tk.params.seed, r.params.seed);
assert.match(E.command('d2', { type: 'airraid_take', id: r.id }).msg, /already defending/);
assert.equal(E.command('d2', { type: 'airraid_done', id: r.id, log: [] }).ok, false, 'only the taker reports');

// a good defence: deploy toward the threat, SAM the fast ones, jam the links
function defend(params) {
  const raid = createRaid(params), R = raid.S, b = params.bearings[0];
  raid.input({ a: 'kit', kit: { sam: 1, cells: 1 } }); const [sx, sy] = polar(b, 40); raid.input({ a: 'place', what: 'site', x: sx, y: sy });
  [b - 20, b, b + 20].forEach((bb, g) => { const [x, y] = polar(bb, 70); raid.input({ a: 'place', g, x, y }); }); raid.deployNow();
  while (!R.done) {
    if (R.tick % 6 === 0) {
      const tg = R.targets.filter(m => raid.tracked(m) && raid.inSamRange(m) && !R.missiles.some(x => x.id === m.id && !x.done) && (m.type === 'cruise' || m.type === 'jet' || m.type === 'hunter'));
      tg.sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y)); if (tg[0] && R.sams > 0) raid.input({ a: 'fire', id: tg[0].id });
      const live = R.links.find(l => R.targets.some(m => m.link === l.id && !m.dead && m.jammed === undefined));
      raid.input(live && R.jam.battery > 0.15 ? { a: 'jam', on: true, f: live.freq } : { a: 'jam', on: false });
    }
    raid.step();
  }
  return { log: raid.log, res: raid.result() };
}
const good = defend(r.params), xp = def.xp || 0;
const done = E.command('d1', { type: 'airraid_done', id: r.id, log: good.log });
assert.ok(done.ok); assert.equal(done.leaks, good.res.leaks, 'the server replay agrees with the client');
assert.equal(S.airraids.length, 0); assert.ok(def.xp > xp, 'defending pays xp');
if (!good.res.leaks) assert.ok(evs.some(e => e.k === 'strike_down' && e.city === t.i && e.raid)); else assert.ok(S.blackout.some(b => b.city === t.i));

// nobody defends: a log of nothing lets the raid through and the blackout is full length
t = target(); atk.cp = 99; S.ew = []; S.blackout = [];
E.command('a1', { type: 'strike', city: t.i }); const r2 = S.airraids[0];
E.command('d2', { type: 'airraid_take', id: r2.id });
const idle = E.command('d2', { type: 'airraid_done', id: r2.id, log: [] });
assert.ok(idle.leaks >= K.AIRRAID_FULL, 'an idle raid lets plenty through'); assert.equal(idle.out, 'hit');
const bo = S.blackout.find(b => b.city === t.i); assert.ok(Math.abs(bo.until - S.simT - K.BLACKOUT_TIME) < 1e-6);

// junk logs are refused or ignored, never crash the server
t = target(); atk.cp = 99; S.ew = []; E.command('a1', { type: 'strike', city: t.i }); const r3 = S.airraids[0];
E.command('d1', { type: 'airraid_take', id: r3.id });
assert.equal(E.command('d1', { type: 'airraid_done', id: r3.id, log: 'x' }).ok, false);
assert.equal(E.command('d1', { type: 'airraid_done', id: r3.id, log: new Array(K.AIRRAID_LOG + 1).fill([0, {}]) }).ok, false);
assert.ok(E.command('d1', { type: 'airraid_done', id: r3.id, log: [[-1, {}], [3, null], [2, { a: 'fire', id: 999 }], [1.5, { a: 'jam' }], [5, { a: 'place', what: 'site', x: 'z', y: NaN }]] }).ok);

// an alert nobody answers falls back to the dice roll once the call runs out
t = target(); atk.cp = 99; S.ew = []; S.troops[t.i] = 1e5; E.command('a1', { type: 'strike', city: t.i }); const id1 = S.airraids[0].id;
for (let k = 0; k < K.AIRRAID_CALL * 10 + 5; k++) E.step(0.1);
assert.ok(!S.airraids.some(x => x.id === id1)); assert.ok(evs.some(e => e.k === 'airraid_end' && e.city === t.i));
assert.ok(evs.some(e => (e.k === 'strike_down' || e.k === 'blackout') && e.city === t.i && e.raid && e.raid.auto));

// a taken raid that is never reported also falls back
t = target(); atk.cp = 99; S.ew = []; E.command('a1', { type: 'strike', city: t.i }); const r4 = S.airraids[0]; E.command('d1', { type: 'airraid_take', id: r4.id });
for (let k = 0; k < K.AIRRAID_PLAY * 10 + 5; k++) E.step(0.1);
assert.ok(!S.airraids.some(x => x.id === r4.id));
S.airraids = [];

// the city's commander gets the first call
t = target(); S.cmdr[t.i] = 'd2'; atk.cp = 99; S.ew = []; E.command('a1', { type: 'strike', city: t.i }); const r5 = S.airraids[0];
assert.match(E.command('d1', { type: 'airraid_take', id: r5.id }).msg, /first call/);
assert.ok(E.command('d2', { type: 'airraid_take', id: r5.id }).ok);
S.cmdr[t.i] = null; S.airraids = [];

// with no defenders online, a strike is the old dice roll
def.online = false; def2.online = false; t = target(); atk.cp = 99; S.ew = [];
assert.notEqual(E.command('a1', { type: 'strike', city: t.i }).result, 'raid');
console.log('air raid in the war: ok');
