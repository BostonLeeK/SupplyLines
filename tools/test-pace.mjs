// How fast does the world change? Captures and points after the first ~2 real minutes (100 sim-s) and at the end.
// usage: node tools/test-pace.mjs [bots] [botRate] [neutralMult]
import fs from 'fs'; import { createEngine, K } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const bots = +process.argv[2] || 120, runs = 12;
if (process.argv[3]) K.BOT_RATE = +process.argv[3];
if (process.argv[4]) K.NEUTRAL = K.NEUTRAL.map(x => x * +process.argv[4]);
let caps = 0, early = 0, earlyPts = 0, taken = 0, launch = 0, winters = 0, wa = 0, wb = 0;
for (let r = 0; r < runs; r++) {
  const E = createEngine(NET); E.bots = [bots, bots]; let c = 0, c1 = 0;
  E.onEvent(ev => { if (ev.k === 'capture') { c++; if (E.S.simT < 100) c1++; } if (ev.k === 'nuke_launch') launch++; if (ev.k === 'end' && ev.winter) winters++; });
  while (!E.S.ended) { E.step(0.1); if (Math.abs(E.S.simT - 100) < 0.05) { const p = E.scores().pts; earlyPts += p[0] + p[1]; } }
  const sc = E.scores(); caps += c; early += c1; taken += sc.cities[0] + sc.cities[1];
  if (!E.S.winter) { if (sc.pts[0] > sc.pts[1]) wa++; else wb++; }
}
console.log({ bots, botRate: K.BOT_RATE, neutral: K.NEUTRAL.join('/'), capturesFirst100s: Math.round(early / runs), pointsAt100s: Math.round(earlyPts / runs), captures: Math.round(caps / runs), citiesHeldAtEnd: Math.round(taken / runs), launches: (launch / runs).toFixed(1), wins: `${wa}:${wb}` });
