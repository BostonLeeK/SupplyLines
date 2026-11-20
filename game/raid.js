// Air raid: a short real-time defence of one city against a drone and missile raid in three waves.
// Pure and deterministic: the same params and the same inputs (stamped with the tick they were given on) always give
// the same result, so the server can replay what a player did and trust the outcome.
// Distances are in km, time in seconds. The defended city sits at (0, 0); x points east, y north.
//
// Before the fight (tick 0) the player buys a kit with a small budget and places the SAM site and the fire groups;
// then the waves come. Inputs: kit, place (only before the fight), fire, move, jam.

export const RAID = {
  DT: 1 / 30, R: 420, CITY_R: 7, SWEEP: 2.4, SWEEP_FAST: 1.7, HORIZON: 170, MAX_T: 150,
  TYPES: {
    shahed: { speed: 7.5, warhead: 1, link: true, guns: 0.3, pts: 100 },    // slow loitering drone on a radio link
    decoy: { speed: 7.5, warhead: 0, link: false, guns: 0.3, pts: 0 },      // looks the same on radar, carries nothing, has no link
    jet: { speed: 14, warhead: 1, link: true, guns: 0.06, pts: 150 },       // fast jet drone; its link hops between frequencies
    cruise: { speed: 24, warhead: 1, link: false, guns: 0, pts: 200 },      // flies low: radar sees it only inside the horizon
    hunter: { speed: 11, warhead: 0, link: true, guns: 0.2, pts: 120, hunts: true },   // goes for the fire groups, not the city
  },
  SAM_SPEED: 38, SAM_HIT: 0.9, SAM_FUSE: 2.5, SAM_TRACK: 1.25, SAM_RANGE: 190,
  GUN_RANGE: 34, GUN_SPEED: 7, GUN_REACH: 200, GUN_NIGHT: 0.6, GUN_LIGHT: 0.9, GUN_SHOT: 0.25,
  JAM_BW: 0.045, JAM_HOLD: 1.1, JAM_DRAIN: 0.14, JAM_CHARGE: 0.07, JAM_CRASH: 2.6, HOP_EVERY: 2.3, DF_SHOW: 1.6,
  DEPLOY_REACH: 130, HUNT_HIT: 3, COMBO_T: 2.2, LEAK_PTS: 250, DECOY_PTS: 80,
  // what the budget buys before the fight
  KIT: {
    sam: { cost: 2, max: 2 },      // +2 SAMs each
    group: { cost: 3, max: 1 },    // one more fire group
    cells: { cost: 2, max: 1 },    // +50% jammer battery
    radar: { cost: 3, max: 1 },    // a faster sweep
    lights: { cost: 2, max: 1 },   // searchlights: fire groups see almost as well at night
  },
};

// a small seeded random generator (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const D2R = Math.PI / 180;
export const polar = (bearing, km) => [km * Math.sin(bearing * D2R), km * Math.cos(bearing * D2R)];
export const bearingOf = (x, y) => (Math.atan2(x, y) / D2R + 360) % 360;
export const kitCost = k => Object.entries(k || {}).reduce((a, [n, v]) => a + (RAID.KIT[n] ? RAID.KIT[n].cost * (v | 0) : 0), 0);

