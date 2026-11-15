// Supply Lines trailer director (English, ~1:30). Runs inside the game page (offline mode) and records a 1920×1080
// video with the game's own sound plus a synthesized score. Usage, from the browser console on /?offline=1&lang=en,
// after pressing PLAY once (audio needs a click):
//   const T = await import('http://127.0.0.1:5199/trailer.js'); await T.run({ record: true, upload: 'http://127.0.0.1:5199/save' });
// tools/trailer-server.mjs serves this file and saves the upload to media/.
const g = window.__g, E = g.E, V = g.camera.position.constructor;
const W = 1920, H = 1080, FONT = '"IBM Plex Sans Condensed", "Arial Narrow", sans-serif';
const city = n => g.cities.find(c => c.name === n);
const unit = v => v.clone().normalize();
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const S = () => E.S;

// ---------- picture ----------
let out, ctx, overlayEl;
function setupCanvas() {
  out = document.createElement('canvas'); out.width = W; out.height = H; ctx = out.getContext('2d');
  overlayEl = out; Object.assign(out.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'contain', background: '#000', zIndex: 99999 });
  document.body.appendChild(out);
  g.renderer.setPixelRatio(1); g.renderer.setSize(W, H, false); g.camera.aspect = W / H; g.camera.updateProjectionMatrix();
  g.controls.enabled = false;
}

// camera shots: unit directions slerped, distance eased
let shot = null;
function cam(from, to, d0, d1, t0, t1, tilt = 0.18) { shot = { from: unit(from), to: unit(to), d0, d1, t0, t1, tilt }; }
function applyCam(T) {
  if (!shot) return; const k = ease((T - shot.t0) / (shot.t1 - shot.t0));
  const a = shot.from, b = shot.to, om = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  let d = om < 1e-4 ? a.clone() : a.clone().multiplyScalar(Math.sin((1 - k) * om) / Math.sin(om)).add(b.clone().multiplyScalar(Math.sin(k * om) / Math.sin(om)));
  d.normalize(); const up = new V(0, 1, 0), p = d.clone().add(up.multiplyScalar(shot.tilt)).normalize().multiplyScalar(lerp(shot.d0, shot.d1, k));
  g.camera.position.copy(p); g.camera.up.set(0, 1, 0); g.camera.lookAt(0, 0, 0);
}

// labels: name + troops for big cities facing the camera
const FCOL = ['#4aa3ff', '#ffad33'];
function drawLabels(alpha) {
  if (alpha <= 0) return; const camDir = unit(g.camera.position), s = S(), dist = g.camera.position.length();
  ctx.save(); ctx.globalAlpha = alpha; ctx.textBaseline = 'middle';
  for (const c of g.cities) {
    if (c.tier < 2 && c.cap < 0) continue; const n = unit(c.v); if (n.dot(camDir) < (dist > 2.2 ? 0.55 : 0.4)) continue;
    if (s.rad && s.rad[c.i]) continue;
    const p = c.v.clone().project(g.camera), x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H; if (x < 0 || x > W || y < 0 || y > H) continue;
    const o = s.owner[c.i], col = o >= 0 ? FCOL[o] : '#8a95a3', tr = Math.floor(s.troops[c.i]), big = c.tier === 3 || c.cap >= 0;
    ctx.font = `700 ${big ? 22 : 18}px ${FONT}`; const tw = ctx.measureText(String(tr)).width, bx = x + 12, bw = tw + 16, bh = big ? 30 : 26;
    ctx.fillStyle = 'rgba(8,12,18,.85)'; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, y - bh / 2, bw, bh, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e9eef5'; ctx.fillText(String(tr), bx + 8, y + 1);
    if (big || dist < 1.9) { ctx.font = `600 ${big ? 22 : 17}px ${FONT}`; ctx.fillStyle = 'rgba(233,238,245,.92)'; ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 8; ctx.fillText((c.cap >= 0 ? '★ ' : '') + nm(c.name), bx + bw + 8, y + 1); ctx.shadowBlur = 0; }
  }
  ctx.restore();
}

