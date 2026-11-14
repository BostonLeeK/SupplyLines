// Supply Lines game engine: pure simulation, no DOM, no rendering.
// Used by the browser (offline practice, and as a mirror of the server state) and by the server.
// All times are in sim-seconds; a season is SEASON sim-seconds = 7 game days.

export const K = {
  SEASON: 900, SPEED: [230, 360, 950],
  PROD: [0, 0.35, 0.7, 1.25], CAPT: [0, 80, 150, 260], NEUTRAL: [0, 12, 26, 48], VALUE: [0, 1, 3, 6],
  CP_BASE: 10, CP_REGEN: 3, AIR_CAP: 40, BOT_RATE: 0.011,
  REGION_BONUS: 8, FORT_MULT: 1.6, FORT_TIME: 100, FORT_COST: 2,
  SAB_MULT: 0.7, SAB_TIME: 86, SAB_COST: 3, DROP_COST: 3, DROP_KM: 3500, DROP_CAP: 30, RALLY_TIME: 120,
  CMDR_MULT: 1.15, NCAP_MAX: 3, BLOCK_COST: 3, BLOCK_TIME: 86, AA_KM: 1500, AA_LOSS: 0.4,
  STORM_SLOW: 0.4, STORM_EVERY: 70, STORM_MAX: 3, FOG_KM: 1200,
  NUKE_HUBS: 3, NUKE_COST: 120, NUKE_BOT_RATE: 0.0011, NUKE_DECAY: 0.004, NUKE_RANGE: 8000, NUKE_BLAST: 500, NUKE_FLIGHT: 75,
  NUKE_ARM_WINDOW: 20, NUKE_HQ_DELAY: 12, NUKE_AA_PER_HUB: 0.25, NUKE_AA_KM: 2000, NUKE_AA_BOOST: 0.15, NUKE_AA_MAX: 0.75, NUKE_AA_COST: 3,
  NUKE_PENALTY: 25, NUKE_RAGE: 128,
  SQUAD_MAX: 6, COMBO_TIME: 20, COMBO_MULT: 1.15,
  MARK_MAX: 3, MARK_ATK: 1.15, MARK_DEF: 1.2,
  SAT_COST: 4, SAT_KM: 2200, SAT_TIME: 90, SAT_MAX: 2, SPY_COST: 2, SPY_TIME: 150, SPY_CATCH: 0.25,
  ENVOY_COST: 3, ENVOY_GAIN: 40, ENVOY_RIVAL: 5, BETRAY_GIFT: 30, ALLY_BONUS: 1.2,
  FLEET_COST: 4, FLEET_TROOPS: 30, FLEET_SPEED: 280, FLEET_MAX_FACTION: 6, FLEET_MAX_PLAYER: 2, FLEET_POWER: 1.5, FLEET_SHORE: 0.004, FLEET_SIEGE: 1.25,
};
K.GMIN = 7 * 1440 / K.SEASON; // game minutes per sim-second

export const FN = ['Atlantica', 'Pacifica'];
export const GEVENTS = {
  oil: { name: 'Oil shock', icon: '⛽', text: 'Oil prices explode. Oil fields count double; a faction without oil moves convoys at ×0.7.' },
  crop: { name: 'Crop failure', icon: '🌾', text: 'Harvests fail worldwide. A faction without grain fields produces troops at ×0.75.' },
  solar: { name: 'Solar storm', icon: '☀', text: 'A geomagnetic storm grounds every aircraft: air routes and airdrops are closed.' },
  summit: { name: 'Peace summit', icon: '🕊', text: 'The free nations meet. Envoys cost 1 CP and win 50% more favour.' },
  hurricane: { name: 'Hurricane season', icon: '🌀', text: 'Storms form three times as often at sea, up to five at once.' },
  arms: { name: 'Arms fair', icon: '⚙', text: 'Command points regenerate twice as fast for everyone.' },
  disarm: { name: 'Disarmament talks', icon: '☮', text: 'Nuclear programs are frozen and no launch can be prepared today.' },
  rally: { name: 'Patriotic wave', icon: '✊', text: 'The faction that is behind finds new resolve: +25% troop production.' },
};
export const GDAY = 900 / 7;
export const CONVOY = { std: { name: 'Standard', speed: 1, power: 1, cost: 0 }, fast: { name: 'Fast', speed: 1.7, power: 0.75, cost: 0 }, heavy: { name: 'Heavy', speed: 0.6, power: 1.35, cost: 1 } };
export const RESOURCES = {
  u: { name: 'Uranium', icon: '☢', sites: ['Astana', 'Almaty', 'Krasnoyarsk', 'Perth', 'Winnipeg', 'Denver', 'Johannesburg', 'Kano'] },
  o: { name: 'Oil', icon: '⛽', sites: ['Riyadh', 'Dubai', 'Baghdad', 'Houston', 'Caracas', 'Lagos', 'Baku', 'Tyumen', 'Aktau', 'Muscat'] },
  g: { name: 'Grain', icon: '🌾', sites: ['Kyiv', 'Odesa', 'Krasnodar', 'Chicago', 'Buenos Aires', 'Lahore', 'Dhaka', 'Wuhan', 'Melbourne'] },
};
export const REGIONS = ['Europe', 'Caucasus', 'Middle East', 'Africa', 'Central Asia', 'South Asia', 'Southeast Asia', 'East Asia', 'Oceania', 'North America', 'South America', 'Volga–Ural', 'Siberia & Far East', 'The North'];
const ADJ = ['Brave', 'Quiet', 'Swift', 'Grey', 'Iron', 'Fierce', 'Wise', 'Night', 'Steppe', 'Sea', 'Sly', 'Free'];
const ANI = ['Badger', 'Falcon', 'Wolf', 'Hedgehog', 'Fox', 'Eagle', 'Bison', 'Catfish', 'Lynx', 'Hawk', 'Beaver', 'Stag'];
export const randomName = (rnd = Math.random) => ADJ[(rnd() * ADJ.length) | 0] + ' ' + ANI[(rnd() * ANI.length) | 0] + ' #' + (1000 + ((rnd() * 9000) | 0));

