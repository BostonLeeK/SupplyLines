import fs from 'fs'; import { createEngine, GEVENTS } from '../game/engine.js';
const NET=JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url),'utf8').replace(/^window\.NET=/,'').replace(/;\s*$/,''));
let wa=0, wb=0, winters=0; const seen={};
for (let r=0;r<16;r++){ const E=createEngine(NET); E.onEvent(ev=>{ if(ev.k==='gevent') seen[ev.ev]=(seen[ev.ev]||0)+1; if(ev.k==='end'&&ev.winter) winters++; }); while(!E.S.ended) E.step(0.1); const p=E.scores().pts; if(!E.S.winter){ if(p[0]>p[1]) wa++; else wb++; } }
console.log({wa, wb, winters, seen});
const E=createEngine(NET); E.S.simT=130; E.step(0.1); console.log('day2 event', E.S.gev, 'snap', !!E.snapshot(0).gev);
const sv=JSON.parse(JSON.stringify(E.save())); const B=createEngine(NET); B.load(sv); console.log('load', B.S.gev && B.S.gev.k, B.ge(B.S.gev.k));
