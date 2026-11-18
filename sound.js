// Sound for Supply Lines. Every sound is synthesized once at the start (nothing to download), then played in space:
// near the camera it is loud and bright, far away it is quiet, muffled and late (you see the flash, then hear it),
// and it sits left or right where it happened on screen. Three quiet loops under it, all only up close: the rumble
// of a battle when you lean over a front, engines when you follow convoys, and waves when you come down over the sea.
// Far out there is no bed at all (a noise "orbit hum" sounded like surf and only got in the way of the music).
export function createSound(actx) {
  const SR = actx.sampleRate, buffers = {}, loops = {};
  const master = actx.createGain(), comp = actx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3;   // light: it only catches peaks, so far stays quieter than near comp.attack.value = 0.003; comp.release.value = 0.3;
  master.gain.value = 0.9; master.connect(comp).connect(actx.destination);
  const verb = actx.createConvolver(), verbIn = actx.createGain(); verbIn.gain.value = 0.5; verbIn.connect(verb).connect(master);
  let muted = false, active = 0;
  const lastAt = {};

  // ---------- small DSP kit ----------
  const rnd = () => Math.random() * 2 - 1;
  const lp = (d, cut) => { let y = 0; const f = typeof cut === 'function'; for (let i = 0; i < d.length; i++) { const fc = f ? cut(i / SR) : cut, a = 1 - Math.exp(-2 * Math.PI * fc / SR); y += a * (d[i] - y); d[i] = y; } return d; };
  const hp = (d, cut) => { const c = Float32Array.from(d); lp(c, cut); for (let i = 0; i < d.length; i++) d[i] -= c[i]; return d; };
  const noise = n => { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = rnd(); return d; };
  const mix = (dst, src, at = 0, g = 1) => { const o = Math.floor(at * SR); for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * g; return dst; };
  const env = (d, fn) => { for (let i = 0; i < d.length; i++) d[i] *= fn(i / SR); return d; };
  const tone = (sec, freq, amp) => { const n = Math.ceil(sec * SR), d = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * freq(t) / SR; d[i] = Math.sin(ph) * amp(t); } return d; };
  const norm = (d, peak = 0.9) => { let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; return d; };
  const seamless = (d, sec) => { const n = Math.floor(sec * SR), xf = d.length - n; for (let i = 0; i < xf; i++) { const w = i / xf; d[i] = d[i] * w + d[n + i] * (1 - w); } return d.subarray(0, n); };
  const toBuf = d => { const b = actx.createBuffer(1, d.length, SR); b.getChannelData(0).set(d); return b; };
  const sparse = (d, from, to, rate, size) => { for (let i = Math.floor(from * SR); i < Math.min(d.length, to * SR); i++) { const t = i / SR; if (Math.random() < rate * Math.exp(-(t - from) * 1.6) / SR) mix(d, lp(env(noise(Math.ceil(0.012 * SR)), u => Math.exp(-u * 400)), 2200), t, size * Math.random()); } return d; };

  // a brass-like horn: three slightly detuned saws, a filter that opens as the note speaks and a late gentle vibrato;
  // notes are [midi, start, length]
  function horn(notes, bright) {
    const end = Math.max(...notes.map(([, at, len]) => at + len)) + 0.5, d = new Float32Array(Math.ceil(end * SR));
    for (const [m, at, len] of notes) {
      const f0 = 440 * Math.pow(2, (m - 69) / 12), n = Math.ceil((len + 0.35) * SR), v = new Float32Array(n), ph = [0, 0.3, 0.6];
      for (let i = 0; i < n; i++) { const t = i / SR, vib = 1 + (t > 0.12 ? 0.004 * Math.sin(t * 2 * Math.PI * 5.3) : 0); let s = 0;
        [0.996, 1, 1.004].forEach((k, j) => { ph[j] = (ph[j] + f0 * k * vib / SR) % 1; s += 2 * ph[j] - 1; });
        const a = Math.min(1, t / 0.035) * (t < len ? 1 : Math.max(0, 1 - (t - len) / 0.3)); v[i] = s / 3 * a; }
      lp(v, t => 400 + (1400 + 2600 * bright) * Math.min(1, t / 0.06) * (0.65 + 0.35 * Math.exp(-t * 6))); lp(v, t => 600 + 3000 * bright * Math.min(1, t / 0.05));
      mix(d, v, at);
    }
    return d;
  }

  // ---------- the sounds ----------
  const MAKE = {
    // Explosions are built from noise only: a pure tone sweep (the usual synth "thump") reads as a knock on a drum,
    // especially through laptop and phone speakers. Weight comes from a second, very dark layer of rumble instead.
    // a close explosion: a burst whose brightness falls away, a deep rumble under it, debris crackling after
    blast() { const L = 3, n = Math.ceil(L * SR), att = t => Math.min(1, t / 0.008);
      const d = env(noise(n), t => att(t) * Math.exp(-t * 2.4)); lp(d, t => 120 + 3200 * Math.exp(-t * 6) + 300 * Math.exp(-t * 1.5)); lp(d, t => 120 + 3200 * Math.exp(-t * 6) + 300 * Math.exp(-t * 1.5));
      const body = env(noise(n), t => Math.min(1, t / 0.03) * Math.exp(-t * 1.5)); lp(body, 85); lp(body, 85); mix(d, norm(body), 0, 0.9);
      return norm(sparse(d, 0.3, 2.4, 140, 0.18)); },
    // a far one: a rolling low rumble like thunder
    far() { const L = 3.6, n = Math.ceil(L * SR), ph = Math.random() * 6, d = env(noise(n), t => Math.min(1, t / 0.12) * Math.exp(-t * 1.1) * (1 + 0.4 * Math.sin(t * 4.3 + ph)));
      lp(d, 190); lp(d, 190); return norm(d); },
    // taking a city is a signal, not one more explosion: a short bugle call on a brass voice, rising to the octave
    fanfare() { return norm(horn([[67, 0, 0.13], [72, 0.15, 0.13], [79, 0.3, 0.7]], 0.85), 0.8); },
    // a button press: a tiny soft tick, more felt than heard
    click() { const n = Math.ceil(0.045 * SR), d = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(2 * Math.PI * 1750 * t) * Math.min(1, t / 0.0015) * Math.exp(-t * 150); }
      const h = env(noise(n), t => Math.exp(-t * 420)); lp(h, 5200); hp(h, 1400); mix(d, h, 0, 0.45); return norm(d, 0.6); },
    // a satellite's telemetry pip, the film kind: a clean high tone with a breath of static around it
    sat() { const L = 0.16, n = Math.ceil(L * SR), d = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR, a = t < 0.004 ? t / 0.004 : t < 0.085 ? 1 : Math.max(0, 1 - (t - 0.085) / 0.02); d[i] = a * (Math.sin(2 * Math.PI * 1820 * t) + 0.22 * Math.sin(2 * Math.PI * 5460 * t)); }
      const h = env(noise(n), t => 0.12 * Math.min(1, t / 0.01) * Math.exp(-t * 18)); hp(lp(h, 4200), 1200); mix(d, h); return norm(d, 0.7); },
    // losing a big city of yours: the same horn, low, falling and slow
    lament() { return norm(horn([[62, 0, 0.42], [58, 0.45, 0.42], [55, 0.9, 1.1]], 0.7), 0.7); },
    // artillery: a smaller burst, a dark rumble, an echo coming back off the hills
    gun() { const L = 2.2, n = Math.ceil(L * SR), d = env(noise(n), t => Math.min(1, t / 0.006) * Math.exp(-t * 4.5)); lp(d, t => 140 + 2200 * Math.exp(-t * 13)); lp(d, t => 140 + 2200 * Math.exp(-t * 13));
      const body = env(noise(n), t => Math.min(1, t / 0.025) * Math.exp(-t * 2.6)); lp(body, 90); lp(body, 90); mix(d, norm(body), 0, 0.8);
      const echo = env(noise(n), t => Math.min(1, t / 0.08) * Math.exp(-t * 2)); lp(echo, 380); lp(echo, 380); mix(d, norm(echo), 0.3, 0.22); return norm(d); },
    // a small hit: drones, a convoy struck
    pop() { const L = 0.9, n = Math.ceil(L * SR), d = env(noise(n), t => Math.min(1, t / 0.005) * Math.exp(-t * 8)); lp(d, t => 250 + 2400 * Math.exp(-t * 16)); lp(d, t => 250 + 2400 * Math.exp(-t * 16));
      const body = env(noise(n), t => Math.min(1, t / 0.02) * Math.exp(-t * 5)); lp(body, 120); lp(body, 120); mix(d, norm(body), 0, 0.5); return norm(d); },
    // air defence: three quick dull bursts high in the air
    flak() { const d = new Float32Array(Math.ceil(1.1 * SR));
      for (const at of [0, 0.1 + Math.random() * 0.04, 0.24 + Math.random() * 0.06]) { const b = env(noise(Math.ceil(0.5 * SR)), t => Math.min(1, t / 0.004) * Math.exp(-t * 14)); lp(b, 1500); lp(b, 1500); hp(b, 160); mix(d, b, at, 0.8 + Math.random() * 0.3); }
      return norm(d); },
    // small arms: a short, distant burst of rifle fire (soft, so a clash does not sound like knocking)
    mg() { const d = new Float32Array(Math.ceil(1 * SR)); let at = 0;
      for (let k = 0; k < 8; k++) { const s = env(noise(Math.ceil(0.12 * SR)), t => Math.min(1, t / 0.002) * Math.exp(-t * 45)); lp(s, 2600); hp(s, 500); mix(d, s, at, 0.6 + Math.random() * 0.4); at += 0.08 + Math.random() * 0.03; }
      lp(d, 3000); return norm(d, 0.7); },
    // a radio: the key clicks, a burst of static, the short "over" beep
    radio() { const d = new Float32Array(Math.ceil(0.45 * SR)); mix(d, env(noise(Math.ceil(0.004 * SR)), t => Math.exp(-t * 1500)), 0, 1);
      const h = env(noise(Math.ceil(0.3 * SR)), t => Math.min(1, t / 0.015) * (t < 0.2 ? 1 : Math.max(0, 1 - (t - 0.2) / 0.1))); hp(lp(h, 3400), 950); mix(d, h, 0.01, 0.55);
      mix(d, tone(0.07, () => 1450, t => 0.4 * Math.sin(Math.PI * Math.min(1, t / 0.07))), 0.34); return norm(d, 0.8); },
    // something fast overhead: a missile, a jet
    whoosh() { const L = 2, d = noise(Math.ceil(L * SR)), bell = t => Math.exp(-Math.pow((t - 0.95) / 0.38, 2)); lp(d, t => 300 + 2600 * bell(t)); hp(d, 180); env(d, bell); return norm(d); },
    // the nuclear blast: a crack, a sub-bass that you feel, a roar that takes seconds to die
    shock() { const L = 7, n = Math.ceil(L * SR), d = env(noise(n), t => Math.min(1, t / 0.03) * Math.exp(-t * 0.55));
      lp(d, t => 110 + 2400 * Math.exp(-t * 1.5)); lp(d, t => 110 + 2400 * Math.exp(-t * 1.5));
      const body = env(noise(n), t => Math.min(1, t / 0.12) * Math.exp(-t * 0.6)); lp(body, 60); lp(body, 60); mix(d, norm(body), 0, 1.1);
      return norm(sparse(d, 0.6, 6, 120, 0.15)); },
    // loops: no discrete thumps (they turn into a ticking clock), just rumble that swells and falls back
    bed() { const L = 9, n = Math.ceil(L * SR), d = lp(lp(noise(n), 100), 100), ph = [Math.random() * 6, Math.random() * 6, Math.random() * 6];
      env(d, t => 0.55 + 0.2 * Math.sin(t * 2.3 + ph[0]) + 0.15 * Math.sin(t * 4.5 + ph[1]) + 0.1 * Math.sin(t * 7.1 + ph[2]));
      for (let at = Math.random() * 0.8; at < L - 1.5; at += 1 + Math.random() * 2) { const s = env(noise(Math.ceil(2.2 * SR)), t => Math.min(1, t / 0.18) * Math.exp(-t * 1.6)); lp(s, 200); lp(s, 200); mix(d, norm(s), at, 0.25 + Math.random() * 0.25); }
      return norm(seamless(d, 8), 0.8); },
    engine() { const L = 5, n = Math.ceil(L * SR), d = lp(lp(noise(n), 110), 110); env(d, t => 0.8 + 0.2 * Math.sin(t * 2 * Math.PI * 9)); return norm(seamless(d, 4), 0.7); },
    // the sea up close: waves that build for a couple of seconds, break into a hiss of foam and draw back, three to a loop
    sea() { const L = 17, n = Math.ceil(L * SR), waves = [0.4, 5.9, 11.2].map(at => at + Math.random() * 0.6), sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
      const swell = t => { let s = 0; for (const w of waves) for (const at of [w, w + 16]) { const u = t - at; s += u < 0 ? 0 : u < 2.2 ? sm(u / 2.2) : Math.exp(-(u - 2.2) / 1.6); } return Math.min(1, s); };
      const d = noise(n); lp(d, t => 160 + 520 * swell(t)); lp(d, t => 160 + 520 * swell(t)); env(d, t => 0.25 + 0.75 * swell(t));
      const foam = noise(n); lp(foam, 4200); hp(foam, 1100); env(foam, t => { const s = swell(t); return 0.04 + 0.4 * s * s; }); mix(d, foam, 0, 0.9);
      return norm(seamless(d, 16), 0.7); },
  };
  const VARIANTS = { blast: 3, far: 2, gun: 3, pop: 2, flak: 2, mg: 2 };

  // a generated reverb: stereo noise falling away over 2.6 s, darker as it fades
  { const L = 2.6, n = Math.ceil(L * SR), b = actx.createBuffer(2, n, SR);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = rnd() * Math.pow(1 - i / n, 2.4); lp(d, t => 5000 * Math.exp(-t * 1.6) + 300); }
    verb.buffer = b; }

  // build one sound per tick so the first frames of the game are not held up
  const queue = []; for (const k of Object.keys(MAKE)) for (let v = 0; v < (VARIANTS[k] || 1); v++) queue.push([k, v]);
  let ready = false;
  const build = () => { const job = queue.shift(); if (!job) { ready = true; return; } const [k, v] = job; try { (buffers[k] = buffers[k] || [])[v] = toBuf(MAKE[k]()); } catch (e) {} setTimeout(build, 0); };
  setTimeout(build, 50);

  // ---------- playing ----------
  // dist: from the camera to the sound in globe units (1 = the planet's radius); pan: −1 left … 1 right
  function play(name, o = {}) {
    if (muted || actx.state !== 'running') return false;
    const set = buffers[name]; if (!set || !set.length) return false;
    const now = actx.currentTime, gap = o.gap ?? 0.06;
    if (lastAt[name] && now - lastAt[name] < gap) return false;
    const dist = Math.max(0, o.dist || 0), g = (o.gain ?? 1) * Math.min(1.1, 1.25 * Math.exp(-dist * 1.15));   // ~1 up close, ~0.3 over a usual view, almost nothing from far out
    if (g < 0.02 || (active > 16 && g < 0.25)) return false;
    lastAt[name] = now; active++;
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), pan = actx.createStereoPanner(), out = actx.createGain(), send = actx.createGain();
    src.buffer = set[(Math.random() * set.length) | 0]; src.playbackRate.value = (o.rate || 1) * (o.steady ? 1 : 0.94 + Math.random() * 0.12);   // explosions vary a little, tones keep their pitch
    f.type = 'lowpass'; f.frequency.value = Math.max(220, 14000 * Math.exp(-dist * 2.2));   // the farther, the duller: crisp up close, a thud from orbit f.Q.value = 0.5;
    pan.pan.value = Math.max(-1, Math.min(1, o.pan || 0));
    out.gain.value = g; send.gain.value = 0.12 + 0.4 * Math.min(1, dist / 2);
    src.connect(f).connect(pan).connect(out).connect(master); out.connect(send).connect(verbIn);
    const at = now + (o.delay ?? Math.min(1.6, dist * 0.55));
    src.start(at); src.onended = () => { active--; try { out.disconnect(); send.disconnect(); } catch (e) {} };
    return true;
  }
  // the beds under everything (battle, engines, sea): 0..1 each, eased so they swell and fade
  function ambience(level) {
    if (!ready) return;
    for (const k of ['bed', 'engine', 'sea']) {
      let L = loops[k];
      if (!L) { const src = actx.createBufferSource(), g = actx.createGain(), p = actx.createStereoPanner(); src.buffer = buffers[k][0]; src.loop = true; g.gain.value = 0; src.connect(p).connect(g).connect(master); src.start(); L = loops[k] = { g, p }; }
      const max = k === 'bed' ? 0.5 : k === 'sea' ? 0.13 : 0.22;
      L.g.gain.setTargetAtTime(muted ? 0 : Math.max(0, Math.min(1, level[k] || 0)) * max, actx.currentTime, 0.8);
      if (k === 'bed') L.p.pan.setTargetAtTime(Math.max(-0.7, Math.min(0.7, level.pan || 0)), actx.currentTime, 0.8);
    }
  }
  function setMuted(m) { muted = m; master.gain.setTargetAtTime(m ? 0 : 0.9, actx.currentTime, 0.1); }
  return { play, ambience, setMuted, get ready() { return ready; } };
}