export const RANKS = [[0, 'Private'], [50, 'Corporal'], [150, 'Sergeant'], [300, 'Lieutenant'], [500, 'Captain'], [800, 'Major'], [1200, 'Colonel'], [1800, 'General']];
export const TRAILS = {
  std: { name: 'Standard', rank: 0, text: 'A short faction-coloured tail.' },
  comet: { name: 'Comet', rank: 1, text: 'A long, fading comet tail.' },
  ember: { name: 'Ember', rank: 2, text: 'A white-hot head cooling to orange.' },
  spark: { name: 'Sparks', rank: 3, text: 'Sparks fly off your convoys.' },
  pulse: { name: 'Pulse', rank: 4, text: 'Your convoys beat like a heart.' },
  aurora: { name: 'Aurora', rank: 5, text: 'A tail that shifts from cyan to violet.' },
  gold: { name: 'Gold', rank: 6, text: 'A gilded tail for veterans.' },
  star: { name: 'Supernova', rank: 7, text: 'A blazing star with a golden wake. Generals only.' },
};
export const rankOf = xp => { let k = 0; while (k + 1 < RANKS.length && xp >= RANKS[k + 1][0]) k++; return { idx: k, name: RANKS[k][1], next: RANKS[k + 1] ? RANKS[k + 1][1] : null, nextXp: RANKS[k + 1] ? RANKS[k + 1][0] : null }; };
export const MISSIONS = [
  { id: 'cap3', text: 'Capture 3 cities', goal: 3 },
  { id: 'big', text: 'Capture a large city or megahub', goal: 1 },
  { id: 'clash', text: 'Win a convoy clash', goal: 1 },
  { id: 'fortfront', text: 'Fortify a city on the front line', goal: 1 },
  { id: 'sab', text: 'Sabotage an enemy city', goal: 1 },
  { id: 'block', text: 'Blockade an enemy port', goal: 1 },
  { id: 'drop', text: 'Take a city with an airdrop', goal: 1 },
  { id: 'far', text: 'Capture a city 5,000 km from your capital', goal: 1 },
  { id: 'region', text: 'Capture a city in {R}', goal: 1 },
  { id: 'send10', text: 'Send 10 convoys', goal: 10 },
];
export const XP = { MISSION: 50, CAPTURE: 5, WIN: 30 };
const D = Math.PI / 180;
export const unit = (lat, lng) => { const p = (lng + 180) * D, t = (90 - lat) * D; return [-Math.cos(p) * Math.sin(t), Math.cos(t), Math.sin(p) * Math.sin(t)]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function regionOf(c) {
  const n = c.nation, lat = c.lat, lng = c.lng;
  if (n >= 0) { if (n === 20) return 0; if ([0, 1, 2, 3, 4, 5, 21].includes(n)) return 1; if ([6, 7, 8, 9, 10, 11, 24].includes(n)) return 11; if ([15, 16, 17, 18, 19, 22, 23].includes(n)) return 12; return 13; }
  if (lng > 40 && lng < 50.5 && lat > 38 && lat < 45) return 1;
  if (lng < -30) return lat >= 13 ? 9 : 10;
  if (lng > 100 && (lat < -20 || (lng > 140 && lat < 0))) return 8;
  if (lng > 34 && lng < 60 && lat > 12 && lat < 37.5) return 2;
  if (lat >= 37.5 && lng < 45) return 0;
  if (lng >= 45 && lng < 91 && lat >= 35) return 4;
  if (lng >= 60 && lng < 92 && lat < 35) return 5;
  if (lng >= 91 && lat < 21.5) return 6;
  if (lng >= 91) return 7;
  return 3;
}

export function createEngine(NET, opts = {}) {
  const cities = NET.cities.map(([name, lat, lng, tier, port, , nation], i) => ({ i, name, lat, lng, tier, port, nation, u: unit(lat, lng) }));
  const N = cities.length;
  const byName = n => cities.findIndex(c => c.name === n);
  const CAPS = [byName(opts.capA || 'Toronto'), byName(opts.capB || 'Shanghai')];
  for (const c of cities) { c.cap = c.i === CAPS[0] ? 0 : c.i === CAPS[1] ? 1 : -1; c.region = regionOf(c); }
  { const seen = new Set(); for (const c of cities) if (c.nation >= 0 && !seen.has(c.nation)) { seen.add(c.nation); c.ncap = true; } }
  for (const [k, r] of Object.entries(RESOURCES)) for (const n of r.sites) { const c = cities.find(x => x.name === n); if (c) c.res = k; }
  const hubs = cities.filter(c => c.tier === 3).map(c => c.i);
  const edges = NET.edges.map(([a, b, type, km], i) => ({ i, a, b, type, km, convoys: [] }));
  const adj = Array.from({ length: N }, () => []);
  for (const e of edges) { adj[e.a].push({ to: e.b, e }); adj[e.b].push({ to: e.a, e }); }
  const regionCities = REGIONS.map((_, r) => cities.filter(c => c.region === r).map(c => c.i));
  const NN = (NET.nations || []).length, nationCities = Array.from({ length: NN }, (_, n) => cities.filter(c => c.nation === n).map(c => c.i));
  const kmBetween = (a, b) => Math.acos(Math.min(1, dot(cities[a].u, cities[b].u))) * 6371;

  const S = { simT: 0, ended: false };            // state that gets mirrored to clients
  const players = new Map();                       // id -> player
  let botAcc, nextSupply, nextBotOrder, nextHist, orderUntil, heroes, convoySeq = 1, alertAt, nextStorm = 20;
  const listeners = [];
  const emit = ev => { for (const l of listeners) l(ev); };
  const E = { K, cities, edges, adj, N, CAPS, regionCities, S, players, kmBetween, bots: [300, 300], onEvent: cb => listeners.push(cb) };

  // ---------- setup ----------
  E.reset = () => {
    S.owner = new Int8Array(N).fill(-1); S.troops = new Float32Array(N); S.supplied = new Uint8Array(N); S.frontDist = new Int16Array(N);
    S.fort = new Float32Array(N); S.sab = new Float32Array(N); S.heat = new Float32Array(edges.length);
    S.regionHeld = REGIONS.map(() => -1); S.mobil = [1, 1]; S.orders = [-1, -1]; S.history = []; S.convoys = [];
    S.frames = []; S.fleets = []; S.marks = []; S.chief = [null, null]; S.sats = []; S.spies = []; S.gev = null; S.gevDay = 0; S.gevUsed = []; S.favour = Array.from({ length: NN }, () => [0, 0]); S.rad = new Uint8Array(N); S.penalty = [0, 0]; S.rage = [0, 0]; S.strikes = 0; S.winter = false; S.missiles = [];
    S.nuke = [0, 1].map(() => ({ prog: 0, ready: false, used: false, arm: null, rate: 0.7 + Math.random() * 0.7 }));
    S.cmdr = new Array(N).fill(''); S.block = new Float32Array(N); S.blockBy = new Int8Array(N).fill(-1); S.storms = []; nextStorm = 20;
    for (const e of edges) e.storm = false;
    S.simT = 0; S.ended = false; S.season = (S.season || 0) + 1;
    orderUntil = [-1, -1]; botAcc = [0, 0]; nextSupply = 0; nextBotOrder = 0; nextHist = 0; alertAt = new Float32Array(N).fill(-99);
    heroes = []; for (let f = 0; f < 2; f++) for (let k = 0; k < 40; k++) heroes.push({ name: randomName(), f, caps: 0, skill: Math.pow(Math.random(), 2.2) + 0.05 });
    for (const e of edges) e.convoys.length = 0;
    for (const c of cities) S.troops[c.i] = K.NEUTRAL[c.tier];
    for (let f = 0; f < 2; f++) { const c = CAPS[f]; S.owner[c] = f; S.troops[c] = 70; for (const { to } of adj[c]) if (S.owner[to] < 0) { S.owner[to] = f; S.troops[to] = 18; } }
    for (const p of players.values()) resetStats(p);
    computeSupply(); computeFront(); pickOrders(true);
    emit({ k: 'start', season: S.season });
  };
  const resetStats = p => Object.assign(p, { nukeCp: 0, cp: K.CP_BASE, caps: 0, sent: 0, clashes: 0, forts: 0, sabs: 0, drops: 0, blocks: 0, captured: [], far: null, missions: pickMissions() });
  function pickMissions() {
    const pool = MISSIONS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    return pool.map(m => { const r = (Math.random() * REGIONS.length) | 0; return { id: m.id, text: m.text.replace('{R}', REGIONS[r]), goal: m.goal, prog: 0, done: false, r }; });
  }
  function progress(p, id, test = () => true, amt = 1) {
    if (!p || !p.missions) return;
    for (const m of p.missions) if (m.id === id && !m.done && test(m)) {
      m.prog = Math.min(m.goal, m.prog + amt);
      if (m.prog >= m.goal) { m.done = true; p.xp += XP.MISSION; emit({ k: 'mission', who: p.pub, text: m.text, xp: XP.MISSION }); }
    }
  }
  E.rankOf = rankOf;

  const pubOf = who => { const p = players.get(who); return p ? p.pub : who; };
  // ---------- squads ----------
  const SQ_A = ['Iron', 'Night', 'Steel', 'Red', 'Silent', 'Grey', 'Storm', 'Wild', 'Frost', 'Black', 'Swift', 'Lone'], SQ_B = ['Wolves', 'Owls', 'Foxes', 'Hornets', 'Ravens', 'Bears', 'Lynxes', 'Falcons', 'Sharks', 'Badgers', 'Vipers', 'Herons'];
  const squads = new Map(); E.squads = squads; const squadHit = new Map();
  E.squadMembers = code => [...players.values()].filter(p => p.squad === code);
  E.createSquad = (pid, name) => {
    const p = players.get(pid); if (!p) return { ok: false, msg: 'Unknown player' };
    if (p.squad && squads.has(p.squad)) return { ok: false, msg: 'You are already in a squad' };
    let code; do code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join(''); while (squads.has(code));
    squads.set(code, { code, f: p.f, name: name || SQ_A[(Math.random() * SQ_A.length) | 0] + ' ' + SQ_B[(Math.random() * SQ_B.length) | 0] });
    p.squad = code; delete p.pendingSquad; emit({ k: 'squad', f: p.f, code, who: p.pub, name: p.name, act: 'create' }); return { ok: true, code };
  };
  E.joinSquad = (pid, code) => {
    const p = players.get(pid), sq = squads.get(code); if (!p || !sq) return { ok: false, msg: 'This invite link is no longer valid' };
    if (p.squad === code) return { ok: true, already: true };
    if (E.squadMembers(code).length >= K.SQUAD_MAX) return { ok: false, msg: `${sq.name} is full (${K.SQUAD_MAX} players)` };
    if (p.f !== sq.f) {
      const fresh = !p.sent && !p.caps && !S.cmdr.includes(pid);
      if (!fresh) { p.pendingSquad = code; return { ok: true, pending: true, msg: `You will join ${sq.name} (${['Atlantica', 'Pacifica'][sq.f]}) when the next season starts` }; }
      p.f = sq.f;
    }
    p.squad = code; delete p.pendingSquad; emit({ k: 'squad', f: p.f, code, who: p.pub, name: p.name, act: 'join' }); return { ok: true, switched: true };
  };
  E.applyPendingSquads = () => { for (const p of players.values()) if (p.pendingSquad && squads.has(p.pendingSquad)) { const sq = squads.get(p.pendingSquad); if (E.squadMembers(sq.code).length < K.SQUAD_MAX) { p.f = sq.f; p.squad = sq.code; } delete p.pendingSquad; } };
  E.squadInfo = p => { const sq = p && p.squad && squads.get(p.squad); if (!sq) return p && p.pendingSquad && squads.has(p.pendingSquad) ? { pending: squads.get(p.pendingSquad).name } : null; return { code: sq.code, name: sq.name, f: sq.f, members: E.squadMembers(sq.code).map(m => ({ name: m.name, pub: m.pub, online: !!m.online, caps: m.caps || 0, rank: rankOf(m.xp || 0).name })).sort((a, b) => b.online - a.online || b.caps - a.caps) }; };
  E.pubOf = pubOf;
  E.addPlayer = (id, f, name, pub, xp = 0) => { const p = { id, pub: pub || Math.random().toString(16).slice(2, 10), f, name: name || randomName(), online: true, xp }; resetStats(p); players.set(id, p); return p; };
  E.resHeld = f => { const r = { u: 0, o: 0, g: 0 }; for (const c of cities) if (c.res && S.owner[c.i] === f && S.supplied[c.i]) r[c.res]++; return r; };
  E.ge = k => !!S.gev && S.gev.k === k && S.simT < S.gev.until;
  E.oilMult = f => { const n = E.resHeld(f).o, x = E.ge('oil') ? 2 : 1; return n ? 1 + Math.min(0.3 * x, n * 0.05 * x) : E.ge('oil') ? 0.7 : 0.85; };
  E.grainMult = f => { const n = E.resHeld(f).g; return (n ? 1 + Math.min(0.25, n * 0.04) : E.ge('crop') ? 0.75 : 0.9) * (E.ge('rally') && S.gev.f === f ? 1.25 : 1); };
  E.uraniumMult = f => Math.min(2, E.resHeld(f).u * 0.25 + (E.resHeld(f).u ? 0.75 : 0));
  E.ncapsHeld = f => cities.reduce((n, c) => n + (c.ncap && S.owner[c.i] === f ? 1 : 0), 0);
  E.cpMax = f => K.CP_BASE + Math.min(6, S.regionHeld.filter(h => h === f).length) + Math.min(K.NCAP_MAX, E.ncapsHeld(f));

  // ---------- network ----------
  const blockedFor = (i, f) => S.block[i] > S.simT && S.blockBy[i] !== f;
  E.edgeOpen = (e, f) => !(S.rad[e.a] || S.rad[e.b]) && (e.type !== 2 || !E.ge('solar')) && (e.type !== 1 || !(blockedFor(e.a, f) || blockedFor(e.b, f) || (S.fleets && (E.fleetsBlock(e.a, f) || E.fleetsBlock(e.b, f)))));
  E.edgeCost = e => e.km / K.SPEED[e.type] / (e.storm ? K.STORM_SLOW : 1) + 0.5 + (e.type === 2 ? 4 : 0); // air costs 2 CP, so prefer it only when clearly faster
  function computeSupply() {
    S.supplied.fill(0);
    for (let f = 0; f < 2; f++) {
      const st = [];
      for (const c of cities) if (S.owner[c.i] === f && (c.cap === f || c.tier === 3)) { S.supplied[c.i] = 1; st.push(c.i); }
      while (st.length) { const v = st.pop(); for (const { to, e } of adj[v]) if (S.owner[to] === f && !S.supplied[to] && E.edgeOpen(e, f)) { S.supplied[to] = 1; st.push(to); } }
    }
  }
  function computeFront() {
    const fd = S.frontDist; fd.fill(999); const q = [];
    for (let i = 0; i < N; i++) if (S.owner[i] >= 0 && adj[i].some(x => S.owner[x.to] !== S.owner[i])) { fd[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) { const v = q[h]; for (const { to } of adj[v]) if (S.owner[to] === S.owner[v] && fd[to] > fd[v] + 1) { fd[to] = fd[v] + 1; q.push(to); } }
  }
  E.localHour = f => ((S.simT * K.GMIN / 60) % 24 + cities[CAPS[f]].lng / 15 + 48) % 24;
  E.online = f => 0.3 + 0.7 * (0.5 + 0.5 * Math.cos((E.localHour(f) - 20) / 24 * 2 * Math.PI));

  E.routeFrom = (src, f) => {
    const dist = new Float32Array(N).fill(Infinity), prev = new Int16Array(N).fill(-1), pe = new Array(N), air = new Uint8Array(N), done = new Uint8Array(N);
    dist[src] = 0;
    for (;;) {
      let v = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; v = i; }
      if (v < 0) break; done[v] = 1;
      if (v !== src && S.owner[v] !== f) continue;
      for (const { to, e } of adj[v]) { if (!E.edgeOpen(e, f)) continue; const d = dist[v] + E.edgeCost(e); if (d < dist[to]) { dist[to] = d; prev[to] = v; pe[to] = e; air[to] = air[v] || e.type === 2; } }
    }
    return { dist, prev, pe, air };
  };
  E.pathTo = (r, t) => { const nodes = [t], es = []; let v = t; while (r.prev[v] >= 0) { es.unshift(r.pe[v]); v = r.prev[v]; nodes.unshift(v); } return { nodes, es }; };
  E.sendAmount = (src, dst, r, frac) => { let n = Math.floor(Math.min(S.troops[src] * frac, S.troops[src] - 1)); if (r && r.air[dst]) n = Math.min(n, K.AIR_CAP); return Math.max(0, n); };
  E.cmdrActive = i => { const p = S.cmdr[i] && players.get(S.cmdr[i]); return !!(p && p.online && p.f === S.owner[i]) || !!(S.cmdrOnline && S.cmdrOnline[i]); };
  E.markAt = (f, i, kind) => (S.marks || []).some(m => m.f === f && m.i === i && m.kind === kind && m.until > S.simT);
  E.defMult = i => (S.owner[i] >= 0 && E.markAt(S.owner[i], i, 'defend') ? K.MARK_DEF : 1) * (cities[i].cap >= 0 ? 1.3 : 1) * (S.fort[i] > S.simT ? K.FORT_MULT : 1) * (S.sab[i] > S.simT ? K.SAB_MULT : 1) * (E.cmdrActive(i) ? K.CMDR_MULT : 1);
  E.aaCover = (i, attacker) => { const o = S.owner[i]; if (o < 0 || o === attacker) return -1; for (const h of hubs) if (S.owner[h] === o && kmBetween(h, i) <= K.AA_KM) return h; return -1; };
  E.canBlockade = (f, i) => cities[i].port && S.owner[i] === 1 - f && S.block[i] <= S.simT && adj[i].some(x => x.e.type === 1 && S.owner[x.to] === f);
  E.defOf = i => S.troops[i] * E.defMult(i);
  E.touchesNet = (f, i) => S.owner[i] !== f && adj[i].some(x => S.owner[x.to] === f);
  E.canDrop = (src, dst) => !E.ge('solar') && src >= 0 && dst >= 0 && !S.rad[dst] && cities[src].tier === 3 && dst !== src && S.owner[dst] !== S.owner[src] && kmBetween(src, dst) <= K.DROP_KM;
  E.visibility = f => {
    const vis = new Uint8Array(N), lim = Math.cos(K.FOG_KM / 6371), own = [];
    for (let i = 0; i < N; i++) if (S.owner[i] === f) { own.push(i); vis[i] = 1; for (const { to } of adj[i]) vis[to] = 1; }
    for (let i = 0; i < N; i++) if (!vis[i]) for (const o of own) if (dot(cities[i].u, cities[o].u) > lim) { vis[i] = 1; break; }
    const sl = Math.cos(K.SAT_KM / 6371);
    for (const st of S.sats || []) if (st.f === f && st.until > S.simT) for (let i = 0; i < N; i++) if (!vis[i] && dot(cities[i].u, cities[st.i].u) > sl) vis[i] = 1;
    for (const sp of S.spies || []) if (sp.f === f && sp.until > S.simT) { vis[sp.i] = 1; for (const { to } of adj[sp.i]) vis[to] = 1; }
    return vis;
  };
  E.nearOrder = (f, i) => S.orders[f] >= 0 && S.owner[i] !== f && (i === S.orders[f] || adj[i].some(x => x.to === S.orders[f]));
  E.costFor = (f, r, dst) => (r && r.air[dst] ? 2 : 1) / (E.nearOrder(f, dst) ? 2 : 1);

  // ---------- convoys ----------
  function launch(cv) { cv.id = convoySeq++; enterEdge(cv); S.convoys.push(cv); }
  function enterEdge(cv) { const e = cv.es[cv.hop]; cv.e = e; cv.fwd = e.a === cv.nodes[cv.hop]; cv.t = 0; e.convoys.push(cv); if (S.fleets && S.fleets.length) interceptAtSea(cv); }
  function leaveEdge(cv) { const a = cv.e.convoys, k = a.indexOf(cv); if (k >= 0) a.splice(k, 1); }
  function threat(f, dst, n) {
    const v = S.owner[dst];
    if (v >= 0 && v !== f && (cities[dst].tier >= 2 || cities[dst].cap >= 0) && n > E.defOf(dst) * 0.7 && S.simT - alertAt[dst] > 25) {
      alertAt[dst] = S.simT; emit({ k: 'threat', f, city: dst, n, def: Math.floor(E.defOf(dst)) });
    } else if (v >= 0 && v !== f && S.cmdr[dst] && n > E.defOf(dst) * 0.7 && S.simT - alertAt[dst] > 25) {
      alertAt[dst] = S.simT; emit({ k: 'threat', f, city: dst, n, def: Math.floor(E.defOf(dst)), cmdr: pubOf(S.cmdr[dst]) });
    }
  }
  const kindOf = cv => CONVOY[cv.kind] || CONVOY.std;
  function send(f, src, dst, n, who, r, kind = 'std') {
    if (dst === src) return false;
    r = r || E.routeFrom(src, f);
    if (!isFinite(r.dist[dst])) return false;
    const p = E.pathTo(r, dst); if (!p.es.length) return false;
    if (r.air[dst]) n = Math.min(n, K.AIR_CAP);
    n = Math.floor(Math.min(n, S.troops[src] - 1)); if (n < 1) return false;
    S.troops[src] -= n;
    launch({ f, n, nodes: p.nodes, es: p.es, hop: 0, t: 0, who, alive: true, kind });
    threat(f, dst, n * (CONVOY[kind] || CONVOY.std).power);
    return true;
  }
  function airdrop(f, src, dst, who) {
    if (!E.canDrop(src, dst)) return false;
    const n = Math.floor(Math.min(K.DROP_CAP, S.troops[src] - 1)); if (n < 1) return false;
    S.troops[src] -= n;
    const e = { i: -1, a: src, b: dst, type: 2, km: kmBetween(src, dst), convoys: [], temp: true };
    launch({ f, n, nodes: [src, dst], es: [e], hop: 0, t: 0, who, alive: true, drop: true });
    threat(f, dst, n);
    return true;
  }
  function comboAt(cv, v) {
    const p = players.get(cv.who); if (!p || !p.squad) return 1;
    const h = squadHit.get(v), now = S.simT; squadHit.set(v, { sq: p.squad, t: now, who: cv.who });
    if (h && h.sq === p.squad && h.who !== cv.who && now - h.t < K.COMBO_TIME) { emit({ k: 'combo', f: cv.f, city: v, who: p.pub, mate: pubOf(h.who), code: p.squad }); return K.COMBO_MULT; }
    return 1;
  }
  function arrive(cv, v) {
    const f = cv.f;
    if (S.owner[v] === f) { if (cv.hop < cv.es.length - 1) { cv.hop++; enterEdge(cv); return; } S.troops[v] += cv.n; cv.alive = false; return; }
    cv.alive = false;
    if (cv.drop) { const h = E.aaCover(v, f); if (h >= 0) { const lost = Math.round(cv.n * K.AA_LOSS); cv.n -= lost; emit({ k: 'aa', f, city: v, hub: h, lost, who: pubOf(cv.who) }); } }
    const m = E.defMult(v), def = S.troops[v] * m, pw = kindOf(cv).power * (siegeAt(v, f) ? K.FLEET_SIEGE : 1) * (E.markAt(f, v, 'attack') ? K.MARK_ATK : 1) * comboAt(cv, v);
    cv.n *= pw; // compare effective strength
    if (!cv.e.temp) S.heat[cv.e.i] = Math.min(1, S.heat[cv.e.i] + 0.5);
    if (cv.n > def) {
      const prev = S.owner[v]; S.owner[v] = f; S.troops[v] = cv.n - def; S.fort[v] = 0; S.sab[v] = 0; S.block[v] = 0;
      if (prev < 0 && cities[v].nation >= 0 && S.favour) { const n = cities[v].nation, fv = S.favour[n]; if (fv[f] > 0 && fv[f] < 100) { const had = fv[f]; fv[f] = 0; fv[1 - f] = Math.min(99, fv[1 - f] + K.BETRAY_GIFT); emit({ k: 'betray', f, nation: n, city: v, lost: Math.round(had) }); } }
      const p = players.get(cv.who); if (p) p.caps++; else creditHero(f);
      if (p) {
        const km = Math.round(kmBetween(CAPS[p.f], v)), c = cities[v];
        p.xp += XP.CAPTURE; p.captured.push(v); if (!p.far || km > p.far.km) p.far = { city: v, km };
        progress(p, 'cap3'); if (c.tier >= 2) progress(p, 'big'); if (cv.drop) progress(p, 'drop'); if (km >= 5000) progress(p, 'far');
        progress(p, 'region', m => m.r === c.region);
      }
      S.cmdr[v] = p ? p.id : '';
      emit({ k: 'capture', f, city: v, prev, who: pubOf(cv.who), drop: !!cv.drop });
    } else { S.troops[v] = (def - cv.n) / m; emit({ k: 'repel', f, city: v, who: pubOf(cv.who) }); }
  }
  function creditHero(f) { const list = heroes.filter(h => h.f === f); let tot = 0; for (const h of list) tot += h.skill; let r = Math.random() * tot; for (const h of list) { r -= h.skill; if (r <= 0) { h.caps++; return; } } }
  function fightOnEdges() {
    for (const e of edges) {
      const L = e.convoys; if (L.length < 2 || e.type === 2) continue;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        if (!a.alive || !b.alive || a.f === b.f || a.fwd === b.fwd) continue;
        const sa = a.fwd ? a.t : 1 - a.t, sb = b.fwd ? b.t : 1 - b.t;
        if ((a.fwd && sa >= sb) || (!a.fwd && sa <= sb)) {
          const pa = kindOf(a).power, pb = kindOf(b).power, k = Math.min(a.n * pa, b.n * pb); a.n -= k / pa; b.n -= k / pb;
          const w = a.n > 0 ? a : b;
          for (const c of [a, b]) { const p = players.get(c.who); if (p) p.clashes++; }
          progress(players.get(w.who), 'clash');
          if (a.n <= 0.5) a.alive = false; if (b.n <= 0.5) b.alive = false;
          S.heat[e.i] = Math.min(1, S.heat[e.i] + 0.6);
          emit({ k: 'clash', f: w.f, edge: e.i, s: w.fwd ? w.t : 1 - w.t, who: [pubOf(a.who), pubOf(b.who)] });
        }
      }
    }
  }

  // ---------- free nations ----------
  E.nationCities = nationCities;
  E.envoyCost = () => E.ge('summit') ? 1 : K.ENVOY_COST;
  E.envoyGain = n => (E.ge('summit') ? 1.5 : 1) * K.ENVOY_GAIN / (1 + 0.15 * (nationCities[n].length - 1));
  E.envoyOk = (f, i) => i >= 0 && i < N && cities[i].nation >= 0 && S.owner[i] < 0 && !S.rad[i] && E.touchesNet(f, i);
  function envoy(f, i, who) {
    const n = cities[i].nation, fv = S.favour[n];
    fv[f] = Math.min(100, fv[f] + E.envoyGain(n)); fv[1 - f] = Math.max(0, fv[1 - f] - K.ENVOY_RIVAL);
    emit({ k: 'envoy', f, nation: n, city: i, favour: Math.round(fv[f]), who: pubOf(who) });
    if (fv[f] >= 100) ally(n, f);
  }
  function ally(n, f) {
    const joined = [];
    for (const i of nationCities[n]) if (S.owner[i] < 0 && !S.rad[i]) { S.owner[i] = f; S.troops[i] = Math.max(S.troops[i], K.NEUTRAL[cities[i].tier]) * K.ALLY_BONUS; joined.push(i); }
    S.favour[n] = [0, 0]; S.favour[n][f] = 100;
    emit({ k: 'ally', f, nation: n, cities: joined });
  }

  // ---------- fleets ----------
  const seaAdj = Array.from({ length: N }, () => []);
  for (const e of edges) if (e.type === 1) { seaAdj[e.a].push({ to: e.b, e }); seaAdj[e.b].push({ to: e.a, e }); }
  E.seaAdj = seaAdj;
  E.harbour = i => cities[i].port && seaAdj[i].length > 0;
  const fleetAt = (i, f) => S.fleets.filter(fl => !fl.moving && fl.at === i && (f === undefined || fl.f === f));
  function siegeAt(i, f) { return S.owner[i] !== f && fleetAt(i, f).length > 0; }
  E.siegeAt = siegeAt;
  E.fleetsBlock = (i, f) => S.owner[i] === f && S.fleets.some(fl => !fl.moving && fl.at === i && fl.f !== f);
  E.seaRoute = (from, to) => { // shortest sea path between two ports, ignoring ownership
    const dist = new Float32Array(N).fill(Infinity), prev = new Int16Array(N).fill(-1), pe = new Array(N), done = new Uint8Array(N); dist[from] = 0;
    for (;;) { let v = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; v = i; } if (v < 0 || v === to) break; done[v] = 1;
      for (const { to: w, e } of seaAdj[v]) { const d = dist[v] + e.km; if (d < dist[w]) { dist[w] = d; prev[w] = v; pe[w] = e; } } }
    if (!isFinite(dist[to])) return null; const nodes = [to], es = []; let v = to; while (prev[v] >= 0) { es.unshift(pe[v]); v = prev[v]; nodes.unshift(v); } return { nodes, es, km: dist[to] };
  };
  function buildFleet(f, port, who) {
    if (!E.harbour(port) || S.owner[port] !== f || S.troops[port] < K.FLEET_TROOPS + 1) return false;
    if (S.fleets.filter(x => x.f === f).length >= K.FLEET_MAX_FACTION) return false;
    S.troops[port] -= K.FLEET_TROOPS;
    const fl = { id: convoySeq++, f, str: K.FLEET_TROOPS, at: port, who, moving: null };
    S.fleets.push(fl); emit({ k: 'fleet_built', f, city: port, who: pubOf(who) }); arriveFleet(fl);
    return true;
  }
  function sailFleet(fl, to) {
    if (fl.moving || to === fl.at) return false; const r = E.seaRoute(fl.at, to); if (!r || !r.es.length) return false;
    fl.moving = { nodes: r.nodes, es: r.es, hop: 0, t: 0 }; fl.from = fl.at; fl.at = -1; return true;
  }
  function arriveFleet(fl) {
    const i = fl.at;
    for (const o of S.fleets) if (o !== fl && !o.moving && o.at === i && o.f !== fl.f && o.str > 0 && fl.str > 0) { // naval battle
      const k = Math.min(fl.str, o.str); fl.str -= k; o.str -= k;
      emit({ k: 'naval', f: fl.str > 0 ? fl.f : o.f, city: i, who: [pubOf(fl.who), pubOf(o.who)] });
    }
    if (fl.str > 0) emit({ k: 'fleet_arrived', f: fl.f, city: i, who: pubOf(fl.who), enemyPort: S.owner[i] >= 0 && S.owner[i] !== fl.f });
  }
  function interceptAtSea(cv) { // a convoy entering a sea route that touches a port held by an enemy fleet
    if (cv.e.type !== 1 || cv.e.temp) return;
    for (const i of [cv.e.a, cv.e.b]) for (const fl of S.fleets) {
      if (fl.moving || fl.at !== i || fl.f === cv.f || fl.str <= 0 || !cv.alive) continue;
      const pw = kindOf(cv).power, fleetPow = fl.str * K.FLEET_POWER, k = Math.min(cv.n * pw, fleetPow);
      cv.n -= k / pw; fl.str -= k / K.FLEET_POWER * 0.6;
      if (cv.n <= 0.5) cv.alive = false;
      emit({ k: 'intercept', f: fl.f, city: i, sunk: !cv.alive, who: [pubOf(cv.who), pubOf(fl.who)], lost: Math.round(k / pw) });
    }
  }
  function updateFleets(dt) {
    for (const fl of S.fleets) {
      if (fl.moving) {
        const m = fl.moving, e = m.es[m.hop]; m.t += K.FLEET_SPEED * dt / e.km;
        if (m.t >= 1) { m.hop++; m.t = 0; if (m.hop >= m.es.length) { fl.at = m.nodes[m.nodes.length - 1]; fl.moving = null; arriveFleet(fl); } }
      } else if (S.owner[fl.at] >= 0 && S.owner[fl.at] !== fl.f) fl.str -= K.FLEET_SHORE * S.troops[fl.at] * dt; // coastal batteries
    }
    const sunk = S.fleets.filter(fl => fl.str <= 0.5); for (const fl of sunk) emit({ k: 'fleet_sunk', f: fl.f, city: fl.at >= 0 ? fl.at : fl.moving ? fl.moving.nodes[fl.moving.hop] : -1, who: pubOf(fl.who) });
    S.fleets = S.fleets.filter(fl => fl.str > 0.5);
  }
  E.fleetPos = fl => fl.moving ? { e: fl.moving.es[fl.moving.hop], fwd: fl.moving.es[fl.moving.hop].a === fl.moving.nodes[fl.moving.hop], t: fl.moving.t } : null;

  // ---------- bots ----------
  function botAct(f) {
    const own = []; for (let i = 0; i < N; i++) if (S.owner[i] === f && S.troops[i] >= 12) own.push(i);
    if (!own.length) return;
    const r = Math.random();
    if (r < 0.05) {
      let b = -1, bv = 0; for (let k = 0; k < 6; k++) { const i = own[(Math.random() * own.length) | 0]; if (S.frontDist[i] === 0 && S.fort[i] <= S.simT) { const v = K.VALUE[cities[i].tier] + (cities[i].cap >= 0 ? 5 : 0); if (v > bv) { bv = v; b = i; } } }
      if (b >= 0 && bv >= 3) { S.fort[b] = S.simT + K.FORT_TIME; return; }
    } else if (r < 0.075) {
      let b = -1, bv = 0; for (let k = 0; k < 8; k++) { const i = (Math.random() * N) | 0; if (S.owner[i] === 1 - f && E.touchesNet(f, i) && S.sab[i] <= S.simT) { const v = K.VALUE[cities[i].tier] + (S.orders[f] === i ? 4 : 0); if (v > bv) { bv = v; b = i; } } }
      if (b >= 0 && bv >= 3) { S.sab[b] = S.simT + K.SAB_TIME; emit({ k: 'sabotage', f, city: b, who: 'bot' }); return; }
    } else if (r < 0.11 && r >= 0.095) {
      for (let k = 0; k < 8; k++) { const i = (Math.random() * N) | 0; if (E.canBlockade(f, i) && K.VALUE[cities[i].tier] >= 3) { S.block[i] = S.simT + K.BLOCK_TIME; S.blockBy[i] = f; emit({ k: 'blockade', f, city: i, who: 'bot' }); return; } }
    } else if (r < 0.095) {
      const hubs = own.filter(i => cities[i].tier === 3 && S.troops[i] > 50);
      if (hubs.length) { const h = hubs[(Math.random() * hubs.length) | 0]; let b = -1, bs = 0;
        for (let i = 0; i < N; i++) if (E.canDrop(h, i) && S.owner[i] !== f) { const s = K.VALUE[cities[i].tier] / (E.defOf(i) + 5); if (K.DROP_CAP > E.defOf(i) * 1.1 && s > bs) { bs = s; b = i; } }
        if (b >= 0) { airdrop(f, h, b, 'bot'); return; } }
    }
    if (r >= 0.125 && r < 0.14) { // diplomacy with a free nation on the border
      let b = -1, bs = 0; for (let i = 0; i < N; i++) { if (cities[i].nation >= 0 && E.envoyOk(f, i)) { const n = cities[i].nation, sc = (S.favour[n][f] + 20) * nationCities[n].length; if (sc > bs) { bs = sc; b = i; } } }
      if (b >= 0) { envoy(f, b, 'bot'); return; }
    }
    if (r >= 0.11 && r < 0.125) { // navy
      const mine = S.fleets.filter(x => x.f === f);
      if (mine.length < 3) { const ports = own.filter(i => E.harbour(i) && S.troops[i] > 70); if (ports.length) { buildFleet(f, ports[(Math.random() * ports.length) | 0], 'bot'); return; } }
      const idle = mine.filter(x => !x.moving); if (idle.length) {
        const fl = idle[(Math.random() * idle.length) | 0]; let best = -1, bs = 0;
        for (let i = 0; i < N; i++) { if (!E.harbour(i) || i === fl.at) continue; const enemy = S.owner[i] === 1 - f, front = S.owner[i] === f && S.frontDist[i] === 0;
          const sc = (enemy ? K.VALUE[cities[i].tier] * 2 / (1 + S.troops[i] / 40) : front ? 1.5 : 0) * (0.6 + Math.random() * 0.8); if (sc > bs) { bs = sc; best = i; } }
        if (best >= 0) { sailFleet(fl, best); return; }
      }
    }
    let src = -1, bt = -1;
    for (let k = 0; k < 5; k++) { const i = own[(Math.random() * own.length) | 0], w = S.troops[i] * (S.frontDist[i] === 0 ? 1.4 : 1); if (w > bt) { bt = w; src = i; } }
    if (S.frontDist[src] === 0) {
      let best = -1, bs = 0;
      for (const { to, e } of adj[src]) {
        if (S.owner[to] === f) continue;
        const def = E.defOf(to), avail = e.type === 2 ? Math.min(K.AIR_CAP, S.troops[src] * 0.75) : S.troops[src] * 0.75;
        if (avail < def * 1.05 && Math.random() > 0.08) continue;
        const courting = S.owner[to] < 0 && cities[to].nation >= 0 && S.favour[cities[to].nation][f] > 0;
        const s = (courting ? 0.15 : 1) * (K.VALUE[cities[to].tier] * 4 + (cities[to].res ? (cities[to].res === 'u' && !E.resHeld(f).u ? 10 : 4) : 0) + (S.owner[to] === 1 - f ? 3 : 1) + (S.orders[f] === to ? 10 : 0) + (E.markAt(f, to, 'attack') ? 10 : 0)) / (def + 6) * (0.6 + Math.random() * 0.8);
        if (s > bs) { bs = s; best = to; }
      }
      if (best >= 0) { send(f, src, best, S.troops[src] * 0.75, 'bot'); return; }
      if (S.orders[f] >= 0 && Math.random() < 0.3) send(f, src, S.orders[f], S.troops[src] * 0.6, 'bot');
      return;
    }
    let best = -1, bd = S.frontDist[src];
    for (const { to } of adj[src]) if (S.owner[to] === f && S.frontDist[to] < bd) { bd = S.frontDist[to]; best = to; }
    if (best >= 0) send(f, src, best, S.troops[src] * 0.7, 'bot');
  }
  function pickOrders(force) {
    for (let f = 0; f < 2; f++) {
      if (orderUntil[f] > S.simT && !force) continue;
      let best = -1, bs = 0;
      for (let i = 0; i < N; i++) {
        if (S.owner[i] === f || !adj[i].some(x => S.owner[x.to] === f)) continue;
        const s = (K.VALUE[cities[i].tier] + (cities[i].res ? 2 : 0)) * (S.owner[i] === 1 - f ? 1.5 : 1) / (S.troops[i] + 10) * (0.8 + Math.random() * 0.4);
        if (s > bs) { bs = s; best = i; }
      }
      if (best >= 0 && best !== S.orders[f]) { S.orders[f] = best; emit({ k: 'rally', f, city: best, who: 'hq' }); }
    }
  }
  function updateRegions() {
    REGIONS.forEach((name, r) => {
      const l = regionCities[r], o = S.owner[l[0]], held = o >= 0 && l.every(i => S.owner[i] === o) ? o : -1;
      if (held !== S.regionHeld[r]) { const was = S.regionHeld[r]; S.regionHeld[r] = held; emit({ k: 'region', r, f: held, was }); }
    });
  }
  const seaEdges = edges.filter(e => e.type === 1), openSea = seaEdges.filter(e => e.km > 1800);
  function updateStorms(dt) {
    for (const st of S.storms) st.lng += st.dlng * dt;
    const before = S.storms.length; S.storms = S.storms.filter(st => st.until > S.simT);
    const hur = E.ge('hurricane');
    if (S.simT >= nextStorm && S.storms.length < (hur ? 5 : K.STORM_MAX) && seaEdges.length) {
      const e = openSea[(Math.random() * openSea.length) | 0], A = cities[e.a].u, B = cities[e.b].u, m = [A[0] + B[0], A[1] + B[1], A[2] + B[2]], l = Math.hypot(...m);
      const lat = Math.asin(m[1] / l) / D, lng = ((Math.atan2(m[2] / l, -m[0] / l) / D) + 360) % 360 - 180;
      const st = { id: convoySeq++, lat, lng, r: 900 + Math.random() * 700, dlng: (Math.random() - 0.5) * 0.12, until: S.simT + 140 + Math.random() * 120 };
      S.storms.push(st); emit({ k: 'storm', lat, lng }); nextStorm = S.simT + K.STORM_EVERY * (hur ? 0.33 : 1) * (0.6 + Math.random() * 0.8);
    }
    E.markStormEdges();
  }
  E.markStormEdges = () => {
    const cs = S.storms.map(st => ({ u: unit(st.lat, st.lng), lim: Math.cos(st.r / 6371) }));
    for (const e of seaEdges) {
      const A = cities[e.a].u, B = cities[e.b].u, m = [A[0] + B[0], A[1] + B[1], A[2] + B[2]], l = Math.hypot(...m), mu = [m[0] / l, m[1] / l, m[2] / l];
      e.storm = cs.some(c => dot(c.u, mu) > c.lim || dot(c.u, A) > c.lim || dot(c.u, B) > c.lim);
    }
  }