// titles: big centred lines that fade in and out
const titles = [];
const UK = {
  'TWO FACTIONS.': 'ДВІ ФРАКЦІЇ.', 'ONE PLANET.': 'ОДНА ПЛАНЕТА.', 'EVERY CITY RAISES TROOPS': 'КОЖНЕ МІСТО ДАЄ ВІЙСЬКА',
  'EVERY WAR RUNS ON\nSUPPLY LINES': 'КОЖНА ВІЙНА ТРИМАЄТЬСЯ\nНА ЛІНІЯХ ПОСТАЧАННЯ', 'SEND THE CONVOYS. BREAK THE FRONT.': 'ВІДПРАВЛЯЙ КОНВОЇ. ПРОРИВАЙ ФРОНТ.',
  'DRONES': 'ДРОНИ', 'ELECTRONIC WARFARE. BLACKOUTS.': 'РЕБ. БЛЕКАУТИ.', 'SATELLITES. AIRDROPS. FLEETS.': 'СУПУТНИКИ. ДЕСАНТИ. ФЛОТИ.',
  'SEVEN DAYS. ONE SEASON.': 'СІМ ДНІВ. ОДИН СЕЗОН.', 'TAKE THEIR CAPITAL.\nHOLD IT FOR 12 HOURS.': 'ВІЗЬМИ ЇХНЮ СТОЛИЦЮ.\nУТРИМАЙ ЇЇ 12 ГОДИН.',
  'OR BURN IT ALL.': 'АБО СПАЛИ ВСЕ.', 'NUCLEAR WINTER.': 'ЯДЕРНА ЗИМА.', 'Two strikes in one season. Everybody loses.': 'Два удари за сезон. Програють усі.',
  'This is a game.': 'Це гра.', 'In Ukraine, it is not.': 'В Україні — ні.', 'ARE YOU REALLY READY\nFOR A REAL WAR?': 'ВИ СПРАВДІ ГОТОВІ\nДО СПРАВЖНЬОЇ ВІЙНИ?',
  'SUPPLY LINES  ·  GLOBALWAR.XYZ  ·  FREE, IN YOUR BROWSER': 'SUPPLY LINES  ·  GLOBALWAR.XYZ  ·  БЕЗКОШТОВНО, У БРАУЗЕРІ',
  'ATLANTICA': 'АТЛАНТИКА', 'PACIFICA': 'ПАЦИФІКА',
};
let LANG = 'en';
const tx = t => LANG === 'uk' ? (UK[t] || t) : t;
const nm = n => LANG === 'uk' && window.slLang ? slLang.tr(n) : n;
function title(t0, t1, text, opt = {}) { titles.push({ t0, t1, text: tx(text), ...opt, sub: opt.sub && tx(opt.sub) }); }
function drawTitles(T) {
  for (const tt of titles) {
    if (T < tt.t0 || T > tt.t1) continue;
    const a = Math.min(1, (T - tt.t0) / 0.45, (tt.t1 - T) / 0.45), rise = (1 - ease((T - tt.t0) / 0.6)) * 14;
    const size = tt.size || 96, y = (tt.y ?? 0.5) * H + rise, lines = tt.text.split('\n');
    // a soft dark band behind the words, so they read over any part of the map
    const bandH = size * (lines.length * 1.08 + (tt.sub ? 0.9 : 0)) + size * 1.1, bandY = y + (tt.sub ? size * 0.3 : 0);
    if (!tt.bare) { ctx.save(); ctx.globalAlpha = a * 0.78; const gb = ctx.createLinearGradient(0, bandY - bandH / 2, 0, bandY + bandH / 2);
      gb.addColorStop(0, 'rgba(3,6,10,0)'); gb.addColorStop(0.3, 'rgba(3,6,10,.82)'); gb.addColorStop(0.7, 'rgba(3,6,10,.82)'); gb.addColorStop(1, 'rgba(3,6,10,0)');
      ctx.fillStyle = gb; ctx.fillRect(0, bandY - bandH / 2, W, bandH); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `700 ${size}px ${FONT}`;
    if (tt.spacing) ctx.letterSpacing = tt.spacing + 'px';
    lines.forEach((l, k) => { const ly = y + (k - (lines.length - 1) / 2) * size * 1.08;
      ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 24; ctx.lineWidth = Math.max(4, size * 0.07); ctx.strokeStyle = 'rgba(2,4,8,.85)'; ctx.strokeText(l, W / 2, ly);
      ctx.shadowBlur = 0; ctx.fillStyle = tt.color || '#f2f5f9'; ctx.fillText(l, W / 2, ly); });
    if (tt.sub) { ctx.font = `500 ${Math.round(size * 0.36)}px ${FONT}`; ctx.letterSpacing = '0px'; const sy = y + lines.length * size * 0.54 + size * 0.42; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(2,4,8,.85)'; ctx.strokeText(tt.sub, W / 2, sy); ctx.fillStyle = '#c9d2dd'; ctx.fillText(tt.sub, W / 2, sy); }
    ctx.restore();
  }
}
let fade = 0, scoreA = 0, labelA = 0, flash = 0, shake = 0;
function drawFrame(T) {
  ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(g.renderer.domElement, 0, 0, W, H);
  drawLabels(labelA);
  // vignette and letterbox
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 54); ctx.fillRect(0, H - 54, W, 54);
  if (scoreA > 0) { const p = E.scores().pts; ctx.save(); ctx.globalAlpha = scoreA; ctx.font = `700 34px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = FCOL[0]; ctx.fillText(tx('ATLANTICA') + '  ' + p[0], W / 2 - 24, 100); ctx.textAlign = 'left'; ctx.fillStyle = FCOL[1]; ctx.fillText(p[1] + '  ' + tx('PACIFICA'), W / 2 + 24, 100); ctx.fillStyle = '#6b7787'; ctx.textAlign = 'center'; ctx.fillText('—', W / 2, 100); ctx.restore(); }
  if (flash > 0) { ctx.globalAlpha = Math.min(1, flash); ctx.fillStyle = '#fff4dc'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawTitles(T);
  // corner mark while the game is on screen
  if (T > 1 && T < 82 && fade < 0.5) { ctx.save(); ctx.globalAlpha = 0.7; ctx.font = `700 22px ${FONT}`; ctx.letterSpacing = '4px'; ctx.fillStyle = '#e9eef5'; ctx.textAlign = 'right'; ctx.fillText('SUPPLY LINES', W - 60, H - 80); ctx.restore(); }
}

// ---------- sound ----------
let ac, master, recDest;
function patchAudio() {
  const orig = AudioNode.prototype.connect;
  if (orig.__sl) return;
  const patched = function (dst, ...rest) {
    const r = orig.call(this, dst, ...rest);
    if (dst instanceof AudioDestinationNode && window.__slRec && window.__slRec.context === this.context) orig.call(this, window.__slRec);
    return r;
  };
  patched.__sl = true; AudioNode.prototype.connect = patched;
}
function noiseBuf(len) { const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function score(t0) {
  // t0 = audio time of trailer second 0
  const at = s => t0 + s;
  master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
  const music = ac.createGain(); music.gain.value = 1; music.connect(master);
  // pad: two detuned saws, opening filter
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(260, at(0)); lp.frequency.linearRampToValueAtTime(900, at(56)); lp.frequency.linearRampToValueAtTime(2200, at(66)); lp.Q.value = 2;
  const pg = ac.createGain(); pg.gain.setValueAtTime(0, at(0)); pg.gain.linearRampToValueAtTime(0.07, at(4)); pg.gain.setValueAtTime(0.07, at(65.6)); pg.gain.linearRampToValueAtTime(0, at(66.1));
  lp.connect(pg).connect(music);
  for (const [f, det] of [[55, 0], [55, 7], [82.4, -5], [110, 3]]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(at(0)); o.stop(at(66.2)); }
  const kick = (s, v = 1) => { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(120, at(s)); o.frequency.exponentialRampToValueAtTime(38, at(s + 0.18)); gn.gain.setValueAtTime(0.5 * v, at(s)); gn.gain.exponentialRampToValueAtTime(0.0001, at(s + 0.35)); o.connect(gn).connect(music); o.start(at(s)); o.stop(at(s + 0.4)); };
  const hat = (s, v = 1) => { const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), gn = ac.createGain(); src.buffer = noiseBuf(0.06); hp.type = 'highpass'; hp.frequency.value = 7000; gn.gain.setValueAtTime(0.09 * v, at(s)); gn.gain.exponentialRampToValueAtTime(0.0001, at(s + 0.05)); src.connect(hp).connect(gn).connect(music); src.start(at(s)); };
  const bass = (s, f) => { const o = ac.createOscillator(), l = ac.createBiquadFilter(), gn = ac.createGain(); o.type = 'square'; o.frequency.value = f; l.type = 'lowpass'; l.frequency.value = 320; gn.gain.setValueAtTime(0.09, at(s)); gn.gain.exponentialRampToValueAtTime(0.0001, at(s + 0.22)); o.connect(l).connect(gn).connect(music); o.start(at(s)); o.stop(at(s + 0.25)); };
  const hit = (s, v = 1) => { kick(s, 1.4 * v); const src = ac.createBufferSource(), l = ac.createBiquadFilter(), gn = ac.createGain(); src.buffer = noiseBuf(2); l.type = 'lowpass'; l.frequency.setValueAtTime(2400, at(s)); l.frequency.exponentialRampToValueAtTime(90, at(s + 1.8)); gn.gain.setValueAtTime(0.28 * v, at(s)); gn.gain.exponentialRampToValueAtTime(0.0001, at(s + 1.9)); src.connect(l).connect(gn).connect(music); src.start(at(s)); };
  // heartbeat, then a beat that builds
  for (let s = 1; s < 15; s += 1.1) { kick(s, 0.55); kick(s + 0.22, 0.35); }
  for (let s = 15; s < 66; s += 0.5) kick(s, s < 25 ? 0.7 : 1);
  for (let s = 25; s < 66; s += 0.25) hat(s, (s * 4) % 2 ? 0.6 : 1);
  const notes = [55, 55, 65.4, 49];
  for (let s = 34; s < 66; s += 0.25) bass(s, notes[Math.floor((s - 34) / 2) % 4]);
  for (const s of [0.9, 7, 15, 25, 34, 46, 56]) hit(s, 0.9);
  // riser into the nuclear act
  { const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), gn = ac.createGain(); src.buffer = noiseBuf(5); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(300, at(61)); bp.frequency.exponentialRampToValueAtTime(6000, at(66)); gn.gain.setValueAtTime(0.0001, at(61)); gn.gain.exponentialRampToValueAtTime(0.25, at(65.9)); gn.gain.linearRampToValueAtTime(0, at(66.05)); src.connect(bp).connect(gn).connect(music); src.start(at(61)); }
  // the ending: a low drone and one last hit on the question
  { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.value = 41; gn.gain.setValueAtTime(0, at(82)); gn.gain.linearRampToValueAtTime(0.18, at(85)); gn.gain.linearRampToValueAtTime(0, at(91)); o.connect(gn).connect(master); o.start(at(82)); o.stop(at(91.5)); }
  hit(86.8, 1.1);
}

// ---------- world helpers ----------
const me = () => g.me, foe = () => 1 - g.me;
function fillCp() { const p = E.players.get('me'); if (p) p.cp = 99; }
function front() { const s = S(), fr = []; for (const c of g.cities) if (s.owner[c.i] === me() && E.touchesNet(foe(), c.i)) fr.push(c); return fr; }
function centroid(list) { const v = new V(); for (const c of list) v.add(unit(c.v)); return v.lengthSq() ? v.normalize() : unit(city('Berlin').v); }
// where the fighting is: the city with the most recent captures within 1,500 km (captures are logged during warm-up)
const caps = [];
function hotspot(exclude = [], minKm = 0) {
  const s = S(), recent = caps.filter(c => c.t > s.simT - 160);
  let best = null, bv = -1;
  for (const r of recent) { const c = g.cities[r.i]; if (exclude.some(x => E.kmBetween(x.i, c.i) < minKm)) continue; const v = recent.filter(o => E.kmBetween(o.i, c.i) < 1500).length + c.tier * 0.5; if (v > bv) { bv = v; best = c; } }
  return best || city('Berlin');
}
const nearest = (c, ok) => g.cities.filter(x => ok(x)).sort((a, b) => E.kmBetween(a.i, c.i) - E.kmBetween(b.i, c.i))[0];
function nightish(i) { return unit(g.cities[i].v).dot(g.sunDir()) < -0.25; }
function launchMissile(from, target, t0, dur) { const s = S(); const m = { id: 900000 + target, f: s.owner[from], from, target, t: 0, extra: 0, km: E.kmBetween(from, target), by: 'HQ', _t0: t0, _dur: dur }; s.missiles = (s.missiles || []).concat(m); return m; }

// ---------- the film ----------
export async function run(opt = {}) {
  ac = g.actx; if (!ac && opt.record) throw new Error('press PLAY first');
  if (ac) { if (ac.state !== 'running') await ac.resume(); patchAudio(); recDest = ac.createMediaStreamDestination(); window.__slRec = recDest; }
  try { localStorage.setItem('sl-music', 'off'); } catch (e) {}
  LANG = opt.lang || 'en';
  await Promise.all(['700 96px', '600 22px', '500 36px'].map(f => document.fonts.load(f + ' "IBM Plex Sans Condensed"', 'АБВГҐДЄЇабвгґдєї ABC')));
  setupCanvas();
  const s = S(); fillCp();
  // warm the war up to the middle of day 3 so the fronts are alive
  E.onEvent(ev => { if (ev.k === 'capture' && ev.city >= 0) caps.push({ i: ev.city, t: E.S.simT }); });
  while (s.simT < (opt.warm || 360)) E.step(0.1);   // 360: night falls over Asia right when the drone strike lands
  g.setSpeed(1); g.select(-1); g.setMode('convoy');

  // places
  const frB = hotspot(), frA = hotspot([frB], 1800);
  const atl = unit(city('Toronto').v).add(unit(city('London').v)).normalize();
  const eu = unit(city('Berlin').v), asia = unit(city('Shanghai').v);

  // titles
  title(1.0, 6.4, 'TWO FACTIONS.', { y: 0.44, size: 120, spacing: 6 });
  title(2.6, 6.4, 'ONE PLANET.', { y: 0.58, size: 120, spacing: 6, color: '#ffc23d' });
  title(8.0, 14.2, 'EVERY CITY RAISES TROOPS', { y: 0.8, size: 72, spacing: 4 });
  title(16.0, 24.2, 'EVERY WAR RUNS ON\nSUPPLY LINES', { y: 0.76, size: 78, spacing: 4 });
  title(26.0, 33.4, 'SEND THE CONVOYS. BREAK THE FRONT.', { y: 0.8, size: 70, spacing: 3 });
  title(35.0, 39.6, 'DRONES', { y: 0.8, size: 92, spacing: 10 });
  title(40.0, 45.6, 'ELECTRONIC WARFARE. BLACKOUTS.', { y: 0.8, size: 70, spacing: 3 });
  title(47.0, 55.4, 'SATELLITES. AIRDROPS. FLEETS.', { y: 0.8, size: 70, spacing: 3 });
  title(57.0, 60.8, 'SEVEN DAYS. ONE SEASON.', { y: 0.8, size: 78, spacing: 4 });
  title(61.0, 65.6, 'TAKE THEIR CAPITAL.\nHOLD IT FOR 12 HOURS.', { y: 0.76, size: 70, spacing: 3 });
  title(67.5, 72.4, 'OR BURN IT ALL.', { y: 0.5, size: 110, spacing: 8, color: '#ff6b5b' });
  title(78.6, 82.0, 'NUCLEAR WINTER.', { y: 0.45, size: 110, spacing: 8, sub: 'Two strikes in one season. Everybody loses.' });
  title(84.0, 91.0, 'This is a game.', { y: 0.36, size: 54 });
  title(85.4, 91.0, 'In Ukraine, it is not.', { y: 0.45, size: 54, color: '#ffc23d' });
  title(86.8, 91.0, 'ARE YOU REALLY READY\nFOR A REAL WAR?', { y: 0.62, size: 92, spacing: 3 });
  title(88.6, 91.0, 'SUPPLY LINES  ·  GLOBALWAR.XYZ  ·  FREE, IN YOUR BROWSER', { y: 0.86, size: 30, spacing: 4, color: '#9aa7b6' });

  // recorder
  let rec, chunks = [];
  if (opt.record) {
    const stream = new MediaStream([...out.captureStream(30).getVideoTracks(), ...recDest.stream.getAudioTracks()]);
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14e6, audioBitsPerSecond: 192e3 }); rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.start(1000);
  }
  if (ac && !opt.from && !opt.frames) score(ac.currentTime + 0.05);

  const fired = new Set(); const once = (k, T, at, fn) => { if (T >= at && !fired.has(k)) { fired.add(k); try { fn(); } catch (e) { console.warn('trailer', k, e); } } };
  let missiles = [], blackTarget = -1, satCity = -1, dropCv = null;
  // one frame of the film at trailer second T; advance() moves the game itself (frame-by-frame mode only)
  const step = (T, dt, advance) => {
      fillCp(); window.__trT = T;
      // ---- shots and beats ----
      once('s1', T, 0, () => { cam(atl, eu, 4.6, 3.3, 0, 7.2, 0.25); g.setSpeed(1); });
      once('s2', T, 7, () => { cam(eu, unit(city('Paris').v), 2.5, 1.75, 7, 15, 0.22); });
      once('s3', T, 15, () => { cam(unit(frA.v), unit(frB.v), 2.0, 1.75, 15, 25, 0.04); g.setSpeed(4); });
      once('s4', T, 25, () => { const hot = hotspot(), c = unit(hot.v); cam(c, c.clone().add(new V(0.05, 0.02, 0.04)), 1.62, 1.5, 25, 34, 0); g.setSpeed(6);
        // our strongest cities near the hotspot throw heavy convoys at their neighbours, and a saboteur goes in
        const mine = g.cities.filter(c2 => S().owner[c2.i] === me() && E.kmBetween(c2.i, hot.i) < 1600).sort((a, b) => S().troops[b.i] - S().troops[a.i]).slice(0, 4);
        for (const m of mine) { const tgt = nearest(m, x => S().owner[x.i] !== me() && E.kmBetween(x.i, m.i) < 1500 && !S().rad[x.i]); if (tgt) g.act({ type: 'send', src: m.i, dst: tgt.i, pct: 0.9, kind: 'heavy' }, {}); }
        const sab = nearest(hot, x => S().owner[x.i] === foe() && E.touchesNet(me(), x.i)); if (sab && E.kmBetween(sab.i, hot.i) < 2000) g.act({ type: 'sabotage', city: sab.i }, {}); });
      once('s5', T, 34, () => { g.setSpeed(1);
        const hot = hotspot();
        const tgt = g.cities.filter(x => S().owner[x.i] !== me() && E.droneOk(me(), x.i)).sort((a, b) => E.kmBetween(a.i, hot.i) - E.kmBetween(b.i, hot.i));
        if (tgt[0]) g.act({ type: 'drones', city: tgt[0].i }, {}); if (tgt[1]) g.act({ type: 'drones', city: tgt[1].i }, {});
        const own = g.cities.filter(x => S().owner[x.i] === me()).sort((a, b) => E.kmBetween(a.i, hot.i) - E.kmBetween(b.i, hot.i));
        if (own[0]) S().drones.push({ f: foe(), i: own[0].i, until: S().simT + 64 });
        if (own[2]) g.act({ type: 'ew', city: own[2].i }, {});
        const c = unit((tgt[0] || hot).v).add(unit((own[0] || hot).v)).normalize(); cam(c, c.clone().add(new V(-0.03, 0.015, 0.025)), 1.5, 1.4, 34, 40.5, 0);
        // the strike target: an enemy megahub on the night side, with as many cities around it as possible
        const hubs = g.cities.filter(c2 => c2.tier === 3 && S().owner[c2.i] === foe());
        const night = hubs.filter(c2 => nightish(c2.i)), pickFrom = night.length ? night : hubs;
        blackTarget = (pickFrom.sort((a, b) => g.cities.filter(x => x.region === b.region && S().owner[x.i] === foe()).length - g.cities.filter(x => x.region === a.region && S().owner[x.i] === foe()).length)[0] || hubs[0]).i; });
      once('s5b', T, 40.5, () => { const c = unit(g.cities[blackTarget].v); cam(unit(g.camera.position), c, g.camera.position.length(), 1.75, 40.5, 42.6, 0); });
      once('strike', T, 43.0, () => { const c = g.cities[blackTarget]; const s2 = S(); s2.blackout = (s2.blackout || []).filter(b => !(b.f === foe() && b.r === c.region)).concat({ f: foe(), r: c.region, until: s2.simT + 64, city: c.i }); g.blast(c.i, me(), true); g.sparks(c.i, 2, 14); g.sfx('boom'); });
      once('s6', T, 46, () => { const hot = hotspot(); satCity = (nearest(hot, x => S().owner[x.i] === foe() && x.tier >= 2) || hot).i;
        g.act({ type: 'satellite', city: satCity }, {}); const c = unit(g.cities[satCity].v); cam(c.clone().add(new V(0, -0.05, 0)), c.clone().add(new V(0, 0.03, 0)), 1.55, 1.45, 46, 50.2, 0); });
      once('drop', T, 49.6, () => { // airdrop from a megahub of ours to the nearest reachable enemy or neutral city
        if (S().gev && S().gev.k === 'solar') S().gev = null;   // a solar storm would ground the plane
        const hubs = g.cities.filter(c2 => (c2.tier === 3 || S().field[c2.i]) && S().owner[c2.i] === me());
        const hot = hotspot(); let best = null; for (const h of hubs) for (const c2 of g.cities) if (S().owner[c2.i] !== me() && E.canDrop(h.i, c2.i)) { const d = E.kmBetween(h.i, c2.i); if (d < 900) continue; const sc = d + E.kmBetween(c2.i, hot.i) * 0.7; if (!best || sc < best.sc) best = { h: h.i, c: c2.i, sc }; }
        if (best) { S().troops[best.h] = Math.max(S().troops[best.h], 120); g.act({ type: 'airdrop', src: best.h, dst: best.c }, {}); dropCv = S().convoys.filter(cv => cv.drop && cv.f === me()).pop() || null; g.setSpeed(2); } });
      if (T >= 50.2 && T < 56 && dropCv && dropCv.alive) { const pts = dropCv.e.pts || null; const a = g.cities[dropCv.fwd ? dropCv.e.a : dropCv.e.b], b = g.cities[dropCv.fwd ? dropCv.e.b : dropCv.e.a]; const u = dropCv.fwd ? dropCv.t : 1 - dropCv.t; const p = unit(a.v).lerp(unit(b.v), Math.min(1, u + 0.05)).normalize(); shot = { from: p, to: p, d0: 1.62, d1: 1.62, t0: 0, t1: 1, tilt: 0.1 }; }
      once('s7', T, 56, () => { cam(atl, asia, 2.9, 2.5, 56, 66, 0.2); g.setSpeed(10); });
      once('s8', T, 66, () => { g.setSpeed(0); g.raidOn();
        // five warheads from each side at the other's biggest cities, filmed from above the war so the arcs cross the frame
        const s2 = S(), hubsOf = f => g.cities.filter(c2 => c2.tier === 3 && s2.owner[c2.i] === f && !s2.rad[c2.i]);
        const targets = f => hubsOf(1 - f).sort((a, b) => E.blastCities(b.i).length - E.blastCities(a.i).length).slice(0, 5);
        const plan = []; for (const f of [0, 1]) { const from = hubsOf(f); for (const t of targets(f)) { const src = from.slice().sort((a, b) => E.kmBetween(a.i, t.i) - E.kmBetween(b.i, t.i))[0]; if (src) plan.push([src, t]); } }
        const mid = new V(); for (const [a, b] of plan) mid.add(unit(a.v)).add(unit(b.v)); mid.normalize();
        cam(unit(g.camera.position), mid, g.camera.position.length(), 2.75, 66, 69.5, 0.3);
        plan.forEach(([src, t], k) => missiles.push(launchMissile(src.i, t.i, 67.4 + (k % 5) * 0.5 + (k >= 5 ? 0.25 : 0), 5.4 + (k % 3) * 0.5))); });
      // missiles fly on our clock; impacts turn cities to fallout
      if (missiles.length) for (const m of missiles) {
        if (m._done) continue; m.t = Math.max(0, Math.min(1, (T - m._t0) / m._dur));
        if (m.t >= 1) { m._done = true; const s2 = S(); const hit = E.blastCities(m.target); s2.missiles = s2.missiles.filter(x => x !== m); for (const i of hit) { s2.rad[i] = 1; s2.owner[i] = -1; s2.troops[i] = 0; } g.nukeBlast(m.target, hit); g.paintOverlay(); flash = Math.max(flash, 0.55); shake = 1; }
      }
      once('raidoff', T, 80.2, () => g.raidOff(1.5));
      if (advance) advance();
      // overlays
      labelA = T < 7 ? 0 : T < 9 ? (T - 7) / 2 : T < 64 ? 1 : T < 66 ? (66 - T) / 2 : 0;
      scoreA = T < 56.5 ? 0 : T < 57.5 ? T - 56.5 : T < 65.5 ? 1 : Math.max(0, 66.5 - T);
      fade = T < 0.8 ? 1 - T / 0.8 : T > 81 ? Math.min(1, (T - 81) / 2.6) : 0;
      applyCam(T); flash = Math.max(0, flash - dt * 2.4);
      if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); const a = 0.02 * shake; g.camera.position.add(new V((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a)); g.camera.lookAt(0, 0, 0); }
      g.renderer.render(g.scene, g.camera); drawFrame(T);
  };
  const END = 91.2;
  if (opt.frames) {
    // frame-by-frame: the game's own loop stops and we step it exactly 1/fps per frame, every frame goes to ffmpeg,
    // and every sound the game makes is logged with its trailer second for the audio pass
    const fps = opt.fps || 60, base = opt.frames, raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => (cb && cb.name === 'frame' ? 0 : raf(cb));
    const log = []; let curT = 0; window.__sfxLog = (k, a) => log.push([+curT.toFixed(3), k, a ?? null]);
    const r0 = await fetch(`${base}/start?name=${encodeURIComponent(opt.name || 'trailer.mp4')}&fps=${fps}`); if (!r0.ok) throw new Error('start: ' + await r0.text());
    const n = Math.round(END * fps);
    for (let f = opt.from ? Math.round(opt.from * fps) : 0; f < n; f++) {
      const T = f / fps; curT = T; step(T, 1 / fps, () => g.tick(1, 1 / fps));
      // synchronous encode: toBlob gets postponed when the page is in the background
      const bin = atob(out.toDataURL('image/jpeg', 0.94).split(',')[1]), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      const rf = await fetch(base + '/frame', { method: 'POST', body: u8 }); if (!rf.ok) throw new Error('frame ' + f);
      window.__trFrame = f;
    }
    window.__sfxLog = null;
    try { localStorage.setItem('sl-trailer-sounds', JSON.stringify(log)); } catch (e) {}
    window.__trSounds = log;
    return await (await fetch(base + '/end')).text();
  }
  await new Promise(resolve => {
    const t0 = performance.now() - (opt.from || 0) * 1000; let last = t0;
    const loop = now => {
      const T = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (opt.stopAt && T > opt.stopAt) return resolve();
      step(T, dt, null);
      if (T < END) requestAnimationFrame(loop); else resolve();
    };
    requestAnimationFrame(loop);
  });
  if (rec) {
    await new Promise(r => { rec.onstop = r; rec.stop(); });
    const blob = new Blob(chunks, { type: rec.mimeType });
    if (opt.upload) { const r = await fetch(opt.upload + '?name=' + encodeURIComponent(opt.name || 'trailer-en.webm'), { method: 'POST', body: blob }); return await r.text(); }
    return blob.size;
  }
  return 'done';
}
// audio pass for a frame-by-frame render: the score plus every logged game sound, in real time, recorded on its own
export async function audio(opt = {}) {
  ac = g.actx; if (!ac) throw new Error('press PLAY first');
  if (ac.state !== 'running') await ac.resume();
  const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => (cb && cb.name === 'frame' ? 0 : raf(cb));   // no game running, so no stray sounds
  patchAudio(); recDest = ac.createMediaStreamDestination(); window.__slRec = recDest;
  const log = opt.sounds || JSON.parse(localStorage.getItem('sl-trailer-sounds') || '[]'), END = 91.2;
  const mime = ['audio/webm;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(recDest.stream, { mimeType: mime, audioBitsPerSecond: 256e3 }), chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start(500); await new Promise(r => setTimeout(r, 300));
  const LEAD = 1, t0 = ac.currentTime + LEAD; score(t0);
  // sync mark: a short click exactly 0.5 s before trailer second 0; the mux step finds it and cuts it away
  { const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.value = 1000; gn.gain.setValueAtTime(0.5, t0 - 0.5); gn.gain.setValueAtTime(0, t0 - 0.48); o.connect(gn).connect(ac.destination); gn.gain.value = 0; gn.gain.setValueAtTime(0, ac.currentTime); gn.gain.setValueAtTime(0.5, t0 - 0.5); gn.gain.setValueAtTime(0, t0 - 0.48); o.start(t0 - 0.6); o.stop(t0 - 0.4); }
  const play = ([, k, a]) => { if (k === 'sfx') g.sfx(a); else if (k === 'boom') g.boom(); else if (k === 'raidOn') g.raidOn(); else if (k === 'raidOff') g.raidOff(a || 0); else if (k === 'siren') g.siren(); };
  // a MessageChannel loop instead of timers: timers get throttled on background pages, this keeps sounds within a few ms
  await new Promise(resolve => { let i = 0; const ch = new MessageChannel(); ch.port1.onmessage = () => { const now = ac.currentTime - t0; window.__trT = now; while (i < log.length && log[i][0] <= now + 0.003) play(log[i++]); if (now > END + 1) { ch.port1.close(); return resolve(); } ch.port2.postMessage(0); }; ch.port2.postMessage(0); });
  await new Promise(r => { rec.onstop = r; rec.stop(); });
  const blob = new Blob(chunks, { type: rec.mimeType });
  const r = await fetch(opt.upload + '?name=' + encodeURIComponent(opt.name || 'trailer-audio.webm'), { method: 'POST', body: blob });
  return (await r.text()) + ' · lead ' + LEAD + ' s · sounds ' + log.length;
}
// a single frame at trailer second T, for checking the look without recording (scenes depend on time, so this only frames the camera)
export function still(drawT = 10) { if (!out) setupCanvas(); applyCam(drawT); g.renderer.render(g.scene, g.camera); drawFrame(drawT); return out; }
