// How busy is a season with N bots per faction? Captures, map control, launches, winners.
import fs from 'fs'; import { createEngine, K } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const bots = +process.argv[2] || 300, nukeRate = +process.argv[3] || K.NUKE_BOT_RATE, runs = 12;
K.NUKE_BOT_RATE = nukeRate;
let caps = 0, taken = 0, launch = 0, winters = 0, wa = 0, wb = 0, firstDay = 0;
for (let r = 0; r < runs; r++) {
  const E = createEngine(NET); E.bots = [bots, bots]; let c = 0, c1 = 0;
  E.onEvent(ev => { if (ev.k === 'capture') { c++; if (E.S.simT < K.SEASON / 7) c1++; } if (ev.k === 'nuke_launch') launch++; if (ev.k === 'end' && ev.winter) winters++; });
  while (!E.S.ended) E.step(0.1);
  const sc = E.scores(); caps += c; firstDay += c1; taken += sc.cities[0] + sc.cities[1];
  if (!E.S.winter) { if (sc.pts[0] > sc.pts[1]) wa++; else wb++; }
}
console.log({ bots, captures: Math.round(caps / runs), capturesDay1: Math.round(firstDay / runs), citiesHeldAtEnd: Math.round(taken / runs), launches: (launch / runs).toFixed(1), winters, wins: `${wa}:${wb}` });
