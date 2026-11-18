// The feel of the war: what makes the globe look and sound alive, apart from the rules of the game.
// Smoke and fire over cities that were just fought for, artillery flashes along the front, tracers when convoys
// clash, a wash of colour when a city changes hands, scars that build up over the season, snow and monsoon rain
// you can see, lightning in sea storms, camera shake, a white flash for a nuclear strike, a phone buzz, and a TV mode
// whose camera flies by itself to wherever the war is hottest.
// index.html hands everything in through ctx; this file never reaches into the game state on its own.
export function createFeel(ctx) {
  const { THREE, scene, camera, cities, E, FCOL, FIRE, edgePts, SEG, RAD_KM, K, landMask, ll2v } = ctx;
  const phone = ctx.phone, PH = phone();
  const v3 = () => new THREE.Vector3(), tmp = v3(), tmp2 = v3();
  const UP = new THREE.Vector3(0, 1, 0);
  const tangents = n => { const a = Math.abs(n.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0), t1 = v3().crossVectors(n, a).normalize(); return [t1, v3().crossVectors(n, t1)]; };
  const camDir = () => tmp.copy(camera.position).normalize();
  // in sight: above the camera horizon (close up, the far part of the near side already hides behind the curve)
  const facing = p => tmp2.copy(p).normalize().dot(camera.position) > 1.003;
  const seen = i => i >= 0 && cities[i] && cities[i].vis !== false;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- sprite pools ----------
  function pool(n, make) { const list = []; return { list, get() { let s = list.find(x => !x.busy); if (!s) { if (list.length >= n) return null; s = make(); list.push(s); } s.busy = true; return s; } }; }
  const smokeMat = () => new THREE.SpriteMaterial({ map: FIRE, color: 0xa7a29b, transparent: true, opacity: 0, depthWrite: false });
  const glowMat = col => new THREE.SpriteMaterial({ map: FIRE, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const mkSprite = mat => () => { const s = new THREE.Sprite(mat()); s.visible = false; scene.add(s); return { s, busy: false }; };
  const puffs = pool(PH ? 80 : 180, mkSprite(smokeMat)), flashes = pool(PH ? 40 : 80, mkSprite(() => glowMat(0xffd9a0)));
  const live = { puffs: [], flashes: [] };

  // ---------- smoke and fire over burning cities ----------
  const burns = new Map();   // city → { until (s), power, acc, ember }
  let clock = 0;
  function burn(i, sec, power = 0.6) {
    if (!seen(i)) return; const b = burns.get(i);
    if (b) { b.until = Math.max(b.until, clock + sec); b.power = Math.min(1.6, Math.max(b.power, power)); return; }
    const ember = new THREE.Sprite(glowMat(0xff7a2a)); ember.visible = false; scene.add(ember);
    burns.set(i, { until: clock + sec, power, acc: 0, ember });
  }
  function puff(p, n, size, life, warm, col = 0xa7a29b, rise = 1) {
    const o = puffs.get(); if (!o) return; const [t1, t2] = tangents(n), a = Math.random() * 6.28;
    o.p = p.clone().addScaledVector(t1, Math.cos(a) * size * 0.25).addScaledVector(t2, Math.sin(a) * size * 0.25);
    o.vel = n.clone().multiplyScalar(rnd(0.004, 0.007) * rise).addScaledVector(t1, 0.0025).addScaledVector(t2, 0.001);   // a steady wind bends every column the same way
    o.t = 0; o.life = life; o.size = size; o.warm = warm; o.col = col; o.s.visible = true; live.puffs.push(o);
  }

  // ---------- quick flashes: artillery, flak bursts, lightning ----------
  function flash(p, size, life, col = 0xffd9a0, delay = 0) {
    const o = flashes.get(); if (!o) return; o.p = p.clone(); o.size = size; o.life = life; o.t = -delay; o.s.material.color.setHex(col); o.s.visible = false; live.flashes.push(o);
  }

  // ---------- tracers ----------
  const MAXT = PH ? 60 : 140, trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXT * 6), 3)); trGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXT * 6), 3));
  const tracerLines = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  tracerLines.frustumCulled = false; scene.add(tracerLines);
  const tracers = [];
  function tracer(a, b, col, dur, delay = 0, len = 0.35) { if (tracers.length < MAXT) tracers.push({ a: a.clone(), b: b.clone(), col: col.clone ? col.clone() : new THREE.Color(col), dur, t: -delay, len }); }
  const TRC = [new THREE.Color('#9fd0ff'), new THREE.Color('#ffd27a')], FLAKC = new THREE.Color('#fff1a8');
  // two sides shooting across a point: short streaks in both directions, staggered
  function crossfire(p, fa, fb, n = 6) {
    if (!facing(p)) return; const nn = p.clone().normalize(), [t1, t2] = tangents(nn), base = Math.random() * 6.28, R = 0.009;
    for (let k = 0; k < n; k++) { const side = k % 2, f = side ? fb : fa, ang = base + rnd(-0.35, 0.35) + (side ? Math.PI : 0);
      const dir = t1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(t2, Math.sin(ang)), from = p.clone().addScaledVector(dir, R).addScaledVector(nn, 0.0012), to = p.clone().addScaledVector(dir, -R * rnd(0.6, 1.1)).addScaledVector(nn, 0.0008);
      tracer(from, to, f >= 0 && f <= 1 ? TRC[f] : TRC[1], rnd(0.18, 0.3), k * 0.07); }
  }
  // air defence: streaks from the ground up into the sky, bursts at the top
  function flak(p, n = 5) {
    if (!facing(p)) return; const nn = p.clone().normalize(), [t1, t2] = tangents(nn);
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, top = nn.clone().multiplyScalar(1.022 + rnd(0, 0.012)).addScaledVector(t1, Math.cos(a) * 0.008).addScaledVector(t2, Math.sin(a) * 0.008), d = k * 0.11 + rnd(0, 0.05);
      tracer(nn.clone().multiplyScalar(1.001), top, FLAKC, 0.35, d, 0.25); flash(top, 0.006, 0.22, 0xfff0c0, d + 0.33); }
  }

  // ---------- a wash of colour when a city changes hands ----------
  const washGeo = new THREE.CircleGeometry(1, 48), washes = [];
  function wash(i, f) {
    const c = cities[i]; if (!seen(i) || f < 0 || !FCOL[f]) return; const n = c.v.clone().normalize();
    const m = new THREE.Mesh(washGeo, new THREE.MeshBasicMaterial({ map: FIRE, color: FCOL[f], transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(n).multiplyScalar(1.0016); m.lookAt(n.clone().multiplyScalar(2)); m.scale.setScalar(0.001); scene.add(m);
    washes.push({ m, t: 0, R: (RAD_KM[c.tier] || 420) / 6371 * 1.25 });
  }

  // ---------- scars: scorched ground that builds up over the season ----------
  const SW = PH ? 1024 : 2048, SH = SW / 2, scarCv = document.createElement('canvas'); scarCv.width = SW; scarCv.height = SH;
  const sg = scarCv.getContext('2d'), scarTex = new THREE.CanvasTexture(scarCv); scarTex.colorSpace = THREE.SRGBColorSpace;
  const scarMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0011, 96, 72), new THREE.MeshBasicMaterial({ map: scarTex, transparent: true, depthWrite: false }));
  scene.add(scarMesh);
  let scarDirty = null;
  const toPx = (lat, lng) => [(lng + 180) / 360 * SW, (90 - lat) / 180 * SH];
  function blot(lat, lng, rKm, alpha, rgb = '22,16,12') {
    const [x, y] = toPx(lat, lng), ry = rKm / 111 / 180 * SH, rx = ry / Math.max(0.2, Math.cos(lat * Math.PI / 180));
    sg.save(); sg.translate(x, y); sg.scale(rx / ry, 1);
    const g = sg.createRadialGradient(0, 0, 0, 0, 0, ry); g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(0.6, `rgba(${rgb},${alpha * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
    sg.fillStyle = g; sg.beginPath(); sg.arc(0, 0, ry, 0, 7); sg.fill(); sg.restore();
    const d = [x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 + 4];
    scarDirty = scarDirty ? [Math.min(scarDirty[0], d[0]), Math.min(scarDirty[1], d[1]), Math.max(scarDirty[0] + scarDirty[2], d[0] + d[2]) - Math.min(scarDirty[0], d[0]), Math.max(scarDirty[1] + scarDirty[3], d[1] + d[3]) - Math.min(scarDirty[1], d[1])] : d;
  }
  function scar(i, power = 0.4) {
    if (!seen(i)) return; const c = cities[i], r = (90 + c.tier * 50) * (0.6 + power * 0.5);
    for (let k = 0; k < 2 + Math.round(power * 3); k++) blot(c.lat + rnd(-1, 1) * r / 160, c.lng + rnd(-1, 1) * r / 160 / Math.max(0.3, Math.cos(c.lat * Math.PI / 180)), r * rnd(0.4, 0.9), Math.min(0.5, 0.12 + power * 0.14));
  }
  function crater(i) {
    const c = cities[i], R = (K.NUKE_BLAST || 900);
    blot(c.lat, c.lng, R * 1.1, 0.35, '30,24,20'); blot(c.lat, c.lng, R * 0.55, 0.6, '12,10,9'); blot(c.lat, c.lng, R * 0.22, 0.85, '6,5,5');
  }
  function flushScars() {
    if (!scarDirty) return; const [x, y, w, h] = scarDirty.map(Math.round); scarDirty = null;
    sg.save(); sg.beginPath(); sg.rect(x, y, w, h); sg.clip(); sg.globalCompositeOperation = 'destination-in'; sg.drawImage(landMask, 0, 0, SW, SH); sg.restore();   // only on land
    scarTex.needsUpdate = true;
  }

  // ---------- weather you can see: frost over snowy regions, dark monsoon cloud, falling snow and rain up close ----------
  const wxCv = document.createElement('canvas'); wxCv.width = SW; wxCv.height = SH;
  const wg = wxCv.getContext('2d'), wxTex = new THREE.CanvasTexture(wxCv); wxTex.colorSpace = THREE.SRGBColorSpace;
  const frost = new THREE.Mesh(new THREE.SphereGeometry(1.0013, 96, 72), new THREE.MeshBasicMaterial({ map: wxTex, transparent: true, depthWrite: false }));
  const rainCv = document.createElement('canvas'); rainCv.width = SW / 2; rainCv.height = SH / 2;
  const rg = rainCv.getContext('2d'), rainTex = new THREE.CanvasTexture(rainCv); rainTex.colorSpace = THREE.SRGBColorSpace;
  const rainCloud = new THREE.Mesh(new THREE.SphereGeometry(1.026, 96, 72), new THREE.MeshLambertMaterial({ map: rainTex, transparent: true, opacity: 0.75, depthWrite: false }));
  scene.add(frost, rainCloud);
  let wxSig = '', wxCities = { snow: [], monsoon: [] };
  function paintWeather(S) {
    const w = (S.weather || []).slice().sort().join(','); if (w === wxSig) return; wxSig = w;
    wxCities = { snow: [], monsoon: [] };
    for (const k of Object.keys(wxCities)) if ((S.weather || []).includes(k)) for (const c of cities) if (E.inWeather && E.inWeather(c.i, k)) wxCities[k].push(c);
    wg.clearRect(0, 0, SW, SH);
    for (const c of wxCities.snow) { const [x, y] = toPx(c.lat, c.lng), ry = 650 / 111 / 180 * SH, rx = ry / Math.max(0.25, Math.cos(c.lat * Math.PI / 180));
      wg.save(); wg.translate(x, y); wg.scale(rx / ry, 1); const g = wg.createRadialGradient(0, 0, 0, 0, 0, ry); g.addColorStop(0, 'rgba(235,244,255,.42)'); g.addColorStop(1, 'rgba(235,244,255,0)'); wg.fillStyle = g; wg.beginPath(); wg.arc(0, 0, ry, 0, 7); wg.fill(); wg.restore(); }
    wg.globalCompositeOperation = 'destination-in'; wg.drawImage(landMask, 0, 0, SW, SH); wg.globalCompositeOperation = 'source-over'; wxTex.needsUpdate = true;
    const W2 = SW / 2, H2 = SH / 2; rg.clearRect(0, 0, W2, H2);
    for (const c of wxCities.monsoon) for (let k = 0; k < 3; k++) { const x = (c.lng + rnd(-4, 4) + 180) / 360 * W2, y = (90 - c.lat - rnd(-3, 3)) / 180 * H2, r = rnd(10, 22) * W2 / 1024;
      const g = rg.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(70,78,92,.6)'); g.addColorStop(1, 'rgba(70,78,92,0)'); rg.fillStyle = g; rg.beginPath(); rg.arc(x, y, r, 0, 7); rg.fill(); }
    rainTex.needsUpdate = true;
  }
  // falling particles in a box over the point the camera looks at
  const NP = PH ? 260 : 600, fallGeo = new THREE.BufferGeometry(), fallPos = new Float32Array(NP * 6), fallLocal = new Float32Array(NP * 3);
  for (let k = 0; k < NP; k++) { fallLocal[k * 3] = rnd(-1, 1); fallLocal[k * 3 + 1] = rnd(-1, 1); fallLocal[k * 3 + 2] = Math.random(); }
  fallGeo.setAttribute('position', new THREE.BufferAttribute(fallPos, 3));
  const rainLines = new THREE.LineSegments(fallGeo, new THREE.LineBasicMaterial({ color: 0xa8c4e8, transparent: true, opacity: 0, depthWrite: false }));
  const snowGeo = new THREE.BufferGeometry(), snowPos = new Float32Array(NP * 3); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: FIRE, color: 0xffffff, size: 0.0016, transparent: true, opacity: 0, depthWrite: false }));
  rainLines.frustumCulled = snowPts.frustumCulled = false; scene.add(rainLines, snowPts);
  function nearWeather(g) { let best = null, bd = 0.13; for (const k of ['snow', 'monsoon']) for (const c of wxCities[k]) { const d = Math.acos(Math.min(1, c.v.clone().normalize().dot(g))); if (d < bd) { bd = d; best = k; } } return best; }
  let fallKind = null, fallAmt = 0;
  function stepFall(dt) {
    const cd = camera.position.length(), g = camDir().clone(), kind = cd < 1.75 ? nearWeather(g) : null;
    if (kind) fallKind = kind; fallAmt += ((kind ? 1 : 0) - fallAmt) * Math.min(1, dt * 1.5);
    rainLines.visible = fallKind === 'monsoon' && fallAmt > 0.01; snowPts.visible = fallKind === 'snow' && fallAmt > 0.01;
    rainLines.material.opacity = 0.45 * fallAmt; snowPts.material.opacity = 0.9 * fallAmt;
    if (!rainLines.visible && !snowPts.visible) return;
    const [t1, t2] = tangents(g), span = 0.02 + (cd - 1.15) * 0.12, H = 0.02, rain = fallKind === 'monsoon', sp = rain ? 1.6 : 0.18;
    for (let k = 0; k < NP; k++) {
      const L = fallLocal; L[k * 3 + 2] -= dt * sp * (0.7 + (k % 7) * 0.06); if (L[k * 3 + 2] < 0) { L[k * 3 + 2] += 1; L[k * 3] = rnd(-1, 1); L[k * 3 + 1] = rnd(-1, 1); }
      if (!rain) { L[k * 3] += dt * 0.05 * Math.sin(clock * 0.8 + k); }
      const x = L[k * 3] * span, y = L[k * 3 + 1] * span, h = 1.0015 + L[k * 3 + 2] * H;
      const px = g.x * h + t1.x * x + t2.x * y, py = g.y * h + t1.y * x + t2.y * y, pz = g.z * h + t1.z * x + t2.z * y;
      if (rain) { fallPos.set([px, py, pz, px + g.x * 0.0022 + t1.x * 0.0004, py + g.y * 0.0022 + t1.y * 0.0004, pz + g.z * 0.0022 + t1.z * 0.0004], k * 6); }
      else snowPos.set([px, py, pz], k * 3);
    }
    if (rain) fallGeo.attributes.position.needsUpdate = true; else snowGeo.attributes.position.needsUpdate = true;
  }

  // ---------- camera shake and the white flash ----------
  let shakeAmp = 0, shaken = false; const off = v3();
  function kick(p, s) { if (p && !facing(p)) return; const d = p ? camera.position.distanceTo(p) : 1; shakeAmp = Math.min(1.6, shakeAmp + s * Math.min(1.2, 0.9 / (0.3 + d))); }
  const white = document.createElement('div'); white.id = 'whiteout'; document.body.appendChild(white);
  let whiteT = 9, whiteK = 0;
  function whiteout(p, k = 1) { if (p && !facing(p)) k *= 0.25; whiteK = Math.min(1, k * Math.min(1, 1.6 / camera.position.distanceTo(p || camera.position))); whiteT = 0; }
  function beforeRender() { if (shakeAmp < 0.004) return; const s = 0.016 * shakeAmp * Math.max(0.15, camera.position.length() - 1); off.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(s); camera.position.add(off); camera.updateMatrixWorld(); shaken = true; }
  function afterRender() { if (shaken) { camera.position.sub(off); camera.updateMatrixWorld(); shaken = false; } }
  function buzz(p) { try { if (phone() && !ctx.muted() && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // ---------- the front: hot edges, artillery flashes, the battle under the camera ----------
  let front = [], frontW = 0, frontT = 9, cityHeat = new Float32Array(cities.length);
  function rebuildFront(st) {
    front = []; frontW = 0; cityHeat.fill(0);
    for (const e of E.edges) {
      const oa = st.owner[e.a], ob = st.owner[e.b], h = st.heat[e.i] || 0, border = e.type === 0 && oa >= 0 && ob >= 0 && oa !== ob;
      if (h > 0) { cityHeat[e.a] += h; cityHeat[e.b] += h; }
      if (!border && !(h > 0 && e.type !== 2)) continue;
      const w = (border ? 0.06 : 0) + Math.min(2, h); front.push({ e, w }); frontW += w;
    }
  }
  function pickFront() { let r = Math.random() * frontW; for (const f of front) { r -= f.w; if (r <= 0) return f.e; } return null; }
  const along = (e, u) => { const pts = edgePts(e), uu = u * SEG, i0 = Math.min(SEG - 1, Math.floor(uu)); return pts[i0].clone().lerp(pts[i0 + 1], uu - i0); };
  let artAcc = 0, ambT = 0;
  function stepFront(dt, st) {
    frontT += dt; if (frontT > 0.5) { frontT = 0; rebuildFront(st); }
    if (st.replay || !front.length) return;
    artAcc += dt * Math.min(PH ? 10 : 22, 1.5 + frontW * 1.6);
    while (artAcc > 1) { artAcc--; const e = pickFront(); if (!e || (!seen(e.a) && !seen(e.b))) continue;
      const p = along(e, rnd(0.25, 0.75)); if (!facing(p)) continue; const nn = p.clone().normalize(), [t1, t2] = tangents(nn);
      p.addScaledVector(t1, rnd(-0.004, 0.004)).addScaledVector(t2, rnd(-0.004, 0.004)).multiplyScalar(1.0015);
      flash(p, rnd(0.003, 0.007), rnd(0.12, 0.24)); if (Math.random() < 0.3) flash(p, rnd(0.002, 0.004), 0.12, 0xffb070, rnd(0.15, 0.3));
      if (camera.position.length() < 1.8 && Math.random() < 0.12) ctx.sndAt('gun', p, { gain: 0.22, gap: 0.8 }); }
    // smoke from cities in the middle of a fight, even before anyone wins
    for (let i = 0; i < cityHeat.length; i++) if (cityHeat[i] > 0.6 && Math.random() < dt * 0.25 && seen(i)) burn(i, 6, Math.min(0.8, cityHeat[i] * 0.3));
  }
  // is there sea or land at a point of the globe: read once from the land mask (white = land)
  const landImg = (() => { try { return { w: landMask.width, h: landMask.height, d: landMask.getContext('2d').getImageData(0, 0, landMask.width, landMask.height).data }; } catch (e) { return null; } })();
  function isSea(v) {
    if (!landImg) return false; const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI; let lng = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180; if (lng < -180) lng += 360;
    const x = Math.min(landImg.w - 1, Math.max(0, Math.floor((lng + 180) / 360 * landImg.w))), y = Math.min(landImg.h - 1, Math.max(0, Math.floor((90 - lat) / 180 * landImg.h)));
    return landImg.d[(y * landImg.w + x) * 4 + 3] < 128;
  }
  // the point of the planet in the middle of the screen (where the view ray meets the globe)
  const fwdV = v3();
  function lookPoint() { camera.getWorldDirection(fwdV); const C = camera.position, b = C.dot(fwdV), c = C.lengthSq() - 1, disc = b * b - c; if (disc < 0) return C.clone().normalize(); return C.clone().addScaledVector(fwdV, -b - Math.sqrt(disc)).normalize(); }
  // levels for the sound beds: the battle when you lean over a front, engines near convoys, waves over the sea
  function stepAmbience(dt, st) {
    ambT += dt; if (ambT < 0.25) return; ambT = 0;
    const cd = camera.position.length(), g = camDir().clone(), near = Math.max(0, Math.min(1, (2.7 - cd) / 1.3));
    let sea = 0; if (cd < 1.8) { const c = lookPoint(), [t1, t2] = tangents(c); for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (isSea(c.clone().addScaledVector(t1, a * 0.025).addScaledVector(t2, b * 0.025).normalize())) sea += 0.2; sea *= Math.max(0, Math.min(1, (1.8 - cd) / 0.45)); }
    let bed = 0, px = 0; for (const f of front) { const p = along(f.e, 0.5), d = Math.acos(Math.min(1, p.clone().normalize().dot(g))); if (d > 0.4) continue; const w = f.w * (1 - d / 0.4); bed += w; px += w * p.clone().project(camera).x; }
    let eng = 0; if (cd < 2) for (const cv of st.convoys || []) { if (!cv.alive || !cv.e || cv.e.type === 2 || !ctx.cvVisible(cv)) continue; const p = along(cv.e, cv.fwd ? cv.t : 1 - cv.t), d = Math.acos(Math.min(1, p.clone().normalize().dot(g))); if (d < 0.15) eng++; }
    ctx.ambience({ sea, bed: Math.min(1, bed * 0.9) * near, pan: bed ? px / bed : 0, engine: Math.min(1, eng / 6) * Math.max(0, Math.min(1, (2 - cd) / 0.5)) });
  }

  // ---------- storms at sea: lightning and far thunder ----------
  function stepStorms(dt, st) {
    for (const s of st.S.storms || []) if (Math.random() < dt * 0.35) { const p = ll2v(s.lat + rnd(-1, 1) * s.r / 250, s.lng + rnd(-1, 1) * s.r / 250).multiplyScalar(1.02); if (!facing(p)) continue;
      const sz = Math.min(0.08, s.r / 6371 * 0.7); flash(p, sz, 0.09, 0xcfe0ff); flash(p, sz * 0.8, 0.08, 0xe8f0ff, 0.14); if (camera.position.length() < 2.4 && Math.random() < 0.5) ctx.sndAt('far', p, { gain: 0.5, gap: 1.2 }); }
    if (wxCities.monsoon.length && Math.random() < dt * 0.25) { const c = wxCities.monsoon[(Math.random() * wxCities.monsoon.length) | 0], p = c.v.clone().normalize().multiplyScalar(1.024); if (facing(p)) { flash(p, 0.03, 0.08, 0xd8e6ff); flash(p, 0.02, 0.07, 0xffffff, 0.12); } }
  }

  // ---------- TV mode: the camera flies to wherever the war is hottest ----------
  const hot = [];   // { p, score, at, text }
  function note(p, score, text) { if (!p) return; hot.push({ p: p.clone().normalize(), score, at: clock, text }); if (hot.length > 40) hot.shift(); }
  const cap = document.createElement('div'); cap.id = 'tvCap'; document.body.appendChild(cap);
  const tv = { on: false, next: 0, p: null, ang: 0, shown: [] };
  function tvPick() {
    let best = null, bs = 0;
    for (const h of hot) { const age = clock - h.at; if (age > 45) continue; if (tv.shown.some(s => s.distanceTo(h.p) < 0.08 && age > -1)) continue; const s = h.score * (1 - age / 60); if (s > bs) { bs = s; best = h; } }
    if (!best && front.length) { const e = pickFront(); if (e) best = { p: along(e, 0.5).normalize(), text: '' }; }
    if (!best) { const c = cities[(Math.random() * cities.length) | 0]; best = { p: c.v.clone().normalize(), text: '' }; }
    tv.p = best.p; tv.ang = Math.random() * 6.28; tv.next = clock + (best.score >= 6 ? 14 : 9); tv.shown.push(best.p); if (tv.shown.length > 4) tv.shown.shift();
    cap.textContent = best.text || ''; cap.classList.toggle('on', !!best.text); clearTimeout(cap._t); cap._t = setTimeout(() => cap.classList.remove('on'), 6000);
  }
  function tvStart() { if (tv.on) return; tv.on = true; tv.next = 0; ctx.controls.enabled = false; document.body.classList.add('tv'); ctx.onTv && ctx.onTv(true); }
  function tvStop() { if (!tv.on) return; tv.on = false; ctx.controls.enabled = true; document.body.classList.remove('tv'); cap.classList.remove('on'); ctx.onTv && ctx.onTv(false); }
  function stepTv(dt) {
    dt = Math.max(0, dt || 0); if (!tv.on) return; if (clock > tv.next) tvPick(); if (!tv.p) return;
    // a slow circle around the spot, a little off to the side, breathing in and out
    tv.ang += dt * 0.12; const [t1, t2] = tangents(tv.p), D = 1.62 + 0.08 * Math.sin(clock * 0.21);
    const want = tv.p.clone().addScaledVector(t1, Math.cos(tv.ang) * 0.22).addScaledVector(t2, Math.sin(tv.ang) * 0.22).normalize().multiplyScalar(D);
    camera.position.lerp(want, Math.min(1, dt * 0.7));
  }
  for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, e => { if (tv.on && !(e.target && e.target.closest && e.target.closest('[data-tv]'))) tvStop(); }, { capture: true, passive: true });

  // dust kicked up behind land convoys, only when you lean in close enough to see it
  let dustT = 0;
  function stepDust(dt, st) {
    dustT += dt; if (dustT < 0.12 || camera.position.length() > 1.7) return; dustT = 0;
    const g = camDir().clone(); let k = 0;
    for (const cv of st.convoys || []) { if (k > 14) break; if (!cv.alive || !cv.e || cv.e.type !== 0 || cv.drop || !ctx.cvVisible(cv)) continue;
      const p = along(cv.e, Math.max(0, Math.min(1, cv.fwd ? cv.t - 0.006 : 1 - cv.t + 0.006))); if (p.clone().normalize().dot(g) < 0.985) continue; k++;
      const n = p.clone().normalize(); puff(p.multiplyScalar(1.0018), n, 0.0022, rnd(1.2, 2), false, 0x6b5a46, 0.25); }
  }

  // ---------- each frame ----------
  function update(dt, t) {
    dt = Math.max(0, dt || 0); clock += dt; const st = ctx.st();
    stepFront(dt, st); stepAmbience(dt, st); stepStorms(dt, st); stepFall(dt); stepDust(dt, st); paintWeather(st.S);
    shakeAmp *= Math.exp(-dt * 3.2);
    // burning cities
    for (const [i, b] of burns) {
      const left = b.until - clock, c = cities[i];
      if (left <= 0 || !seen(i)) { scene.remove(b.ember); b.ember.material.dispose(); burns.delete(i); continue; }
      const k = Math.min(1, left / 8) * b.power, n = c.v.clone().normalize();
      b.acc += dt * (PH ? 2 : 3.5) * k;
      while (b.acc > 1) { b.acc--; puff(n.clone().multiplyScalar(1.0025), n, (0.005 + c.tier * 0.0022) * (0.7 + b.power * 0.5), rnd(3.5, 6), Math.random() < 0.5); }
      b.ember.position.copy(n).multiplyScalar(1.003); b.ember.scale.setScalar((0.006 + c.tier * 0.002) * (0.85 + 0.3 * Math.sin(clock * 17 + i) * Math.sin(clock * 5.3)));
      b.ember.material.opacity = 0.75 * k; b.ember.visible = facing(n);
    }
    for (let k = live.puffs.length - 1; k >= 0; k--) { const o = live.puffs[k]; o.t += dt; const u = o.t / o.life;
      if (u >= 1) { o.busy = false; o.s.visible = false; live.puffs.splice(k, 1); continue; }
      o.p.addScaledVector(o.vel, dt); o.s.position.copy(o.p); o.s.scale.setScalar(o.size * (0.8 + u * 3));
      o.s.material.opacity = Math.min(1, u * 5) * Math.pow(1 - u, 0.6) * 0.75; o.s.material.color.setHex(o.warm && u < 0.15 ? 0xd07a3a : o.col); o.s.visible = facing(o.p); }
    for (let k = live.flashes.length - 1; k >= 0; k--) { const o = live.flashes[k]; o.t += dt; if (o.t < 0) continue; const u = o.t / o.life;
      if (u >= 1) { o.busy = false; o.s.visible = false; live.flashes.splice(k, 1); continue; }
      o.s.position.copy(o.p); o.s.scale.setScalar(o.size * (0.6 + u * 0.8)); o.s.material.opacity = 1 - u; o.s.visible = facing(o.p); }
    // tracers
    { const P = trGeo.attributes.position.array, C = trGeo.attributes.color.array; let n = 0;
      for (let k = tracers.length - 1; k >= 0; k--) { const r = tracers[k]; r.t += dt; if (r.t > r.dur) { tracers.splice(k, 1); continue; } if (r.t < 0) continue;
        const u = r.t / r.dur, a = r.a.clone().lerp(r.b, Math.max(0, u - r.len)), b = r.a.clone().lerp(r.b, u), f = 1 - u * 0.5;
        P.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 6); C.set([r.col.r * 0.15, r.col.g * 0.15, r.col.b * 0.15, r.col.r * f, r.col.g * f, r.col.b * f], n * 6); n++; }
      trGeo.setDrawRange(0, n * 2); trGeo.attributes.position.needsUpdate = trGeo.attributes.color.needsUpdate = true; tracerLines.visible = n > 0; }
    for (let k = washes.length - 1; k >= 0; k--) { const w = washes[k]; w.t += dt; const u = Math.min(1, w.t / 0.9);
      w.m.scale.setScalar(Math.max(0.001, w.R * (1 - Math.pow(1 - u, 3)))); w.m.material.opacity = 0.6 * Math.max(0, 1 - w.t / 1.5);
      if (w.t > 1.5) { scene.remove(w.m); w.m.material.dispose(); washes.splice(k, 1); } }
    if (whiteT < 3) { whiteT += dt; white.style.opacity = String(Math.max(0, whiteK * (whiteT < 0.08 ? whiteT / 0.08 : Math.exp(-(whiteT - 0.08) * 2.2)))); }
    if ((clock * 4 | 0) !== ((clock - dt) * 4 | 0)) flushScars();
    scarMesh.visible = frost.visible = rainCloud.visible = !st.replay;
  }

  // ---------- game events → what you see, hear and feel ----------
  function event(ev, describe) {
    const st = ctx.st(); if (st.replay) return; const me = st.me, myId = ctx.myId(), i = ev.city, c = i >= 0 ? cities[i] : null, vis = c && seen(i), txt = () => describe ? describe(ev) : '';
    switch (ev.k) {
      case 'start': reset(); break;
      case 'capture': if (!vis) break; wash(i, ev.f); burn(i, 18 + 10 * c.tier, 0.5 + 0.3 * c.tier); scar(i, 0.35 + 0.25 * c.tier); crossfire(c.v, ev.f, ev.prev, 4 + c.tier * 2);
        ctx.sndAt('gun', c.v, { gain: 0.6 + 0.15 * c.tier, gap: 0.3 }); kick(c.v, 0.12 + 0.1 * c.tier);
        if (ev.prev === me) buzz([70, 50, 70]); else if (ev.who === myId) buzz(35);
        note(c.v, c.cap >= 0 ? 7 : c.tier >= 2 ? 3 : 1.2, txt()); break;
      case 'repel': if (!vis) break; crossfire(c.v, ev.f, st.owner[i], 5); ctx.sndAt('gun', c.v, { gain: 0.6 }); scar(i, 0.2); burn(i, 8, 0.4); note(c.v, 1.5, txt()); break;
      case 'clash': { const e = E.edges[ev.edge]; if (!e || (!seen(e.a) && !seen(e.b))) break; const p = along(e, Math.max(0, Math.min(1, ev.s))); crossfire(p, ev.f, 1 - ev.f, 6); ctx.sndAt('mg', p, { gain: 0.35, gap: 0.6 }); flash(p, 0.005, 0.2); note(p, 1, ''); break; }
      case 'sabotage': case 'rail_cut': if (!vis) break; ctx.sndAt('pop', c.v, { gain: 0.6 }); burn(i, 10, 0.45); scar(i, 0.15); break;
      case 'drone_hit': if (!vis) break; ctx.sndAt('pop', c.v, { gain: 0.55 }); flash(c.v.clone().multiplyScalar(1.002), 0.005, 0.2); break;
      case 'drones': if (!vis) break; ctx.sndAt('whoosh', c.v, { gain: 0.25, gap: 0.5 }); note(c.v, 1, txt()); break;
      case 'blackout': if (!vis) break; ctx.sndAt('blast', c.v, { gain: 0.85 }); kick(c.v, 0.25); burn(i, 25, 0.7); scar(i, 0.3); if (ev.victim === me) buzz([50, 30, 50]); note(c.v, 3, txt()); break;
      case 'strike_down': if (!vis) break; flak(c.v, 4); ctx.sndAt('flak', c.v, { gain: 0.7 }); break;
      case 'aa': if (!vis) break; flak(c.v, 6); ctx.sndAt('flak', c.v, { gain: 0.7 }); note(c.v, 1.5, txt()); break;
      case 'intercept': case 'naval': if (!vis) break; crossfire(c.v, ev.f, 1 - ev.f, ev.k === 'naval' ? 10 : 5); ctx.sndAt(ev.k === 'naval' ? 'blast' : 'gun', c.v, { gain: 0.8 }); if (ev.k === 'naval') { kick(c.v, 0.2); note(c.v, 3, txt()); } break;
      case 'ally': for (const j of ev.cities || []) wash(j, ev.f); if (ev.cities && ev.cities.length) note(cities[ev.cities[0]].v, 4, txt()); break;
      case 'cap_hold': if (c) note(c.v, 6, txt()); break;
      case 'nuke_launch': { const t = cities[ev.target]; if (t) note(t.v, 9, txt()); break; }
      case 'nuke_hit': { const t = cities[ev.target]; if (!t) break; crater(ev.target); for (const j of ev.cities || []) burn(j, 120, 1.2); burn(ev.target, 160, 1.6);
        whiteout(t.v, 1); kick(t.v, 1.5); ctx.sndAt('shock', t.v, { gain: 1.5, gap: 0, delay: Math.min(2.2, camera.position.distanceTo(t.v) * 0.9) }); buzz([120, 60, 350]); note(t.v, 10, txt()); break; }
    }
  }
  function reset() { sg.clearRect(0, 0, SW, SH); scarTex.needsUpdate = true; for (const [, b] of burns) { scene.remove(b.ember); b.ember.material.dispose(); } burns.clear(); hot.length = 0; }

  return { update, camStep: stepTv, isSea, lookPoint, event, beforeRender, afterRender, kick, buzz, tvStart, tvStop, get tv() { return tv.on; }, burn, scar, wash, crossfire, flak, crater, whiteout, note };
}
