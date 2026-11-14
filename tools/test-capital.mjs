// Capital victory: hold the enemy capital for K.CAP_HOLD and the season ends with your win;
// lose it before the clock runs out and the countdown stops.
import fs from 'fs';
import { createEngine, K } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

{ // held to the end: Atlantica wins early
  const E = createEngine(NET), S = E.S, ev = []; E.onEvent(e => ev.push(e));
  while (S.simT < 100) E.step(0.1);
  const cap = E.CAPS[1]; S.owner[cap] = 0; S.troops[cap] = 5000;
  const before = E.scores().pts[0]; E.step(0.1);
  ok(ev.some(e => e.k === 'cap_hold' && e.f === 0 && e.city === cap), 'countdown starts when Shanghai falls');
  ok(E.scores().pts[0] - before >= K.CAP_PTS - 1, `holder gets about +${K.CAP_PTS} points`);
  ok(S.orders[1] === cap, 'Pacifica bots rally to retake their capital');
  E.bots = [0, 0]; // no HQ on the losing side: nobody moves the government, the clock runs at full speed
  const t0 = S.simT; while (!S.ended) { S.owner[cap] = 0; S.troops[cap] = 5000; E.step(0.1); }
  const end = ev.find(e => e.k === 'end');
  ok(end && end.winner === 0 && end.capital === cap, 'season ends with an Atlantica win by capital');
  ok(Math.abs(S.simT - t0 - K.CAP_HOLD) < 1, `it took ${(S.simT - t0).toFixed(1)} sim-s (CAP_HOLD ${K.CAP_HOLD})`);
}
{ // retaken in time: the clock stops, the season goes on
  const E = createEngine(NET), S = E.S, ev = []; E.onEvent(e => ev.push(e));
  while (S.simT < 100) E.step(0.1);
  const cap = E.CAPS[0]; S.owner[cap] = 1; S.troops[cap] = 50; E.step(0.1);
  ok(!!S.capHold[0], 'Toronto falls: countdown running');
  S.owner[cap] = 0; S.troops[cap] = 100; E.step(0.1);
  ok(!S.capHold[0] && ev.some(e => e.k === 'cap_freed' && e.city === cap), 'retaken: countdown stops');
  while (S.simT < 100 + K.CAP_HOLD + 5 && !S.ended) E.step(0.1);
  ok(!ev.some(e => e.k === 'end' && e.capital >= 0), 'no capital victory after the retake');
  const E2 = createEngine(NET); S.owner[cap] = 1; E.step(0.1); const s2 = E.save(); ok(E2.load(s2) && E2.S.capHold[0] && E2.S.capHold[0].by === 1, 'countdown survives save and load');
}
{ // with bots, HQ moves the government and the clock slows down
  const E = createEngine(NET), S = E.S; while (S.simT < 100) E.step(0.1);
  const cap = E.CAPS[1]; S.owner[cap] = 0; S.troops[cap] = 5000; E.step(0.1); const until0 = S.capHold[1].until;
  while (S.simT < 100 + 15) { S.owner[cap] = 0; S.troops[cap] = 5000; E.step(0.1); }
  ok(S.exile[1] >= 0 && S.capHold[1].until > until0 + 20, `HQ moved Pacifica's government to ${E.cities[S.exile[1]].name}, the countdown slowed`);
}
if (fail) process.exit(1);
