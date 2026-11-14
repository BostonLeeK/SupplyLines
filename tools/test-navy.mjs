import fs from 'fs';
import { createEngine } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
let wa = 0, wb = 0, winters = 0, built = 0, intercepts = 0, naval = 0, sunk = 0;
for (let r = 0; r < 16; r++) {
  const E = createEngine(NET);
  E.onEvent(ev => { if (ev.k === 'fleet_built') built++; if (ev.k === 'intercept') intercepts++; if (ev.k === 'naval') naval++; if (ev.k === 'fleet_sunk') sunk++; if (ev.k === 'end' && ev.winter) winters++; });
  while (!E.S.ended) E.step(0.1);
  const p = E.scores().pts; if (!E.S.winter) { if (p[0] > p[1]) wa++; else wb++; }
}
console.log({ wa, wb, winters, built, intercepts, naval, sunk });
// player flow
const E = createEngine(NET); E.bots = [0, 0]; const pl = E.addPlayer('me', 0);
const port = E.cities.find(c => E.harbour(c.i) && E.S.owner[c.i] === 0) || (() => { const c = E.cities.find(c => E.harbour(c.i)); E.S.owner[c.i] = 0; return c; })(); E.S.troops[port.i] = 200; pl.cp = 10;
console.log('build', E.command('me', { type: 'fleet_build', city: port.i }));
const fl = E.S.fleets[0]; const target = E.cities.find(c => c.port && c.i !== port.i && E.seaRoute(port.i, c.i));
console.log('sail to', target.name, E.command('me', { type: 'fleet_sail', fleet: fl.id, city: target.i }));
for (let k = 0; k < 600 && E.S.fleets[0] && E.S.fleets[0].moving; k++) E.step(0.1);
console.log('arrived at', E.S.fleets[0] && E.cities[E.S.fleets[0].at].name, 'str', E.S.fleets[0] && E.S.fleets[0].str.toFixed(1));
const src = E.cities.find(c => E.S.owner[c.i] === 0 && E.S.troops[c.i] > 20); pl.cp = 10;
const rr = E.routeFrom(src.i, 0), dst = E.cities.find(c => E.S.owner[c.i] !== 0 && isFinite(rr.dist[c.i]));
console.log('heavy send', E.command('me', { type: 'send', src: src.i, dst: dst.i, pct: 0.5, kind: 'heavy' }), 'kind', E.S.convoys.at(-1).kind, 'cp left', pl.cp.toFixed(1));
const sv = JSON.parse(JSON.stringify(E.save())); const B = createEngine(NET); B.load(sv); console.log('save/load fleets', B.S.fleets.length);
const snap = E.snapshot(0); const M = createEngine(NET); M.applySnapshot(snap); console.log('mirror fleets', M.S.fleets.length);
