import fs from 'fs';
import { createEngine } from '../game/engine.js';
const NET = JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url), 'utf8').replace(/^window\.NET=/, '').replace(/;\s*$/, ''));
const n = +process.argv[2] || 16; let wa = 0; const m = [];
for (let r = 0; r < n; r++) { const E = createEngine(NET); while (!E.S.ended) E.step(0.1); const p = E.scores().pts; if (p[0] > p[1]) wa++; m.push(p[0] - p[1]); }
console.log(`Atlantica wins ${wa}/${n}; margins ${m.join(',')}`);