// who flies, from where and when. p: { seed, bearings: directions of enemy territory (deg), size: 1 for a strike, more for a swarm }
export function planRaid(p) {
  const r = rng(p.seed), B = p.bearings && p.bearings.length ? p.bearings : [r() * 360], size = p.size || 1;
  const n = k => Math.max(1, Math.round(k * size)), pick = () => B[(r() * B.length) | 0] + (r() - 0.5) * 50;
  const targets = [], links = [], waves = [{ at: 0.5, n: 0 }, { at: 21, n: 0 }, { at: 41, n: 0 }]; let id = 1;
  const mk = (type, bearing, dist, at, link, wave) => {
    const wp = [];
    if (type !== 'cruise' && type !== 'hunter') wp.push(polar(bearing + (r() - 0.5) * 70, dist * (0.45 + r() * 0.2)));   // a dogleg, so they never come straight in
    wp.push([0, 0]);
    targets.push({ id: id++, type, at, pos: polar(bearing, dist), wp, link, wave }); waves[wave].n++;
  };
  const link = hop => { links.push({ id: links.length, freq: 0.08 + r() * 0.84, hop }); return links.length - 1; };
  const swarm = (wave, k, from, to) => { for (let g = 0; g < k; g++) { const b = pick(), lk = link(false), at = waves[wave].at + g * 4; for (let j = 0; j < 3; j++) mk('shahed', b + (r() - 0.5) * 16, from + r() * (to - from), at + j * 1.2 + r(), lk, wave); } };
  // wave 1: drones close enough to matter at once, with decoys mixed in
  swarm(0, n(2), 210, 280);
  for (let k = 0; k < n(2); k++) mk('decoy', pick(), 210 + r() * 80, 1 + r() * 6, -1, 0);
  // wave 2: fast jets on a hopping link, a hunter for the fire groups, more drones
  swarm(1, n(1), 300, 380);
  { const b = pick(), lk = link(true); for (let k = 0; k < n(2); k++) mk('jet', b + (r() - 0.5) * 20, 400, waves[1].at + 2 + k * 3 + r() * 2, lk, 1); }
  mk('hunter', pick(), 330, waves[1].at + 4 + r() * 3, link(false), 1);
  mk('decoy', pick(), 300 + r() * 80, waves[1].at + r() * 6, -1, 1);
  // wave 3: the finale, a cruise missile salvo under a last drone group
  swarm(2, n(1), 260, 330);
  for (let k = 0; k < n(3); k++) mk('cruise', pick(), RAID.R, waves[2].at + 3 + k * 2.5 + r() * 2, -1, 2);
  targets.sort((a, b) => a.at - b.at);
  return { targets, links, waves };
}

