import fs from 'fs'; import { createEngine } from '../game/engine.js';
const NET=JSON.parse(fs.readFileSync(new URL('../net.js', import.meta.url),'utf8').replace(/^window\.NET=/,'').replace(/;\s*$/,''));
let wa=0, wb=0, winters=0, allies=[0,0], betray=0, envoys=0;
for (let r=0;r<16;r++){ const E=createEngine(NET); E.onEvent(ev=>{ if(ev.k==='ally') allies[ev.f]++; if(ev.k==='betray') betray++; if(ev.k==='envoy') envoys++; if(ev.k==='end'&&ev.winter) winters++; }); while(!E.S.ended) E.step(0.1); const p=E.scores().pts; if(!E.S.winter){ if(p[0]>p[1]) wa++; else wb++; } }
console.log({wa, wb, winters, allies, betray, envoys});