// ---------- strategic weapons ----------
  E.hubsHeld = f => hubs.filter(h => S.owner[h] === f).length;
  E.nukeRange = (f, i) => hubs.some(h => S.owner[h] === f && kmBetween(h, i) <= K.NUKE_RANGE);
  E.nukeTargetOk = (f, i) => i >= 0 && i < N && S.owner[i] === 1 - f && !S.rad[i] && E.nukeRange(f, i);
  E.blastCities = i => cities.filter(c => kmBetween(c.i, i) <= K.NUKE_BLAST && !S.rad[c.i]).map(c => c.i);
  E.interceptChance = (target, extra = 0) => { const o = S.owner[target]; let n = 0; for (const h of hubs) if (S.owner[h] === o && o >= 0 && kmBetween(h, target) <= K.NUKE_AA_KM) n++; return Math.min(K.NUKE_AA_MAX, n * K.NUKE_AA_PER_HUB + extra); };
  const humansOnline = f => [...players.values()].filter(p => p.online && p.f === f);
  // ---------- faction general ----------
  E.votesFor = (f, pub) => [...players.values()].filter(p => p.online && p.f === f && p.vote === pub).length;
  E.chiefOf = f => S.chief && S.chief[f] ? players.get(S.chief[f]) || null : null;
  function updateChief(f) {
    const cand = humansOnline(f); let best = null, bv = -1;
    for (const p of cand) { const v = E.votesFor(f, p.pub); if (v > bv || (v === bv && (p.xp || 0) > (best.xp || 0))) { best = p; bv = v; } }
    const id = best ? best.id : null;
    if (id !== S.chief[f]) { S.chief[f] = id; if (best) emit({ k: 'chief', f, name: best.name, who: best.pub, votes: bv, rank: rankOf(best.xp || 0).name }); }
  }
  let chiefT = 0;
  function nukeFund(f, amount, who) {
    const nk = S.nuke[f]; if (nk.used || nk.ready || E.ge('disarm')) return false;
    if (E.hubsHeld(f) < K.NUKE_HUBS || !E.resHeld(f).u) return false;
    nk.prog = Math.min(1, nk.prog + amount / K.NUKE_COST * E.uraniumMult(f));
    if (nk.prog >= 1) { nk.ready = true; emit({ k: 'nuke_ready', f }); }
    return true;
  }
  function nukeLaunch(f) {
    const nk = S.nuke[f], arm = nk.arm; if (!arm) return;
    const target = arm.target;
    if (!E.nukeTargetOk(f, target)) { nk.arm = null; emit({ k: 'nuke_abort', f, reason: 'target' }); return; }
    let from = -1, best = 1e9; for (const h of hubs) if (S.owner[h] === f) { const d = kmBetween(h, target); if (d < best) { best = d; from = h; } }
    nk.used = true; nk.ready = false; nk.arm = null; S.strikes++;
    const m = { id: convoySeq++, f, from, target, t: 0, extra: 0, km: best, by: arm.byName };
    S.missiles.push(m); S.penalty[f] += K.NUKE_PENALTY;
    emit({ k: 'nuke_launch', f, from, target, by: arm.byName, eta: K.NUKE_FLIGHT, strikes: S.strikes });
    // retaliation: a victim with a ready warhead can strike back; bot-run factions do it most of the time
    const v = 1 - f, scv = E.scores().pts; if (S.nuke[v].ready && !S.nuke[v].used && !humansOnline(v).length && (scv[f] - scv[v]) / Math.max(1, scv[0] + scv[1]) > 0.05 && Math.random() < 0.7) {
      const tgt = bestNukeTarget(v); if (tgt >= 0) { S.nuke[v].arm = { target: tgt, by: 'hq', byName: 'HQ', at: S.simT, keys: ['hq', 'hq2'] }; nukeLaunch(v); }
    }
  }
  function bestNukeTarget(f) {
    let best = -1, bs = 0;
    for (let i = 0; i < N; i++) { if (!E.nukeTargetOk(f, i)) continue; let v = 0; for (const j of E.blastCities(i)) if (S.owner[j] === 1 - f) v += K.VALUE[cities[j].tier] + (cities[j].cap >= 0 ? 8 : 0); const sc = v * (1 - E.interceptChance(i)); if (sc > bs) { bs = sc; best = i; } }
    return best;
  }
  function updateNukes(dt) {
    for (let f = 0; f < 2; f++) {
      const nk = S.nuke[f]; if (nk.used) continue;
      if (E.hubsHeld(f) >= K.NUKE_HUBS && E.resHeld(f).u) { if (!nk.ready) nukeFund(f, E.bots[f] * E.online(f) * K.NUKE_BOT_RATE * (nk.rate || 1) * dt, 'bots'); }
      else if (!nk.ready && nk.prog > 0) nk.prog = Math.max(0, nk.prog - K.NUKE_DECAY * dt);
      // two keys: a second player, or HQ when nobody else of the faction is online
      if (nk.arm) {
        const others = humansOnline(f).filter(p => p.id !== nk.arm.by).length;
        if (nk.arm.keys.length >= 2) nukeLaunch(f);
        else if (!others && S.simT - nk.arm.at >= K.NUKE_HQ_DELAY) { nk.arm.keys.push('hq'); nukeLaunch(f); }
        else if (S.simT - nk.arm.at > K.NUKE_ARM_WINDOW) { nk.arm = null; emit({ k: 'nuke_abort', f, reason: 'timeout' }); }
      }
      // bot-run factions use a ready warhead when the enemy cannot answer, or rarely otherwise
      // first strike only while the enemy is far from a warhead; a second strike (nuclear winter) only when losing badly
      const sc = E.scores().pts, behind = (sc[1 - f] - sc[f]) / Math.max(1, sc[0] + sc[1]);
      const enemyNk = S.nuke[1 - f], wouldWinter = S.strikes >= 1;
      const safeFirst = !wouldWinter && !enemyNk.ready && enemyNk.prog < 0.85, desperate = wouldWinter && behind > 0.15;
      if (nk.ready && !nk.arm && !E.ge('disarm') && !humansOnline(f).length && (safeFirst || desperate) && Math.random() < dt / (safeFirst ? 15 : 60)) {
        const tgt = bestNukeTarget(f); if (tgt >= 0) { nk.arm = { target: tgt, by: 'hq', byName: 'HQ', at: S.simT, keys: ['hq', 'hq2'] }; }
      }
    }
    for (const m of S.missiles) {
      if (m.done) continue;
      m.t += dt / K.NUKE_FLIGHT;
      if (m.t >= 1) {
        m.done = true;
        const chance = E.interceptChance(m.target, m.extra);
        if (Math.random() < chance) emit({ k: 'nuke_intercept', f: m.f, target: m.target, chance });
        else {
          const hit = E.blastCities(m.target), victim = 1 - m.f;
          for (const i of hit) { S.owner[i] = -1; S.troops[i] = 0; S.rad[i] = 1; S.fort[i] = 0; S.sab[i] = 0; S.block[i] = 0; S.cmdr[i] = ''; }
          for (const cv of S.convoys) if (cv.alive && (S.rad[cv.e.a] || S.rad[cv.e.b])) cv.alive = false;
          S.rage[victim] = S.simT + K.NUKE_RAGE;
          emit({ k: 'nuke_hit', f: m.f, target: m.target, cities: hit });
        }
        if (S.strikes >= 2 && S.missiles.every(x => x.done)) winter();
      }
    }
    S.missiles = S.missiles.filter(m => !m.done || false);
  }
  function winter() {
    if (S.ended) return;
    S.ended = true; S.winter = true; S.history.push(E.scores().pts.slice()); S.frames.push(E.encodeOwners());
    const sc = E.scores(); emit({ k: 'end', pts: sc.pts, cities: sc.cities, winner: -1, winter: true });
  }
  function updateMobil() { const p = E.scores().pts, tot = Math.max(1, p[0] + p[1]); for (let f = 0; f < 2; f++) { S.mobil[f] = 1 + Math.max(0, Math.min(0.3, (p[1 - f] - p[f]) / tot * 1.5)); if (S.rage[f] > S.simT) S.mobil[f] = Math.max(S.mobil[f], 1.3); } }

  E.step = dt => {
    if (S.ended) return;
    S.simT += dt;
    { // a new world event every game day from day 2
      const d = Math.floor(S.simT / GDAY);
      if (d >= 1 && d < 7 && d !== S.gevDay && !S.ended) {
        S.gevDay = d; S.gevUsed = S.gevUsed || [];
        const pool = Object.keys(GEVENTS).filter(k => !S.gevUsed.includes(k) && !(k === 'disarm' && !S.nuke.some(n => n.ready || n.prog > 0.3)));
        const k = pool[(Math.random() * pool.length) | 0];
        if (k) { const p = E.scores().pts; S.gevUsed.push(k); S.gev = { k, from: S.simT, until: (d + 1) * GDAY, f: p[0] === p[1] ? -1 : p[0] < p[1] ? 0 : 1 }; emit({ k: 'gevent', ev: k, f: S.gev.f, until: S.gev.until }); }
      }
    }
    if (S.sats && S.sats.length && S.sats.some(x => x.until <= S.simT)) S.sats = S.sats.filter(x => x.until > S.simT);
    if (S.spies && S.spies.length && S.spies.some(x => x.until <= S.simT)) S.spies = S.spies.filter(x => x.until > S.simT);
    chiefT -= dt; if (chiefT <= 0) { chiefT = 2; updateChief(0); updateChief(1); if (S.marks.length && S.marks.some(m => m.until <= S.simT)) S.marks = S.marks.filter(m => m.until > S.simT); }
    for (const p of players.values()) p.cp = Math.min(E.cpMax(p.f), p.cp + dt / K.CP_REGEN * (E.ge('arms') ? 2 : 1));
    const mult = [E.grainMult(0), E.grainMult(1)], oil = [E.oilMult(0), E.oilMult(1)];
    for (let i = 0; i < N; i++) if (S.owner[i] >= 0 && S.supplied[i] && S.sab[i] <= S.simT) {
      const c = cities[i], o = S.owner[i], cap = K.CAPT[c.tier] + (c.cap === o ? 120 : 0), rb = S.regionHeld[c.region] === o ? 1.3 : 1;
      if (S.troops[i] < cap) S.troops[i] = Math.min(cap, S.troops[i] + (K.PROD[c.tier] + (c.cap === o ? 0.9 : 0)) * rb * S.mobil[o] * mult[o] * dt);
    }
    for (const cv of S.convoys) { if (!cv.alive) continue; cv.t += K.SPEED[cv.e.type] * (cv.e.storm ? K.STORM_SLOW : 1) * oil[cv.f] * kindOf(cv).speed * dt / cv.e.km; if (cv.t >= 1) { leaveEdge(cv); arrive(cv, cv.nodes[cv.hop + 1]); } }
    fightOnEdges();
    for (const cv of S.convoys) if (!cv.alive && cv.e) leaveEdge(cv);
    S.convoys = S.convoys.filter(c => c.alive);
    for (let f = 0; f < 2; f++) { botAcc[f] += E.bots[f] * E.online(f) * K.BOT_RATE * dt; let g = 0; while (botAcc[f] >= 1 && g++ < 50) { botAct(f); botAcc[f]--; } }
    updateNukes(dt); updateFleets(dt);
    if (S.ended) return;
    if (S.simT >= nextSupply) { updateStorms(0.5); computeSupply(); computeFront(); updateRegions(); updateMobil(); nextSupply = S.simT + 0.5; }
    if (S.simT >= nextHist) { S.history.push(E.scores().pts.slice()); S.frames.push(E.encodeOwners()); nextHist = S.simT + 10; }
    if (S.simT >= nextBotOrder) { pickOrders(false); nextBotOrder = S.simT + 45; }
    for (let k = 0; k < S.heat.length; k++) if (S.heat[k] > 0) S.heat[k] = Math.max(0, S.heat[k] - dt / 25);
    const sc = E.scores();
    if (!S.ended && S.simT >= K.SEASON || sc.cities[0] === 0 || sc.cities[1] === 0) {
      S.ended = true; S.history.push(sc.pts.slice()); S.frames.push(E.encodeOwners());
      const w = sc.pts[0] === sc.pts[1] ? -1 : sc.pts[0] > sc.pts[1] ? 0 : 1;
      if (w >= 0) for (const p of players.values()) if (p.f === w) p.xp += XP.WIN;
      emit({ k: 'end', pts: sc.pts, cities: sc.cities, winner: w });
    }
  };
  E.encodeOwners = () => Array.from(S.owner, o => o < 0 ? '.' : o ? 'b' : 'a').join('');
  E.scores = () => {
    const pts = [0, 0], cit = [0, 0], tr = [0, 0];
    for (let i = 0; i < N; i++) { const o = S.owner[i]; if (o >= 0) { pts[o] += K.VALUE[cities[i].tier]; cit[o]++; tr[o] += S.troops[i]; } }
    for (const h of S.regionHeld) if (h >= 0) pts[h] += K.REGION_BONUS;
    if (S.penalty) for (let f = 0; f < 2; f++) pts[f] -= S.penalty[f];
    for (const c of S.convoys) tr[c.f] += c.n;
    return { pts, cities: cit, troops: tr };
  };
  E.leaderboard = () => heroes.map(h => ({ name: h.name, f: h.f, caps: h.caps })).concat([...players.values()].filter(p => p.online || p.caps).map(p => ({ name: p.name, f: p.f, caps: p.caps, id: p.pub, rank: rankOf(p.xp).name }))).sort((a, b) => b.caps - a.caps);

  E.publicPlayer = p => ({ cp: +p.cp.toFixed(2), cpMax: E.cpMax(p.f), f: p.f, name: p.name, pub: p.pub, caps: p.caps, sent: p.sent, clashes: p.clashes, forts: p.forts, sabs: p.sabs, drops: p.drops, blocks: p.blocks || 0,
    trail: p.trail || 'std', squad: E.squadInfo(p), commands: S.cmdr.filter(id => id === p.id).length, vote: p.vote || null, chief: S.chief[p.f] === p.id, nukeCp: p.nukeCp || 0, xp: p.xp, rank: rankOf(p.xp), missions: p.missions, far: p.far, captured: p.captured.slice(-200) });
  // ---------- player commands (validated: the server trusts nothing else) ----------
  const fail = msg => ({ ok: false, msg });
  E.command = (pid, c) => {
    const p = players.get(pid);
    if (!p || S.ended) return fail('Season is over');
    const f = p.f, i = c.city | 0;
    const valid = x => Number.isInteger(x) && x >= 0 && x < N;
    switch (c.type) {
      case 'send': {
        const { src, dst } = c, pct = Math.min(1, Math.max(0.05, +c.pct || 0.5));
        if (!valid(src) || !valid(dst) || S.owner[src] !== f) return fail('Select one of your cities first');
        const r = E.routeFrom(src, f);
        if (!isFinite(r.dist[dst])) return fail('No route there through your cities');
        const kind = CONVOY[c.kind] ? c.kind : 'std', cost = E.costFor(f, r, dst) + CONVOY[kind].cost;
        if (p.cp < cost) return fail('Not enough CP: wait for it to recharge');
        if (!send(f, src, dst, S.troops[src] * pct, pid, r, kind)) return fail(`${cities[src].name} has only ${Math.max(0, Math.floor(S.troops[src]))} troops: nothing to send yet`);
        p.cp -= cost; p.sent++; progress(p, 'send10'); return { ok: true, sfx: 'send' };
      }
      case 'fortify': {
        if (!valid(i) || S.owner[i] !== f) return fail('Select one of your cities to fortify');
        if (S.fort[i] > S.simT) return fail(`${cities[i].name} is already fortified`);
        if (p.cp < K.FORT_COST) return fail(`Fortify needs ${K.FORT_COST} CP`);
        p.cp -= K.FORT_COST; S.fort[i] = S.simT + K.FORT_TIME; p.forts++; if (S.frontDist[i] === 0) progress(p, 'fortfront');
        emit({ k: 'fortify', f, city: i, who: pubOf(pid) }); return { ok: true, sfx: 'fort' };
      }
      case 'sabotage': {
        if (!valid(i) || S.owner[i] !== 1 - f) return fail('Sabotage needs an enemy city');
        if (!E.touchesNet(f, i)) return fail(`${cities[i].name} is not connected to any of your cities`);
        if (S.sab[i] > S.simT) return fail(`${cities[i].name} is already sabotaged`);
        if (p.cp < K.SAB_COST) return fail(`Sabotage needs ${K.SAB_COST} CP`);
        p.cp -= K.SAB_COST; S.sab[i] = S.simT + K.SAB_TIME; p.sabs++; progress(p, 'sab');
        emit({ k: 'sabotage', f, city: i, who: pubOf(pid) }); return { ok: true, sfx: 'fort' };
      }
      case 'airdrop': {
        const { src, dst } = c;
        if (!valid(src) || !valid(dst) || S.owner[src] !== f || !E.canDrop(src, dst)) return fail(`Airdrop reaches enemy or neutral cities within ${K.DROP_KM} km of your megahub`);
        if (p.cp < K.DROP_COST) return fail(`Airdrop needs ${K.DROP_COST} CP`);
        if (!airdrop(f, src, dst, pid)) return fail('Not enough troops in this megahub');
        p.cp -= K.DROP_COST; p.drops++; p.sent++; progress(p, 'send10'); return { ok: true, sfx: 'send' };
      }
      case 'blockade': {
        if (!valid(i) || !cities[i].port || S.owner[i] !== 1 - f) return fail('Blockade needs an enemy port');
        if (S.block[i] > S.simT) return fail(`${cities[i].name} is already blockaded`);
        if (!E.canBlockade(f, i)) return fail(`You need a city linked to ${cities[i].name} by sea`);
        if (p.cp < K.BLOCK_COST) return fail(`Blockade needs ${K.BLOCK_COST} CP`);
        p.cp -= K.BLOCK_COST; S.block[i] = S.simT + K.BLOCK_TIME; S.blockBy[i] = f; p.blocks = (p.blocks || 0) + 1; progress(p, 'block');
        emit({ k: 'blockade', f, city: i, who: pubOf(pid) }); return { ok: true, sfx: 'fort' };
      }
      case 'nuke_fund': {
        const amt = Math.floor(Math.min(p.cp, Math.max(1, Math.floor(+c.amount || 1))));
        const nk = S.nuke[f];
        if (nk.used) return fail('Your faction has already used its warhead this season');
        if (nk.ready) return fail('The warhead is already built');
        if (E.hubsHeld(f) < K.NUKE_HUBS) return fail(`The program needs ${K.NUKE_HUBS} megahubs held at once (you hold ${E.hubsHeld(f)})`);
        if (!E.resHeld(f).u) return fail('The program needs uranium: take and supply a uranium mine (☢)');
        if (p.cp < 1) return fail('Not enough CP');
        p.cp -= amt; p.nukeCp = (p.nukeCp || 0) + amt; nukeFund(f, amt, pid);
        return { ok: true, sfx: 'fort' };
      }
      case 'nuke_arm': {
        const nk = S.nuke[f];
        if (!nk.ready || nk.used) return fail('No warhead ready');
        if (E.ge('disarm')) return fail('Disarmament talks today: no launch can be prepared');
        if (nk.arm) return fail('A launch is already being prepared');
        if (!E.nukeTargetOk(f, i)) return fail('Target must be an enemy city within 8,000 km of your megahub');
        nk.arm = { target: i, by: pid, byName: p.name, at: S.simT, keys: [pid] };
        emit({ k: 'nuke_armed', f, target: i, by: p.name, who: pubOf(pid) }); return { ok: true, sfx: 'alarm' };
      }
      case 'nuke_confirm': {
        const nk = S.nuke[f];
        if (!nk.arm) return fail('No launch to confirm');
        if (nk.arm.keys.includes(pid)) return fail('The second key must be turned by another commander');
        nk.arm.keys.push(pid); emit({ k: 'nuke_confirmed', f, by: p.name }); return { ok: true };
      }
      case 'nuke_abort': {
        const nk = S.nuke[f];
        if (!nk.arm) return fail('No launch to abort');
        nk.arm = null; emit({ k: 'nuke_abort', f, reason: 'abort', by: p.name }); return { ok: true };
      }
      case 'nuke_aa': {
        const m = S.missiles.find(x => !x.done && x.f === 1 - f);
        if (!m) return fail('No incoming missile');
        if (E.interceptChance(m.target, m.extra) >= K.NUKE_AA_MAX) return fail('Air defence is already at its maximum');
        if (p.cp < K.NUKE_AA_COST) return fail(`Boosting air defence needs ${K.NUKE_AA_COST} CP`);
        p.cp -= K.NUKE_AA_COST; m.extra += K.NUKE_AA_BOOST;
        emit({ k: 'nuke_aa', f, chance: E.interceptChance(m.target, m.extra), by: p.name }); return { ok: true, sfx: 'fort' };
      }
      case 'cosmetic': {
        const t = TRAILS[c.trail]; if (!t) return fail('Unknown trail');
        if (rankOf(p.xp || 0).idx < t.rank) return fail(`${t.name} unlocks at ${RANKS[t.rank][1]}`);
        p.trail = c.trail; return { ok: true };
      }
      case 'vote': {
        const t = [...players.values()].find(x => x.pub === c.pub && x.f === f);
        if (!t) return fail('That player is not in your faction');
        p.vote = t.pub; updateChief(f); return { ok: true };
      }
      case 'mark': {
        if (S.chief[f] !== pid) return fail('Only your faction\'s general can place strategic marks');
        if (!valid(i)) return fail('Pick a city');
        const kind = c.kind === 'defend' ? 'defend' : 'attack';
        if (kind === 'defend' && S.owner[i] !== f) return fail('Defend marks go on your own cities');
        if (kind === 'attack' && S.owner[i] === f) return fail('Attack marks go on cities you do not hold');
        const had = S.marks.findIndex(m => m.f === f && m.i === i);
        if (had >= 0) { const old = S.marks[had]; S.marks.splice(had, 1); if (old.kind === kind) { emit({ k: 'unmark', f, city: i }); return { ok: true }; } }
        const mine = S.marks.filter(m => m.f === f); if (mine.length >= K.MARK_MAX) S.marks.splice(S.marks.indexOf(mine[0]), 1);
        S.marks.push({ f, i, kind, until: S.simT + 900 / 7, by: p.name });
        emit({ k: 'mark', f, city: i, kind, by: p.name, who: pubOf(pid) }); return { ok: true, sfx: 'fort' };
      }
      case 'satellite': {
        if (!valid(i)) return fail('Pick a point on the map');
        if (p.cp < K.SAT_COST) return fail(`A satellite pass costs ${K.SAT_COST} CP`);
        if (S.sats.filter(x => x.f === f && x.until > S.simT).length >= K.SAT_MAX) return fail(`Your faction already has ${K.SAT_MAX} satellites overhead`);
        p.cp -= K.SAT_COST; p.sats = (p.sats || 0) + 1;
        S.sats.push({ f, i, until: S.simT + K.SAT_TIME, by: p.name }); emit({ k: 'sat', f, city: i, by: p.name, who: pubOf(pid) }); return { ok: true, sfx: 'fort' };
      }
      case 'spy': {
        if (!valid(i) || S.owner[i] !== 1 - f) return fail('Spies go to enemy cities');
        if (p.cp < K.SPY_COST) return fail(`A spy costs ${K.SPY_COST} CP`);
        if (S.spies.some(x => x.f === f && x.i === i && x.until > S.simT)) return fail('You already have an agent there');
        p.cp -= K.SPY_COST; p.spies = (p.spies || 0) + 1;
        if (Math.random() < K.SPY_CATCH) { emit({ k: 'spy_caught', f, city: i, who: pubOf(pid) }); return { ok: true, sfx: 'err' }; }
        S.spies.push({ f, i, until: S.simT + K.SPY_TIME });
        const e = 1 - f, nk = S.nuke[e];
        emit({ k: 'spy', f, city: i, who: pubOf(pid), troops: Math.round(S.troops[i]), order: S.orders[e], nuke: Math.round(nk.prog * 100), ready: !!nk.ready && !nk.used, arm: nk.arm ? nk.arm.target : -1, army: Math.round(S.troops.reduce((a, t, j) => a + (S.owner[j] === e ? t : 0), 0)) });
        return { ok: true, sfx: 'fort' };
      }
      case 'envoy': {
        if (!valid(i) || cities[i].nation < 0) return fail('Envoys go to the free nations (former Russia)');
        if (S.owner[i] >= 0) return fail(`${cities[i].name} is no longer independent`);
        if (!E.touchesNet(f, i)) return fail(`${cities[i].name} must border your network`);
        if (p.cp < E.envoyCost()) return fail(`An envoy costs ${E.envoyCost()} CP`);
        p.cp -= E.envoyCost(); p.envoys = (p.envoys || 0) + 1; envoy(f, i, pid); return { ok: true, sfx: 'fort' };
      }
      case 'fleet_build': {
        if (!valid(i) || S.owner[i] !== f || !E.harbour(i)) return fail('Fleets are built in your own sea ports (⚓ with sea routes)');
        if (S.fleets.filter(x => x.f === f).length >= K.FLEET_MAX_FACTION) return fail(`Your faction already has ${K.FLEET_MAX_FACTION} fleets`);
        if (S.fleets.filter(x => x.who === pid).length >= K.FLEET_MAX_PLAYER) return fail(`You can command at most ${K.FLEET_MAX_PLAYER} fleets`);
        if (S.troops[i] < K.FLEET_TROOPS + 1) return fail(`A fleet needs ${K.FLEET_TROOPS} troops in ${cities[i].name}`);
        if (p.cp < K.FLEET_COST) return fail(`A fleet costs ${K.FLEET_COST} CP`);
        p.cp -= K.FLEET_COST; buildFleet(f, i, pid); p.fleets = (p.fleets || 0) + 1; return { ok: true, sfx: 'fort' };
      }
      case 'fleet_sail': {
        const fl = S.fleets.find(x => x.id === c.fleet);
        if (!fl || fl.f !== f) return fail('That is not your fleet');
        if (fl.who !== pid && fl.who !== 'bot') return fail('Another commander controls this fleet');
        if (fl.moving) return fail('The fleet is already sailing');
        if (!valid(i) || !E.harbour(i)) return fail('Fleets sail to sea ports (⚓)');
        if (!sailFleet(fl, i)) return fail(`No sea route to ${cities[i].name}`);
        fl.who = pid; return { ok: true, sfx: 'send' };
      }
      case 'rally': {
        if (!valid(i)) return fail('Pick a city');
        S.orders[f] = i; orderUntil[f] = S.simT + K.RALLY_TIME;
        emit({ k: 'rally', f, city: i, who: pubOf(pid), name: p.name }); return { ok: true };
      }
    }
    return fail('Unknown command');
  };

  // ---------- mirror support (client side, online mode) ----------
  // Serialise the visible state compactly; applySnapshot rebuilds it on the client.
  E.snapshot = (viewer = -1) => {
    const vis = viewer >= 0 ? E.visibility(viewer) : null, hide = i => vis && !vis[i] && S.owner[i] !== viewer && S.owner[i] >= 0;
    return {
    t: +S.simT.toFixed(2), season: S.season, ended: S.ended, fog: viewer,
    owner: Array.from(S.owner), troops: Array.from(S.troops, (x, i) => hide(i) ? -1 : Math.round(x * 10) / 10),
    fort: pairs(S.fort, S.simT).filter(([i]) => !hide(i)), sab: pairs(S.sab, S.simT), heat: pairs(S.heat, 0.01),
    block: pairs(S.block, S.simT).map(([i, v]) => [i, v, S.blockBy[i]]),
    cmdr: S.cmdr.map((id, i) => id && players.get(id) ? [i, players.get(id).pub, players.get(id).name, E.cmdrActive(i) ? 1 : 0] : null).filter(Boolean),
    storms: S.storms.map(st => [st.id, +st.lat.toFixed(2), +st.lng.toFixed(2), Math.round(st.r)]),
    rad: pairs(S.rad, 0).map(([i]) => i), penalty: S.penalty, strikes: S.strikes, winter: S.winter, rage: S.rage,
    nuke: S.nuke.map((nk, f) => ({ prog: +nk.prog.toFixed(3), ready: nk.ready, used: nk.used, hubs: E.hubsHeld(f), arm: nk.arm && (viewer < 0 || viewer === f) ? { target: nk.arm.target, by: nk.arm.byName, keys: nk.arm.keys.length, at: nk.arm.at } : nk.arm ? { hidden: true } : null })),
    gev: S.gev,
    cos: Object.fromEntries([...players.values()].filter(p => p.online && p.trail && p.trail !== 'std').map(p => [p.pub, p.trail])),
    marks: (S.marks || []).filter(m => viewer < 0 || m.f === viewer),
    chief: [0, 1].map(f => { const p = E.chiefOf(f); return p ? { name: p.name, pub: p.pub, votes: E.votesFor(f, p.pub), rank: rankOf(p.xp || 0).name } : null; }),
    roster: viewer >= 0 ? humansOnline(viewer).map(p => ({ pub: p.pub, name: p.name, rank: rankOf(p.xp || 0).name, votes: E.votesFor(viewer, p.pub) })).sort((a, b) => b.votes - a.votes).slice(0, 40) : [],
    sats: (S.sats || []).filter(x => viewer < 0 || x.f === viewer), spies: (S.spies || []).filter(x => viewer < 0 || x.f === viewer),
    favour: (S.favour || []).map(x => [Math.round(x[0]), Math.round(x[1])]),
    fleets: S.fleets.filter(fl => !vis || fl.f === viewer || (fl.at >= 0 ? vis[fl.at] : (vis[fl.moving.es[fl.moving.hop].a] || vis[fl.moving.es[fl.moving.hop].b]))).map(fl => ({ id: fl.id, f: fl.f, str: Math.round(fl.str), at: fl.at, who: pubOf(fl.who), mv: fl.moving ? { es: fl.moving.es.map(e => e.i), nodes: fl.moving.nodes, hop: fl.moving.hop, t: +fl.moving.t.toFixed(4) } : null })),
    missiles: S.missiles.filter(m => !m.done).map(m => ({ id: m.id, f: m.f, from: m.from, target: m.target, t: +m.t.toFixed(4), chance: +E.interceptChance(m.target, m.extra).toFixed(2), by: m.by })),
    orders: S.orders, regionHeld: S.regionHeld, mobil: S.mobil.map(x => +x.toFixed(3)), supplied: Array.from(S.supplied),
    conv: S.convoys.filter(c => !vis || c.f === viewer || vis[c.e.a] || vis[c.e.b]).map(c => [c.id, c.f, Math.round(c.n), c.drop ? [-1, c.es[0].a, c.es[0].b] : c.es.map(e => e.i), c.nodes, c.hop, +c.t.toFixed(4), typeof c.who === 'string' ? pubOf(c.who) : '', c.kind || 'std']),
  }; };
  const pairs = (arr, min) => { const out = []; for (let i = 0; i < arr.length; i++) if (arr[i] > min) out.push([i, +arr[i].toFixed(2)]); return out; };
  E.applySnapshot = snap => {
    if (!S.owner || snap.season !== S.season) E.reset();
    S.season = snap.season; S.simT = snap.t; S.ended = snap.ended;
    S.owner.set(snap.owner); S.troops.set(snap.troops); S.supplied.set(snap.supplied);
    S.fort.fill(0); for (const [i, v] of snap.fort) S.fort[i] = v;
    S.sab.fill(0); for (const [i, v] of snap.sab) S.sab[i] = v;
    S.heat.fill(0); for (const [i, v] of snap.heat) S.heat[i] = v;
    S.orders = snap.orders; S.regionHeld = snap.regionHeld; S.mobil = snap.mobil; S.fog = snap.fog;
    S.block.fill(0); S.blockBy.fill(-1); for (const [i, v, by] of snap.block || []) { S.block[i] = v; S.blockBy[i] = by; }
    S.cmdr = new Array(N).fill(''); S.cmdrName = []; S.cmdrOnline = new Uint8Array(N); for (const [i, pub, name, on] of snap.cmdr || []) { S.cmdr[i] = pub; S.cmdrName[i] = name; S.cmdrOnline[i] = on; }
    S.storms = (snap.storms || []).map(([id, lat, lng, r]) => ({ id, lat, lng, r }));
    S.rad = new Uint8Array(N); for (const i of snap.rad || []) S.rad[i] = 1;
    S.penalty = snap.penalty || [0, 0]; S.strikes = snap.strikes || 0; S.winter = !!snap.winter; S.rage = snap.rage || [0, 0];
    if (snap.nuke) S.nuke = snap.nuke;
    if (snap.favour) S.favour = snap.favour;
    S.gev = snap.gev || null; S.cos = snap.cos || {}; S.marks = snap.marks || []; S.chiefInfo = snap.chief || [null, null]; S.roster = snap.roster || []; S.sats = snap.sats || []; S.spies = snap.spies || [];
    S.fleets = (snap.fleets || []).map(x => ({ id: x.id, f: x.f, str: x.str, at: x.at, who: x.who, moving: x.mv ? { es: x.mv.es.map(k => edges[k]), nodes: x.mv.nodes, hop: x.mv.hop, t: x.mv.t } : null }));
    const oldM = new Map((S.missiles || []).map(m => [m.id, m])); S.missiles = (snap.missiles || []).map(m => { const o = oldM.get(m.id); if (o && Math.abs(o.t - m.t) < 0.05) m.t = o.t; return m; });
    const old = new Map(S.convoys.map(c => [c.id, c]));
    for (const e of edges) e.convoys.length = 0;
    S.convoys = snap.conv.map(([id, f, n, es, nodes, hop, t, who, kind]) => {
      let cv = old.get(id);
      const edgeList = es[0] === -1 ? (cv && cv.drop ? cv.es : [{ i: -1, a: es[1], b: es[2], type: 2, km: kmBetween(es[1], es[2]), convoys: [], temp: true }]) : es.map(k => edges[k]);
      if (!cv) cv = { id };
      Object.assign(cv, { f, n, nodes, es: edgeList, hop, who, alive: true, drop: es[0] === -1, kind: kind || 'std' });
      cv.e = edgeList[hop]; cv.fwd = cv.e.a === nodes[hop];
      // keep the locally interpolated position unless the server is clearly ahead/behind
      if (cv.t === undefined || cv.hop !== hop || Math.abs(cv.t - t) > 0.08) cv.t = t;
      cv.hop = hop; cv.e.convoys.push(cv);
      return cv;
    });
    computeFront();
  };
  // Move convoys forward between snapshots (client-side smoothing only).
  E.advanceVisual = dt => { S.simT += dt; for (const fl of S.fleets || []) if (fl.moving) { const e = fl.moving.es[fl.moving.hop]; fl.moving.t = Math.min(0.999, fl.moving.t + K.FLEET_SPEED * dt / e.km); } for (const m of S.missiles || []) m.t = Math.min(0.999, m.t + dt / K.NUKE_FLIGHT); for (const cv of S.convoys) cv.t = Math.min(0.999, cv.t + K.SPEED[cv.e.type] * (CONVOY[cv.kind] || CONVOY.std).speed * dt / cv.e.km); };

  // ---------- persistence: everything needed to resume a season ----------
  E.save = () => ({
    v: 1, S: { simT: S.simT, season: S.season, ended: S.ended, owner: Array.from(S.owner), troops: Array.from(S.troops), fort: Array.from(S.fort), sab: Array.from(S.sab),
      heat: Array.from(S.heat), regionHeld: S.regionHeld, mobil: S.mobil, orders: S.orders, history: S.history, frames: S.frames, cmdr: S.cmdr,
      block: Array.from(S.block), blockBy: Array.from(S.blockBy), storms: S.storms, rad: Array.from(S.rad), penalty: S.penalty, rage: S.rage, strikes: S.strikes, winter: S.winter, nuke: S.nuke, favour: S.favour, gev: S.gev, marks: S.marks, sats: S.sats, spies: S.spies, gevDay: S.gevDay, gevUsed: S.gevUsed, missiles: S.missiles, fleets: S.fleets.map(fl => ({ ...fl, moving: fl.moving ? { ...fl.moving, es: fl.moving.es.map(e => e.i) } : null })) },
    conv: S.convoys.map(c => ({ kind: c.kind, f: c.f, n: c.n, es: c.drop ? null : c.es.map(x => x.i), drop: c.drop ? [c.es[0].a, c.es[0].b] : null, nodes: c.nodes, hop: c.hop, t: c.t, who: c.who })),
    inner: { orderUntil, botAcc, nextSupply, nextBotOrder, nextHist, nextStorm, heroes, convoySeq, bots: E.bots },
    players: [...players.values()].map(p => { const { online, ...rest } = p; return rest; }),
  });
  E.load = d => {
    if (!d || d.v !== 1) return false;
    const s = d.S;
    Object.assign(S, { simT: s.simT, season: s.season, ended: s.ended, regionHeld: s.regionHeld, mobil: s.mobil, orders: s.orders, history: s.history, frames: s.frames || [], cmdr: s.cmdr, storms: s.storms || [] });
    S.owner = Int8Array.from(s.owner); S.troops = Float32Array.from(s.troops); S.fort = Float32Array.from(s.fort); S.sab = Float32Array.from(s.sab);
    S.rad = Uint8Array.from(s.rad || new Array(N).fill(0)); S.penalty = s.penalty || [0, 0]; S.rage = s.rage || [0, 0]; S.strikes = s.strikes || 0; S.winter = !!s.winter;
    S.nuke = s.nuke || [0, 1].map(() => ({ prog: 0, ready: false, used: false, arm: null })); S.missiles = s.missiles || [];
    S.gev = s.gev || null; S.marks = s.marks || []; S.sats = s.sats || []; S.spies = s.spies || []; S.gevDay = s.gevDay || 0; S.gevUsed = s.gevUsed || [];
    S.favour = s.favour || Array.from({ length: NN }, () => [0, 0]);
    S.fleets = (s.fleets || []).map(fl => ({ ...fl, moving: fl.moving ? { ...fl.moving, es: fl.moving.es.map(k => edges[k]) } : null }));
    S.heat = Float32Array.from(s.heat); S.block = Float32Array.from(s.block); S.blockBy = Int8Array.from(s.blockBy); S.supplied = new Uint8Array(N); S.frontDist = new Int16Array(N);
    ({ orderUntil, botAcc, nextSupply, nextBotOrder, nextHist, nextStorm, heroes, convoySeq } = d.inner); if (d.inner.bots) E.bots = d.inner.bots;
    alertAt = new Float32Array(N).fill(-99);
    for (const e of edges) e.convoys.length = 0;
    S.convoys = d.conv.map(c => {
      const es = c.drop ? [{ i: -1, a: c.drop[0], b: c.drop[1], type: 2, km: kmBetween(c.drop[0], c.drop[1]), convoys: [], temp: true }] : c.es.map(k => edges[k]);
      const cv = { id: convoySeq++, f: c.f, n: c.n, es, nodes: c.nodes, hop: c.hop, who: c.who, alive: true, drop: !!c.drop, kind: c.kind || 'std' };
      cv.e = es[c.hop]; cv.fwd = cv.e.a === c.nodes[c.hop]; cv.t = c.t; cv.e.convoys.push(cv); return cv;
    });
    players.clear(); for (const p of d.players || []) players.set(p.id, { ...p, online: false });
    computeSupply(); computeFront(); E.markStormEdges();
    return true;
  };

  E.reset();
  return E;
}
