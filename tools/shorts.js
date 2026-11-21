// Supply Lines shorts director: vertical 1080×1920 videos for TikTok / Reels / Shorts, filmed from the game to a voice timeline.
// The timeline comes from tools/shorts-voice.mjs (beats, scenes, every word with its time); captions follow the words.
// From the browser console on /?offline=1&lang=en (or uk), after pressing PLAY once, with tools/trailer-server.mjs running:
//   const S = await import('http://127.0.0.1:5199/shorts.js');
//   await S.preview('capital', 'en')                          // real time, nothing saved: check the look
//   await S.run('capital', 'en')                              // frame by frame into media/short-capital-en-video.mp4
//   (reload, PLAY) await S.audio('capital', 'en')             // the game's sounds and the music bed, for the mux step
// then: node tools/shorts-mux.mjs capital en
const BASE = 'http://127.0.0.1:5199';
const g = window.__g, E = g.E, V = g.camera.position.constructor;
const W = 1080, H = 1920, FONT = '"IBM Plex Sans Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';
const city = n => g.cities.find(c => c.name === n);
const unit = v => v.clone().normalize();
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const S = () => E.S, me = () => g.me, foe = () => 1 - g.me;
const FCOL = ['#4aa3ff', '#ffad33'], GOLD = '#ffc23d', GOOD = '#5be08a', BAD = '#ff6b5b';
let LANG = 'en';
const nm = n => LANG === 'uk' && window.slLang ? slLang.tr(n) : n;
const T_ = (en, uk) => LANG === 'uk' ? uk : en;

// ---------- canvas and camera ----------
let out, ctx;
function setupCanvas() {
  if (out) return;
  out = document.createElement('canvas'); out.width = W; out.height = H; ctx = out.getContext('2d');
  Object.assign(out.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'contain', background: '#000', zIndex: 99999 });
  document.body.appendChild(out);
  g.renderer.setPixelRatio(1); g.renderer.setSize(W, H, false); g.camera.aspect = W / H; g.camera.updateProjectionMatrix();
  g.controls.enabled = false;
}
let shot = null;
function cam(from, to, d0, d1, t0, t1, tilt = 0.12) { shot = { from: unit(from), to: unit(to), d0, d1, t0, t1, tilt }; }
function applyCam(T) {
  if (!shot) return; const k = ease((T - shot.t0) / Math.max(0.01, shot.t1 - shot.t0));
  const a = shot.from, b = shot.to, om = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const d = om < 1e-4 ? a.clone() : a.clone().multiplyScalar(Math.sin((1 - k) * om) / Math.sin(om)).add(b.clone().multiplyScalar(Math.sin(k * om) / Math.sin(om)));
  d.normalize(); const p = d.clone().add(new V(0, shot.tilt, 0)).normalize().multiplyScalar(lerp(shot.d0, shot.d1, k));
  g.camera.position.copy(p); g.camera.up.set(0, 1, 0); g.camera.lookAt(0, 0, 0);
}
const project = v => { const p = v.clone().project(g.camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z < 1]; };

