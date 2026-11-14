import fs from 'fs';
import { createEngine } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const E = createEngine(NET), S = E.S;
const p = E.addPlayer('secret-id', 0);
const kinds = {}; E.onEvent(ev => { kinds[ev.k] = (kinds[ev.k] || 0) + 1; if (JSON.stringify(ev).includes('secret-id')) console.log('LEAK', ev); });
for (let k = 0; k < 3000; k++) E.step(0.1);
const snap = E.snapshot(0);
const hidden = snap.troops.filter(x => x === -1).length;
console.log('fog: hidden enemy garrisons', hidden, 'of', snap.owner.filter(o => o === 1).length, '| storms now', snap.storms.length, '| stormy sea edges', E.edges.filter(e => e.storm).length);
console.log('cpMax', E.cpMax(0), 'nation capitals held', E.ncapsHeld(0), E.ncapsHeld(1));
// blockade: find an enemy port linked by sea to us
const port = E.cities.find(c => E.canBlockade(0, c.i));
p.cp = 20;
console.log('blockade', port && port.name, port && E.command('secret-id', { type: 'blockade', city: port.i }));
if (port) { const seaOpen = E.adj[port.i].filter(x => x.e.type === 1).map(x => E.edgeOpen(x.e, 1)); console.log('sea routes open for owner', seaOpen); }
// commander: capture something as the player
let took = null;
for (const c of E.cities) { if (S.owner[c.i] !== 0 || S.troops[c.i] < 30) continue; const r = E.routeFrom(c.i, 0); const t = E.cities.find(x => S.owner[x.i] !== 0 && isFinite(r.dist[x.i]) && E.defOf(x.i) < S.troops[c.i] * 0.9); if (t) { E.command('secret-id', { type: 'send', src: c.i, dst: t.i, pct: 1 }); took = t; break; } }
for (let k = 0; k < 400; k++) E.step(0.1);
console.log('commander of', took && took.name, '=', took && S.cmdr[took.i] === 'secret-id', 'active', took && E.cmdrActive(took.i));
const snap2 = E.snapshot(0); console.log('snapshot leaks secret id:', JSON.stringify(snap2).includes('secret-id'), 'cmdr entries', snap2.cmdr.length);
while (!S.ended) E.step(0.1);
console.log('events', kinds, 'final', E.scores().pts);
