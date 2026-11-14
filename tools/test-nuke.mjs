import fs from 'fs';
import { createEngine } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
let stats = { ready: 0, launch: 0, hit: 0, intercept: 0, winter: 0, seasons: 0 }, wins = [0, 0];
for (let r = 0; r < 16; r++) {
  const E = createEngine(NET); const log = [];
  E.onEvent(ev => { if (ev.k.startsWith('nuke')) log.push(`${ev.k}@${E.S.simT.toFixed(0)} f${ev.f}${ev.target !== undefined ? ' ' + E.cities[ev.target].name : ''}${ev.cities ? ' x' + ev.cities.length : ''}`);
    if (ev.k === 'nuke_ready') stats.ready++; if (ev.k === 'nuke_launch') stats.launch++; if (ev.k === 'nuke_hit') stats.hit++; if (ev.k === 'nuke_intercept') stats.intercept++; if (ev.k === 'end' && ev.winter) stats.winter++; });
  while (!E.S.ended) E.step(0.1);
  stats.seasons++; const p = E.scores().pts; if (!E.S.winter) wins[p[0] > p[1] ? 0 : 1]++;
  if (r < 4) console.log('season', r, p, E.S.winter ? 'WINTER' : '', '|', log.join('; '));
}
console.log(stats, 'non-winter wins', wins);
// player flow
const E = createEngine(NET); const pl = E.addPlayer('me', 0); E.bots = [0, 0];
for (const h of E.cities.filter(c => c.tier === 3).slice(0, 4)) E.S.owner[h.i] = 0;
pl.cp = 200;
console.log('fund', E.command('me', { type: 'nuke_fund', amount: 130 }).ok, 'ready', E.S.nuke[0].ready);
const tgt = E.cities.find(c => E.nukeTargetOk(0, c.i));
console.log('arm', tgt && tgt.name, E.command('me', { type: 'nuke_arm', city: tgt.i }));
for (let k = 0; k < 200; k++) E.step(0.1);
console.log('missiles', E.S.missiles.length, 'strikes', E.S.strikes, 'penalty', E.S.penalty);
for (let k = 0; k < 400; k++) E.step(0.1);
console.log('rad cities', [...E.S.rad].filter(Boolean).length, 'save size', JSON.stringify(E.save()).length);