// params: { seed, bearings, size, night, sams, groups, battery, budget }
export function createRaid(params) {
  const P = { sams: 6, groups: 3, battery: 1, size: 1, night: false, budget: 6, ...params };
  const R = rng((P.seed ^ 0x9e3779b9) >>> 0), plan = planRaid(P);
  const B = P.bearings && P.bearings.length ? P.bearings : [0];
  const group = (g, n) => { const [x, y] = polar(g * 360 / n + 30, 45); return { id: g, x, y, tx: x, ty: y, cd: 0, shot: null, dead: false, moving: false }; };
  const S = {
    t: 0, tick: 0, sweep: 0, sweepT: RAID.SWEEP, done: false, started: false,
    sams: P.sams, samsMax: P.sams, site: polar(B[0], 25), kit: {}, lights: false,
    pending: plan.targets.map(x => ({ ...x, wp: x.wp.map(w => w.slice()), pos: x.pos.slice() })), waves: plan.waves, wave: -1,
    targets: [], missiles: [], fx: [], fxN: 0,
    links: plan.links.map(l => ({ ...l, hopT: RAID.HOP_EVERY, hold: 0, df: -99 })),
    groups: Array.from({ length: P.groups }, (_, g) => group(g, P.groups)),
    jam: { f: 0.5, on: false, battery: P.battery, max: P.battery },
    points: 0, chain: 0, lastKill: -99,
    stats: { warheads: plan.targets.filter(x => RAID.TYPES[x.type].warhead).length, total: plan.targets.length, leaks: 0, decoysIn: 0, kills: { sam: 0, guns: 0, ew: 0 }, fired: 0, wasted: 0, jammedLinks: 0, lastLine: 0, bestChain: 0, groupsLost: 0, hunterDown: 0 },
  };
  const queue = [], log = [];
  const fx = (k, x, y, extra) => S.fx.push({ k, x, y, t: S.t, n: ++S.fxN, ...extra });
  const kill = (m, how) => {
    m.dead = true; S.stats.kills[how]++;
    const T = RAID.TYPES[m.type];
    S.chain = S.t - S.lastKill <= RAID.COMBO_T ? S.chain + 1 : 1; S.lastKill = S.t; S.stats.bestChain = Math.max(S.stats.bestChain, S.chain);
    const mult = Math.min(3, 1 + 0.25 * (S.chain - 1)), pts = m.type === 'decoy' && how === 'sam' ? -RAID.DECOY_PTS : Math.round(T.pts * mult);
    S.points += pts; if (m.type === 'hunter') S.stats.hunterDown++;
    fx('kill', m.x, m.y, { how, type: m.type, pts, chain: S.chain });
    if (Math.hypot(m.x, m.y) < 25 && T.warhead) S.stats.lastLine++;
  };
  const tracked = m => !m.dead && m.seen !== undefined && S.t - m.seen <= S.sweepT * RAID.SAM_TRACK;
  const inSamRange = m => { const p = m.paints[m.paints.length - 1]; return !!p && Math.hypot(p[0] - S.site[0], p[1] - S.site[1]) <= RAID.SAM_RANGE; };
  const clampTo = (x, y, r) => { const d = Math.hypot(x, y); return d > r ? [x * r / d, y * r / d] : [x, y]; };

  function setKit(k) {
    const kit = {}; for (const [n, c] of Object.entries(RAID.KIT)) kit[n] = Math.max(0, Math.min(c.max, (k && k[n]) | 0));
    if (kitCost(kit) > P.budget) return false;
    S.kit = kit;
    S.sams = S.samsMax = P.sams + 2 * kit.sam;
    const want = P.groups + kit.group; while (S.groups.length < want) S.groups.push(group(S.groups.length, want)); S.groups.length = want;
    S.jam.max = S.jam.battery = P.battery * (1 + 0.5 * kit.cells);
    S.sweepT = kit.radar ? RAID.SWEEP_FAST : RAID.SWEEP; S.lights = !!kit.lights;
    return true;
  }
  function apply(a) {
    if (a.a === 'kit') return !S.started && setKit(a.kit);
    if (a.a === 'place') {
      if (S.started) return false;
      const [x, y] = clampTo(+a.x || 0, +a.y || 0, RAID.DEPLOY_REACH);
      if (a.what === 'site') { S.site = [x, y]; return true; }
      const g = S.groups[a.g | 0]; if (!g) return false; g.x = g.tx = x; g.y = g.ty = y; return true;
    }
    if (a.a === 'fire') {
      const m = S.targets.find(x => x.id === a.id); if (!m || !tracked(m) || S.sams <= 0 || !inSamRange(m)) return false;
      if (S.missiles.some(x => x.id === m.id && !x.done)) return false;   // one missile per target at a time
      S.sams--; S.stats.fired++; if (!RAID.TYPES[m.type].warhead && m.type !== 'hunter') S.stats.wasted++;
      S.missiles.push({ id: m.id, x: S.site[0], y: S.site[1], t0: S.t, done: false, trail: [] }); fx('launch', S.site[0], S.site[1], { id: m.id }); return true;
    }
    if (a.a === 'move') {
      const g = S.groups[a.g | 0]; if (!g || g.dead) return false;
      [g.tx, g.ty] = clampTo(+a.x || 0, +a.y || 0, RAID.GUN_REACH); return true;
    }
    if (a.a === 'jam') { S.jam.on = !!a.on && S.jam.battery > 0.02; if (a.f !== undefined) S.jam.f = Math.max(0, Math.min(1, +a.f)); return true; }
    return false;
  }
  // inputs are applied at the start of the next tick and logged with it, so a replay matches exactly
  function input(a) { queue.push(a); }
  // before the fight the deploy screen needs its choices to show at once
  function deployNow() { if (S.started) return; for (const a of queue.splice(0)) if (apply(a)) log.push([S.tick, a]); }

  function step() {
    if (S.done) return;
    for (const a of queue.splice(0)) if (apply(a)) log.push([S.tick, a]);
    S.started = true;
    const dt = RAID.DT, prevSweep = S.sweep; S.t += dt; S.tick++;
    S.sweep = (S.t / S.sweepT * 360) % 360;
    while (S.wave + 1 < S.waves.length && S.waves[S.wave + 1].at <= S.t) { S.wave++; fx('wave', 0, 0, { wave: S.wave, n: S.waves[S.wave].n }); }
    while (S.pending.length && S.pending[0].at <= S.t) { const m = S.pending.shift(); S.targets.push({ ...m, x: m.pos[0], y: m.pos[1], paints: [], heading: 0 }); }
    // the radar paints whatever the beam crosses
    const crossed = b => prevSweep <= S.sweep ? b > prevSweep && b <= S.sweep : b > prevSweep || b <= S.sweep;
    for (const m of S.targets) {
      if (m.dead) continue;
      const d = Math.hypot(m.x, m.y);
      if (d <= RAID.R && (m.type !== 'cruise' || d <= RAID.HORIZON) && crossed(bearingOf(m.x, m.y))) {
        if (m.seen === undefined) fx('contact', m.x, m.y, { type: m.type, id: m.id });
        m.seen = S.t; m.paints.push([m.x, m.y, S.t]); if (m.paints.length > 6) m.paints.shift();
      }
    }
    // flight
    for (const m of S.targets) {
      if (m.dead) continue;
      const T = RAID.TYPES[m.type];
      if (m.jammed !== undefined) {   // lost its link: wanders and falls
        m.heading += (R() - 0.5) * 0.3; m.x += Math.sin(m.heading) * T.speed * 0.6 * dt; m.y += Math.cos(m.heading) * T.speed * 0.6 * dt;
        if (S.t >= m.crashAt) { kill(m, 'ew'); fx('crash', m.x, m.y); }
        continue;
      }
      if (T.hunts) {   // the hunter steers for the nearest live fire group
        let g = null, gd = Infinity; for (const x of S.groups) if (!x.dead) { const d = Math.hypot(x.x - m.x, x.y - m.y); if (d < gd) { gd = d; g = x; } }
        m.wp = [g ? [g.x, g.y] : [0, 0]]; m.prey = g ? g.id : -1;
        if (g && gd <= RAID.HUNT_HIT) { g.dead = true; m.dead = true; S.stats.groupsLost++; fx('groupLost', g.x, g.y, { g: g.id }); continue; }
      }
      const w = m.wp[0], dx = w[0] - m.x, dy = w[1] - m.y, d = Math.hypot(dx, dy), v = T.speed * dt;
      if (d <= v) { m.x = w[0]; m.y = w[1]; if (m.wp.length > 1) m.wp.shift(); } else { m.x += dx / d * v; m.y += dy / d * v; m.heading = Math.atan2(dx, dy); }
      if (Math.hypot(m.x, m.y) <= RAID.CITY_R) {
        m.dead = true;
        if (T.warhead) { S.stats.leaks++; S.points -= RAID.LEAK_PTS; S.chain = 0; fx('leak', m.x, m.y, { type: m.type, pts: -RAID.LEAK_PTS }); } else { S.stats.decoysIn++; fx('dud', m.x, m.y); }
      }
    }
    // radio links: jet links hop; a jammer sitting on a link long enough cuts it
    const J = S.jam;
    if (J.on) { J.battery = Math.max(0, J.battery - RAID.JAM_DRAIN * dt); if (J.battery <= 0) { J.on = false; fx('flat', 0, 0); } }
    else J.battery = Math.min(J.max, J.battery + RAID.JAM_CHARGE * dt);
    for (const l of S.links) {
      const live = S.targets.filter(m => m.link === l.id && !m.dead && m.jammed === undefined);
      if (!live.length) { l.hold = 0; continue; }
      if (l.hop && (l.hopT -= dt) <= 0) { l.freq = 0.06 + R() * 0.88; l.hopT = RAID.HOP_EVERY * (0.8 + R() * 0.4); l.hold = 0; }
      if (J.on && Math.abs(l.freq - J.f) <= RAID.JAM_BW) {
        l.df = S.t; l.hold += dt;
        if (l.hold >= RAID.JAM_HOLD) {
          l.hold = 0; S.stats.jammedLinks++; fx('linkCut', 0, 0, { link: l.id, n: live.length });
          for (const m of live) { m.jammed = S.t; m.crashAt = S.t + RAID.JAM_CRASH * (0.7 + R() * 0.6); m.heading = (m.heading || 0) + (R() - 0.5) * 2.4; fx('jam', m.x, m.y); }
        }
      } else l.hold = Math.max(0, l.hold - dt * 2);
    }
    // fire groups drive to their spot and shoot at slow things in range (worse at night unless they brought lights)
    const seeing = P.night ? (S.lights ? RAID.GUN_LIGHT : RAID.GUN_NIGHT) : 1;
    for (const g of S.groups) {
      g.shot = null; if (g.dead) continue;
      const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy), v = RAID.GUN_SPEED * dt;
      if (d > v) { g.x += dx / d * v; g.y += dy / d * v; g.moving = true; } else { g.x = g.tx; g.y = g.ty; g.moving = false; }
      g.cd -= dt;
      let best = null, bd = RAID.GUN_RANGE;
      for (const m of S.targets) { if (m.dead) continue; const dd = Math.hypot(m.x - g.x, m.y - g.y); if (dd < bd && RAID.TYPES[m.type].guns > 0) { bd = dd; best = m; } }
      if (best) {
        g.shot = best.id;
        if (g.cd <= 0) { g.cd = RAID.GUN_SHOT; const p = RAID.TYPES[best.type].guns * seeing * (g.moving ? 0.5 : 1) * RAID.GUN_SHOT; if (R() < p) kill(best, 'guns'); }
      }
    }
    // interceptors home on the real target
    for (const s of S.missiles) {
      if (s.done) continue;
      const m = S.targets.find(x => x.id === s.id);
      if (!m || m.dead) { if (S.t - (s.lost || (s.lost = S.t)) > RAID.SAM_FUSE) { s.done = true; fx('fizzle', s.x, s.y); } else { s.x += (s.vx || 0) * dt; s.y += (s.vy || 0) * dt; } continue; }
      const dx = m.x - s.x, dy = m.y - s.y, d = Math.hypot(dx, dy), v = RAID.SAM_SPEED * dt;
      s.vx = dx / d * RAID.SAM_SPEED; s.vy = dy / d * RAID.SAM_SPEED;
      if (d <= v) { s.done = true; s.x = m.x; s.y = m.y; if (R() < RAID.SAM_HIT) kill(m, 'sam'); else fx('miss', m.x, m.y); }
      else { s.x += dx / d * v; s.y += dy / d * v; }
      s.trail.push([s.x, s.y]); if (s.trail.length > 18) s.trail.shift();
    }
    if (S.fx.length > 120) S.fx.splice(0, S.fx.length - 120);
    if ((!S.pending.length && !S.targets.some(m => !m.dead) && !S.missiles.some(s => !s.done)) || S.t >= RAID.MAX_T) { S.done = true; fx('end', 0, 0); }
  }
  function result() { return scoreRaid(S); }
  return { S, P, plan, step, input, deployNow, log, result, tracked, inSamRange };
}