// ---------- drawing helpers ----------
function text(str, x, y, size, color = '#f2f5f9', opt = {}) {
  ctx.save(); ctx.font = `${opt.weight || 700} ${size}px ${FONT}`; ctx.textAlign = opt.align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (opt.spacing) ctx.letterSpacing = opt.spacing + 'px';
  if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
  if (!opt.bare) { ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 22; ctx.lineWidth = Math.max(5, size * 0.09); ctx.strokeStyle = 'rgba(2,4,8,.9)'; ctx.strokeText(str, x, y); ctx.shadowBlur = 0; }
  ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
}
function pill(x, y, label, color, size = 30) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const w = ctx.measureText(label).width + size * 1.1, h = size * 1.6;
  ctx.fillStyle = 'rgba(8,12,18,.88)'; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 1); ctx.restore();
}
function drawLabels(alpha) {
  if (alpha <= 0) return; const camDir = unit(g.camera.position), s = S(), dist = g.camera.position.length();
  ctx.save(); ctx.globalAlpha = alpha; ctx.textBaseline = 'middle';
  for (const c of g.cities) {
    if (c.tier < 2 && c.cap < 0) continue; if (unit(c.v).dot(camDir) < (dist > 2.4 ? 0.6 : 0.45)) continue; if (s.rad && s.rad[c.i]) continue;
    const [x, y] = project(c.v); if (x < 20 || x > W - 20 || y < 140 || y > H - 140) continue;
    const o = s.owner[c.i], col = o >= 0 ? FCOL[o] : '#8a95a3', tr = Math.floor(s.troops[c.i]), big = c.tier === 3 || c.cap >= 0;
    ctx.font = `700 ${big ? 30 : 25}px ${FONT}`; const tw = ctx.measureText(String(tr)).width, bx = x + 14, bw = tw + 20, bh = big ? 42 : 36;
    ctx.fillStyle = 'rgba(8,12,18,.86)'; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(bx, y - bh / 2, bw, bh, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e9eef5'; ctx.fillText(String(tr), bx + 10, y + 1);
    if (big || dist < 1.9) { ctx.font = `600 ${big ? 30 : 24}px ${FONT}`; ctx.fillStyle = 'rgba(233,238,245,.94)'; ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 8; ctx.fillText((c.cap >= 0 ? '★ ' : '') + nm(c.name), bx + bw + 10, y + 1); ctx.shadowBlur = 0; }
  }
  ctx.restore();
}

// ---------- captions: the line being spoken, a few words at a time, the current word lit ----------
function chunks(words) {
  const out = []; let cur = [];
  for (const w of words) { cur.push(w); const len = cur.map(x => x[0]).join(' ').length; if (cur.length >= 3 || len >= 16 || /[.,;:!?—]$/.test(w[0])) { out.push(cur); cur = []; } }
  if (cur.length) out.push(cur); return out;
}
function drawCaptions(T, tl) {
  const b = tl.beats.find(x => T >= x.t0 && T < x.t1); if (!b || !b.words.length) return;
  const groups = chunks(b.words); let gi = groups.findIndex(gr => T < gr[gr.length - 1][2] + 0.25); if (gi < 0) { if (T > b.words[b.words.length - 1][2] + 0.6) return; gi = groups.length - 1; }
  const gr = groups[gi]; if (T < gr[0][1] - 0.15) return;
  const size = 82, y = H * 0.64; ctx.save(); ctx.font = `800 ${size}px ${FONT}`;
  const parts = gr.map(w => w[0].toUpperCase()), sp = ctx.measureText(' ').width, widths = parts.map(p => ctx.measureText(p).width), total = widths.reduce((a, c) => a + c, 0) + sp * (parts.length - 1);
  let x = W / 2 - total / 2; const pop = 1 + 0.06 * Math.max(0, 1 - (T - gr[0][1]) / 0.12);
  ctx.translate(W / 2, y); ctx.scale(pop, pop); ctx.translate(-W / 2, -y);
  ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  parts.forEach((p, k) => { const w = gr[k], live = T >= w[1] - 0.04 && T < w[2] + 0.12, said = T >= w[1] - 0.04;
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(2,4,8,.92)'; ctx.strokeText(p, x, y);
    ctx.fillStyle = live ? GOLD : said ? '#f2f5f9' : 'rgba(242,245,249,.55)'; ctx.fillText(p, x, y); x += widths[k] + sp; });
  ctx.restore();
}
function drawHook(T, b) {
  if (!b.hook) return; const a = Math.min(1, (T - b.t0) / 0.25, (b.t1 - T) / 0.35); if (a <= 0) return;
  const lines = b.hook.split('\n'), size = lines.some(l => l.length > 16) ? 92 : 112, y0 = H * 0.2 - (lines.length - 1) * size * 0.55;
  ctx.save(); ctx.globalAlpha = a * 0.85; const gb = ctx.createLinearGradient(0, 0, 0, H * 0.4); gb.addColorStop(0, 'rgba(0,0,0,.85)'); gb.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gb; ctx.fillRect(0, 0, W, H * 0.4); ctx.restore();
  const rise = (1 - ease((T - b.t0) / 0.4)) * 30;
  lines.forEach((l, k) => text(l, W / 2, y0 + k * size * 1.1 + rise, size, k === lines.length - 1 ? GOLD : '#f2f5f9', { alpha: a, spacing: 2, weight: 800 }));
}

// ---------- world helpers ----------
function fillCp() { const p = E.players.get('me'); if (p) p.cp = 99; }
const caps = [];
function hotspot(exclude = [], minKm = 0) {
  const s = S(), recent = caps.filter(c => c.t > s.simT - 160); let best = null, bv = -1;
  for (const r of recent) { const c = g.cities[r.i]; if (exclude.some(x => E.kmBetween(x.i, c.i) < minKm)) continue; const v = recent.filter(o => E.kmBetween(o.i, c.i) < 1500).length + c.tier * 0.5; if (v > bv) { bv = v; best = c; } }
  return best || city('Berlin');
}
const nearest = (c, ok) => g.cities.filter(x => ok(x)).sort((a, b) => E.kmBetween(a.i, c.i) - E.kmBetween(b.i, c.i))[0];
function enemyAct(cmd) { if (!E.players.get('shorts-foe')) E.addPlayer('shorts-foe', foe(), 'HQ'); const p = E.players.get('shorts-foe'); p.f = foe(); p.cp = 99; return E.command('shorts-foe', cmd); }
function attackFrom(center, kmMax = 1600) {
  const mine = g.cities.filter(c => S().owner[c.i] === me() && E.kmBetween(c.i, center.i) < kmMax).sort((a, b) => S().troops[b.i] - S().troops[a.i]).slice(0, 4);
  for (const m of mine) { const t = nearest(m, x => S().owner[x.i] !== me() && E.kmBetween(x.i, m.i) < 1500 && !S().rad[x.i]); if (t) { S().troops[m.i] = Math.max(S().troops[m.i], 90); g.act({ type: 'send', src: m.i, dst: t.i, pct: 0.9, kind: 'heavy' }, {}); } }
}
let missiles = [];
function launchMissile(from, target, t0, dur) { const s = S(), m = { id: 910000 + target, f: s.owner[from], from, target, t: 0, extra: 0, km: E.kmBetween(from, target), by: 'HQ', _t0: t0, _dur: dur }; s.missiles = (s.missiles || []).concat(m); missiles.push(m); }
const clockOf = left => { const gm = Math.max(0, left * E.K.GMIN); return `${Math.floor(gm / 60)}:${String(Math.floor(gm % 60)).padStart(2, '0')}`; };

// ---------- scenes: start(b) once at the beat, draw(T, b) every frame ----------
const ctxS = {};
const SCENES = {
  hook: { start(b) { const h = hotspot(), c = unit(h.v); cam(c.clone().add(new V(0.25, 0.3, 0)), c, 4.2, 2.3, b.t0, b.t1, 0.08); g.setSpeed(2); ctxS.label = 0.6; } },
  front: { start(b) { const h = ctxS.decoyTarget ? hotspot([ctxS.decoyTarget], 900) : hotspot(), c = unit(h.v); cam(c, c.clone().add(new V(0.04, 0.02, 0.03)), 1.8, 1.6, b.t0, b.t1, 0); g.setSpeed(4); attackFrom(h); ctxS.label = 1; } },
  timelapse: { start(b) { const from = ctxS.lapse ? unit(g.camera.position) : unit(city('Toronto').v).add(unit(city('London').v)).normalize(), to = ctxS.lapse === 1 ? unit(city('Shanghai').v) : unit(city('Cairo').v);
      cam(from, to, ctxS.lapse ? 3.3 : 3.9, 3.3, b.t0, b.t1, 0.18); ctxS.lapse = (ctxS.lapse || 0) + 1; g.setSpeed(24); ctxS.label = 0; ctxS.score = 1; ctxS.day = 1; } },
  capital_fall: { start(b) { const c = g.cities[E.CAPS[foe()]]; ctxS.cap = c; const u = unit(c.v); cam(u.clone().add(new V(0.1, 0.12, 0)), u, 2.6, 1.75, b.t0, b.t0 + 1.6, 0.05); g.setSpeed(1); ctxS.label = 1; ctxS.capAt = b.t0 + 1.4; } ,
    draw(T) { if (ctxS.capAt && T >= ctxS.capAt) { ctxS.capAt = 0; const c = ctxS.cap, s = S(); s.owner[c.i] = me(); s.troops[c.i] = 260; g.blast(c.i, me(), true); g.sparks(c.i, me(), 14); g.sfx('win'); } } },
  capital_clock: { start(b) { const h = S().capHold && S().capHold[foe()]; if (h) h.at = 1e9; // HQ must not move the government before the voice says so
      const u = unit(ctxS.cap.v); cam(unit(g.camera.position), u, g.camera.position.length(), 1.65, b.t0, b.t1, 0.03); g.setSpeed(5); ctxS.clock = 1; } },
  capital_exile: { start(b) { const s = S(), f = foe(), h = s.capHold && s.capHold[f], to = E.exileCity(f);
      if (h && to >= 0) { s.exile[f] = to; h.until = s.simT + (h.until - s.simT) * E.K.EXILE_SLOW; ctxS.exile = g.cities[to]; g.sparks(to, f, 10); g.sfx('fort'); }
      const u = unit((ctxS.exile || ctxS.cap).v); cam(unit(g.camera.position), u, g.camera.position.length(), 2.0, b.t0, b.t0 + 1.8, 0.05); g.setSpeed(3); ctxS.clock = 1; } },
  decoy: { start(b) { const h = hotspot(), a = nearest(h, x => S().owner[x.i] === me() && E.adj[x.i].some(y => S().owner[y.to] === foe() && y.e.type === 0));
      const t = a && E.adj[a.i].find(y => S().owner[y.to] === foe() && y.e.type === 0); if (!a || !t) return;
      S().troops[a.i] = Math.max(S().troops[a.i], 80); ctxS.decoySrc = a; ctxS.decoyTarget = g.cities[t.to]; g.act({ type: 'send', src: a.i, dst: t.to, pct: 0.5, kind: 'decoy' }, {});
      ctxS.decoy = S().convoys.filter(c => c.kind === 'decoy' && c.f === me()).pop(); const m = unit(a.v).add(unit(g.cities[t.to].v)).normalize(); cam(m.clone().add(new V(0.05, 0.08, 0)), m, 2.2, 1.6, b.t0, b.t0 + 1.5, 0); g.setSpeed(1); ctxS.label = 1; } },
  decoy_follow: { start(b) { const t = ctxS.decoyTarget; if (!t) return; g.setSpeed(2);
      const helpers = g.cities.filter(c => S().owner[c.i] === foe() && c.i !== t.i && E.kmBetween(c.i, t.i) < 1400).sort((a, c) => S().troops[c.i] - S().troops[a.i]).slice(0, 3);
      for (const hcity of helpers) enemyAct({ type: 'send', src: hcity.i, dst: t.i, pct: 0.8, kind: 'std' }); ctxS.reserves = helpers; } },
  cipher: { start(b) { const h = hotspot(), c = unit(h.v); cam(c, c.clone().add(new V(0.02, 0.01, 0.02)), 2.4, 2.2, b.t0, b.t1, 0.05); g.setSpeed(1); ctxS.label = 0.4; ctxS.term = { from: b.t0, rows: 0 }; } },
  cipher_wait: { start(b) { ctxS.term = { ...ctxS.term, wait: b.t0 }; } },
  decrypt: { start(b) { ctxS.term = { ...ctxS.term, solved: b.t0 }; S().decrypt = (S().decrypt || []).concat({ f: me(), until: S().simT + 80, by: 'HQ' }); const h = hotspot(), c = unit(h.v); cam(unit(g.camera.position), c, g.camera.position.length(), 1.8, b.t0 + 1, b.t1, 0.03); g.setSpeed(3); ctxS.label = 1; } },
  nuke: { start(b) { const h = hotspot(), hubs = g.cities.filter(c => c.tier === 3 && S().owner[c.i] === foe() && !S().rad[c.i]), tgt = hubs.sort((a, c) => E.kmBetween(a.i, h.i) - E.kmBetween(c.i, h.i))[0] || h;
      const from = g.cities.filter(c => c.tier === 3 && S().owner[c.i] === me()).sort((a, c) => E.kmBetween(a.i, tgt.i) - E.kmBetween(c.i, tgt.i))[0];
      const mid = unit(tgt.v).add(unit((from || tgt).v)).normalize(); cam(mid.clone().add(new V(0, 0.15, 0)), unit(tgt.v), 3.0, 2.0, b.t0, b.t1, 0.1); g.setSpeed(0); g.raidOn && g.raidOn();
      if (from) launchMissile(from.i, tgt.i, b.t0 + 0.8, Math.max(2.5, (b.t1 - b.t0) * 0.6)); ctxS.label = 0.6; } },
  dark: { start(b) { ctxS.dark = { from: b.t0 }; g.setSpeed(0.5); if (g.raidOff) g.raidOff(1.5); } },
  outro: { start(b) { ctxS.outro = b.t0; g.setSpeed(1); const u = unit(g.camera.position); cam(u, u.clone().add(new V(0.06, 0, 0.04)), g.camera.position.length(), g.camera.position.length() + 0.6, b.t0, b.t1 + 1, 0.1); } },
};

// ---------- overlays that scenes switch on ----------
function drawTop(T, tl) {
  if (ctxS.score) { const p = E.scores().pts; text(`${p[0]}`, W / 2 - 60, 250, 64, FCOL[0], { align: 'right' }); text('—', W / 2, 250, 52, '#6b7787'); text(`${p[1]}`, W / 2 + 60, 250, 64, FCOL[1], { align: 'left' });
    const gm = S().simT * E.K.GMIN, d = Math.min(7, Math.floor(gm / 1440) + 1); text(T_(`DAY ${d} OF 7`, `ДЕНЬ ${d} З 7`), W / 2, 330, 40, '#c9d2dd', { spacing: 4 }); }
  const s = S();
  if (ctxS.clock && s.capHold) { const h = s.capHold[foe()]; if (h) { const c = g.cities[E.CAPS[foe()]], left = h.until - s.simT;
      pill(W / 2, 250, T_(`WE HOLD ${nm(c.name).toUpperCase()}`, `МИ ТРИМАЄМО ${nm(c.name).toUpperCase()}`), GOOD, 38);
      text(clockOf(left), W / 2, 380, 120, GOOD, { weight: 800 }); text(T_('UNTIL VICTORY', 'ДО ПЕРЕМОГИ'), W / 2, 470, 38, '#c9d2dd', { spacing: 6 });
      if (s.exile && s.exile[foe()] >= 0) pill(W / 2, 545, T_(`ENEMY GOVERNMENT → ${nm(g.cities[s.exile[foe()]].name).toUpperCase()} · CLOCK ×½`, `УРЯД ВОРОГА → ${nm(g.cities[s.exile[foe()]].name).toUpperCase()} · ГОДИННИК ×½`), GOLD, 28); } }
  // the decoy: what it really is, and what the enemy sees
  if (ctxS.decoy && ctxS.decoy.alive) { const cv = ctxS.decoy, e = cv.e, pts = e.pts; if (pts) { const u = Math.min(1, cv.fwd ? cv.t : 1 - cv.t), i0 = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1))), [x, y] = project(pts[i0]);
      pill(x, y - 95, T_('FAKE · 0 SOLDIERS', 'ФЕЙК · 0 СОЛДАТІВ'), GOLD, 30); pill(x, y + 95, T_(`ENEMY SEES: ${Math.round(cv.n)}`, `ВОРОГ БАЧИТЬ: ${Math.round(cv.n)}`), BAD, 30); } }
  if (ctxS.reserves && T < (tl.beats.find(b => b.scene === 'decoy_follow') || { t1: 0 }).t1) for (const r of ctxS.reserves) { const [x, y] = project(r.v); pill(x, y - 70, T_('RESERVES →', 'РЕЗЕРВИ →'), BAD, 26); }
}
function drawTerminal(T, tl) {
  const tm = ctxS.term; if (!tm) return; const cf = tl.cipher || { code: [7, 2, 9, 4], guesses: [] }, solved = tm.solved && T >= tm.solved;
  const a = solved ? Math.max(0, 1 - (T - tm.solved - 1.2) / 0.6) : Math.min(1, (T - tm.from) / 0.4); if (a <= 0) return;
  const x0 = 120, y0 = 470, w = W - 240, rowH = 120, rows = cf.guesses.length + 1, h = 170 + rows * rowH;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(2,10,6,.92)'; ctx.strokeStyle = '#3cff8f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 22); ctx.fill(); ctx.stroke();
  ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#3cff8f'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '4px'; ctx.fillText(T_('INTERCEPTED · ENEMY HQ', 'ПЕРЕХОПЛЕНО · ШТАБ ВОРОГА'), x0 + 40, y0 + 60);
  ctx.textAlign = 'right'; ctx.fillText(`${Math.min(cf.guesses.length, Math.floor((T - tm.from) / 1.6) + 1)}/6`, x0 + w - 40, y0 + 60); ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
  const shown = Math.min(cf.guesses.length, Math.max(0, Math.floor((T - tm.from) / 1.6) + 1)), cell = 130, gx = W / 2 - (cell * 4 - 20) / 2;
  const box = (k, r, d, st) => { const x = gx + k * cell, y = y0 + 120 + r * rowH; ctx.fillStyle = st === 'h' ? 'rgba(91,224,138,.9)' : st === 'n' ? 'rgba(255,194,61,.9)' : st === 'x' ? 'rgba(60,70,80,.9)' : 'rgba(20,40,30,.9)';
    ctx.beginPath(); ctx.roundRect(x, y, cell - 20, rowH - 20, 14); ctx.fill(); ctx.fillStyle = st === 'h' || st === 'n' ? '#06130b' : '#d6ffe7'; ctx.font = `800 64px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(d, x + (cell - 20) / 2, y + (rowH - 20) / 2 + 3); ctx.textAlign = 'left'; };
  for (let r = 0; r < shown; r++) cf.guesses[r].forEach((d, k) => box(k, r, String(d), cf.code[k] === d ? 'h' : cf.code.includes(d) ? 'n' : 'x'));
  if (tm.wait && T >= tm.wait) { const r = cf.guesses.length, blink = Math.floor(T * 2.5) % 2;
    cf.code.forEach((d, k) => { const known = cf.guesses.some(gs => gs[k] === d); box(k, r, solved ? String(d) : known ? String(d) : blink ? '?' : '', solved || known ? 'h' : ''); }); }
  if (solved) text(T_('DECRYPTED', 'РОЗШИФРОВАНО'), W / 2, y0 + h + 80, 72, GOOD, { spacing: 8, weight: 800 });
  ctx.restore();
}
function drawOutro(T) {
  if (!ctxS.outro) return; const a = Math.min(1, (T - ctxS.outro) / 0.5);
  ctx.save(); ctx.globalAlpha = a * 0.82; ctx.fillStyle = '#05080d'; ctx.fillRect(0, 0, W, H); ctx.restore();
  text('SUPPLY', W / 2, H * 0.36, 150, '#f2f5f9', { alpha: a, spacing: 10, weight: 800 }); text('LINES', W / 2, H * 0.36 + 150, 150, GOLD, { alpha: a, spacing: 10, weight: 800 });
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = FCOL[0]; ctx.fillRect(W / 2 - 260, H * 0.36 + 250, 260, 10); ctx.fillStyle = FCOL[1]; ctx.fillRect(W / 2, H * 0.36 + 250, 260, 10); ctx.restore();
  text(T_('FREE · IN YOUR BROWSER · NO SIGN-UP', 'БЕЗКОШТОВНО · У БРАУЗЕРІ · БЕЗ РЕЄСТРАЦІЇ'), W / 2, H * 0.36 + 330, 38, '#c9d2dd', { alpha: a, spacing: 3 });
  text('GLOBALWAR.XYZ', W / 2, H * 0.36 + 410, 64, '#f2f5f9', { alpha: a, spacing: 6, weight: 800 });
}
function drawDark(T, tl) {
  if (!ctxS.dark) return; const a = Math.min(0.9, (T - ctxS.dark.from) / 1.2);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const b = tl.beats.find(x => T >= x.t0 && T < x.t1 && x.big); if (b) { const k = Math.min(1, (T - b.t0) / 0.5); text(b.big, W / 2, H * 0.4, 150, GOLD, { alpha: k, weight: 800, spacing: 4 }); }
}

// ---------- one frame ----------
let flash = 0, shake = 0;
function frame(T, dt, tl) {
  fillCp();
  for (const b of tl.beats) if (T >= b.t0 && !b._on) { b._on = true; const sc = SCENES[b.scene]; if (sc) try { sc.start(b); } catch (e) { console.warn('scene', b.scene, e); } }
  for (const b of tl.beats) { const sc = SCENES[b.scene]; if (sc && sc.draw && T >= b.t0 && T < b.t1 + 2) sc.draw(T, b); }
  for (const m of missiles) { if (m._done) continue; m.t = Math.max(0, Math.min(1, (T - m._t0) / m._dur));
    if (m.t >= 1) { m._done = true; const s = S(), hit = E.blastCities(m.target); s.missiles = s.missiles.filter(x => x !== m); for (const i of hit) { s.rad[i] = 1; s.owner[i] = -1; s.troops[i] = 0; } g.nukeBlast(m.target, hit); g.paintOverlay(); flash = 0.7; shake = 1; } }
}
function render(T, dt, tl) {
  applyCam(T); flash = Math.max(0, flash - dt * 2.2);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.5); const a = 0.025 * shake; g.camera.position.add(new V((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a)); g.camera.lookAt(0, 0, 0); }
  g.renderer.render(g.scene, g.camera);
  ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.drawImage(g.renderer.domElement, 0, 0, W, H);
  drawLabels(ctxS.label || 0);
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (flash > 0) { ctx.globalAlpha = Math.min(1, flash); ctx.fillStyle = '#fff4dc'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawDark(T, tl); drawTop(T, tl); drawTerminal(T, tl);
  const b0 = tl.beats[0]; if (T >= b0.t0 - 0.35 && T < b0.t1) drawHook(Math.max(T, b0.t0), b0);
  drawOutro(T);
  drawCaptions(T, tl);
  if (!ctxS.outro) text('SUPPLY LINES', W - 60, H - 250, 30, 'rgba(233,238,245,.75)', { align: 'right', spacing: 6, bare: true });
  const fadeIn = T < 0.25 ? 1 - T / 0.25 : 0, fadeOut = T > tl.dur - 0.4 ? (T - (tl.dur - 0.4)) / 0.4 : 0;
  if (fadeIn || fadeOut) { ctx.globalAlpha = Math.min(1, fadeIn + fadeOut); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

// ---------- entry points ----------
async function prepare(id, lang, opt) {
  LANG = lang; const tl = await (await fetch(`${BASE}/shorts/${id}-${lang}/timeline.json`, { cache: 'no-store' })).json();
  await Promise.all(['800 112px', '700 82px', '600 30px'].flatMap(f => [document.fonts.load(f + ' "IBM Plex Sans Condensed"', 'ABC 123'), document.fonts.load(f + ' "Roboto Condensed"', 'АБВГҐДЄЇабвгґдєї')]));
  try { localStorage.setItem('sl-music', 'off'); } catch (e) {}
  setupCanvas(); fillCp(); for (const k of Object.keys(ctxS)) delete ctxS[k]; missiles = []; caps.length = 0;
  E.onEvent(ev => { if (ev.k === 'capture' && ev.city >= 0) caps.push({ i: ev.city, t: E.S.simT }); });
  while (S().simT < (opt.warm || 330)) E.step(0.1);
  g.select(-1); g.setMode('convoy');
  return tl;
}
// real time, nothing recorded: for checking the look
export async function preview(id, lang = 'en', opt = {}) {
  const tl = await prepare(id, lang, opt);
  await new Promise(resolve => { const t0 = performance.now(); let last = t0;
    const loop = now => { const T = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now; window.__shT = T;
      frame(T, dt, tl); render(T, dt, tl); if (T < tl.dur && !window.__shStop) requestAnimationFrame(loop); else resolve(); };
    requestAnimationFrame(loop); });
  return 'previewed ' + tl.dur.toFixed(1) + ' s';
}
// frame by frame into ffmpeg via the helper; every game sound is logged with its time for the audio pass
export async function run(id, lang = 'en', opt = {}) {
  const tl = await prepare(id, lang, opt), fps = opt.fps || 30, raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => (cb && cb.name === 'frame' ? 0 : raf(cb));
  const log = []; let curT = 0; window.__sfxLog = (k, a) => log.push([+curT.toFixed(3), k, a ?? null]);
  const name = `short-${id}-${lang}-video.mp4`, r0 = await fetch(`${BASE}/start?name=${name}&fps=${fps}`); if (!r0.ok) throw new Error('start: ' + await r0.text());
  const n = Math.round(tl.dur * fps);
  for (let f = 0; f < n; f++) {
    const T = f / fps; curT = T; frame(T, 1 / fps, tl); g.tick(1, 1 / fps); render(T, 1 / fps, tl);
    const bin = atob(out.toDataURL('image/jpeg', 0.93).split(',')[1]), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const rf = await fetch(BASE + '/frame', { method: 'POST', body: u8 }); if (!rf.ok) throw new Error('frame ' + f); window.__shFrame = f;
  }
  window.__sfxLog = null; try { localStorage.setItem(`sl-short-sounds-${id}-${lang}`, JSON.stringify(log)); } catch (e) {}
  return await (await fetch(BASE + '/end')).text() + ' · sounds ' + log.length;
}
// a quiet music bed: heartbeat kicks and a low pad that opens up; the voice sits on top of it in the mux step
function bed(ac, dest, t0, dur) {
  const at = s => t0 + s, out = ac.createGain(); out.gain.value = 0.7; out.connect(dest);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(240, at(0)); lp.frequency.linearRampToValueAtTime(1300, at(dur)); lp.connect(out);
  const pg = ac.createGain(); pg.gain.setValueAtTime(0, at(0)); pg.gain.linearRampToValueAtTime(0.06, at(1.5)); pg.gain.setValueAtTime(0.06, at(dur - 1)); pg.gain.linearRampToValueAtTime(0, at(dur)); pg.connect(lp);
  for (const [f, d] of [[55, 0], [55, 7], [82.4, -5]]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(pg); o.start(at(0)); o.stop(at(dur + 0.1)); }
  for (let s = 0.3; s < dur - 0.6; s += 0.55) { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(110, at(s)); o.frequency.exponentialRampToValueAtTime(40, at(s + 0.16)); gn.gain.setValueAtTime(0.32, at(s)); gn.gain.exponentialRampToValueAtTime(0.0001, at(s + 0.3)); o.connect(gn).connect(out); o.start(at(s)); o.stop(at(s + 0.32)); }
}
export async function audio(id, lang = 'en') {
  const ac = g.actx; if (!ac) throw new Error('press PLAY first'); if (ac.state !== 'running') await ac.resume();
  const tl = await (await fetch(`${BASE}/shorts/${id}-${lang}/timeline.json`, { cache: 'no-store' })).json();
  const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => (cb && cb.name === 'frame' ? 0 : raf(cb));
  const orig = AudioNode.prototype.connect, dest = ac.createMediaStreamDestination();
  if (!orig.__sh) { const p = function (d, ...r) { const x = orig.call(this, d, ...r); if (d instanceof AudioDestinationNode && window.__shRec && window.__shRec.context === this.context) orig.call(this, window.__shRec); return x; }; p.__sh = true; AudioNode.prototype.connect = p; }
  window.__shRec = dest;
  const log = JSON.parse(localStorage.getItem(`sl-short-sounds-${id}-${lang}`) || '[]');
  const mime = ['audio/webm;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)), rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 256e3 }), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.start(500); await new Promise(r => setTimeout(r, 300));
  const t0 = ac.currentTime + 1; bed(ac, ac.destination, t0, tl.dur);
  { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.value = 1000; gn.gain.value = 0; gn.gain.setValueAtTime(0.5, t0 - 0.5); gn.gain.setValueAtTime(0, t0 - 0.48); o.connect(gn).connect(ac.destination); o.start(t0 - 0.6); o.stop(t0 - 0.4); }
  const play = ([, k, a]) => { if (k === 'sfx') g.sfx(a); else if (k === 'boom') g.boom(); else if (k === 'raidOn') g.raidOn(); else if (k === 'raidOff') g.raidOff(a || 0); else if (k === 'siren') g.siren(); };
  await new Promise(resolve => { let i = 0; const ch = new MessageChannel(); ch.port1.onmessage = () => { const now = ac.currentTime - t0; while (i < log.length && log[i][0] <= now + 0.003) play(log[i++]); if (now > tl.dur + 0.5) { ch.port1.close(); return resolve(); } ch.port2.postMessage(0); }; ch.port2.postMessage(0); });
  await new Promise(r => { rec.onstop = r; rec.stop(); });
  const blob = new Blob(chunks, { type: rec.mimeType }), name = `short-${id}-${lang}-audio.webm`;
  return await (await fetch(`${BASE}/save?name=${name}`, { method: 'POST', body: blob })).text() + ' · sounds ' + log.length;
}
// one frame at second T of the short, for a quick look (scenes run from the start up to T)
export async function still(id, lang = 'en', at = 3, opt = {}) {
  const tl = await prepare(id, lang, opt), dt = 1 / 30;
  for (let T = 0; T < at; T += dt) { frame(T, dt, tl); g.tick(1, dt); applyCam(T); }
  render(at, dt, tl); return out;
}
