// Laptop-size screens (~1360×750): the left column ran into the feed, the ability bar into the corner buttons,
// and long toasts were cut at the screen edge.
const fs = require('fs'), F = __dirname + '/../index.html'; let s = fs.readFileSync(F, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 60)); s = s.replace(a, b); };
// collapsible panels: click a caption to fold it; regions start folded on short screens
rep('<div id="regions"><div class="cap" style="margin-bottom:8px">Regions <b id="rgCount"></b></div>', '<div id="regions"><div class="cap fold" style="margin-bottom:8px">Regions <b id="rgCount"></b></div>');
rep('<div id="missions"><div class="cap">Season missions', '<div id="missions"><div class="cap fold">Season missions');
rep('#regions{background:var(--plate);', `#leftcol{max-height:calc(100vh - 32px);overflow-y:auto;scrollbar-width:none}
#leftcol::-webkit-scrollbar{display:none}
.cap.fold{cursor:pointer;user-select:none}
.cap.fold::after{content:'▾';margin-left:6px;color:var(--faint);font-size:10px}
.folded .cap.fold::after{content:'▸'}
.folded>*:not(.cap){display:none!important}
.folded .cap{margin-bottom:0!important}
#regions{background:var(--plate);`);
// layout for laptop screens
rep('@media (max-width:1100px){ #leftcol{display:none}', `@media (max-width:1500px){
  #bottom{width:min(1120px,calc(100% - 600px))}
  .ab .lb{display:none} .ab{padding:6px 2px;gap:3px} .ab svg{width:19px;height:19px}
}
@media (max-height:860px){
  #feed .ev:nth-child(n+4){display:none}
  #gen,#squad,#missions,#regions{padding:8px 10px}
  #genTools .mk{padding:5px 4px}
}
@media (max-width:1100px){ #leftcol{display:none}`);
rep("function missionsHud() {\n  genHud(); squadHud();", `let foldInit = false;
function initFolds() {
  if (foldInit) return; foldInit = true;
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('sl-folds') || '{}'); } catch (e) {}
  for (const id of ['regions', 'missions']) {
    const box = $(id); if (!box) continue;
    const folded = id in saved ? saved[id] : (id === 'regions' && innerHeight < 900);
    box.classList.toggle('folded', folded);
    box.querySelector('.cap.fold').addEventListener('click', e => { if (e.target.closest('button')) return; box.classList.toggle('folded'); saved[id] = box.classList.contains('folded'); try { localStorage.setItem('sl-folds', JSON.stringify(saved)); } catch (e2) {} });
  }
}
function missionsHud() {
  initFolds(); genHud(); squadHud();`);
// toasts never leave the screen
rep("  document.body.appendChild(d); setTimeout(() => d.remove(), 2500);\n  if (kind === 'bad')", "  document.body.appendChild(d); { const w = d.offsetWidth / 2 + 10; d.style.left = Math.max(w, Math.min(innerWidth - w, parseFloat(d.style.left))) + 'px'; } setTimeout(() => d.remove(), 2500);\n  if (kind === 'bad')");
fs.writeFileSync(F, s); console.log('small screens patched');