// the verdict: what got through decides the damage; points, rating and medals are for the player
export function scoreRaid(S) {
  const st = S.stats, down = st.kills.sam + st.kills.guns + st.kills.ew, shareOut = st.warheads ? st.leaks / st.warheads : 0;
  const rating = st.leaks === 0 ? (st.wasted === 0 ? 'S' : 'A') : st.leaks <= 2 ? 'B' : st.leaks <= 5 ? 'C' : 'D';
  const medals = [];
  if (st.leaks === 0) medals.push('clear');
  if (st.fired >= 3 && st.wasted === 0 && st.kills.sam === st.fired) medals.push('sniper');
  if (st.kills.ew >= 6) medals.push('jammer');
  if (st.lastLine >= 2) medals.push('lastline');
  if (st.bestChain >= 4) medals.push('salvo');
  if (st.hunterDown && !st.groupsLost) medals.push('hunter');
  // missiles left over only count when nothing got through, so holding fire never pays
  const score = Math.max(0, S.points + (st.leaks ? 0 : 500 + 60 * S.sams));
  return { leaks: st.leaks, warheads: st.warheads, total: st.total, down, kills: { ...st.kills }, fired: st.fired, wasted: st.wasted, samsLeft: S.sams, jammedLinks: st.jammedLinks, decoysIn: st.decoysIn, groupsLost: st.groupsLost, bestChain: st.bestChain, rating, medals, score, shareOut: +shareOut.toFixed(3), time: +S.t.toFixed(1) };
}

// the server's check: rerun a raid from its params and the player's logged inputs
export function replayRaid(params, log) {
  const r = createRaid(params); let k = 0;
  while (!r.S.done) { while (k < log.length && log[k][0] === r.S.tick) r.input(log[k++][1]); r.step(); }
  return r.result();
}
