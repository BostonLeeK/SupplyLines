// Builds net.js: cities, routes (land/sea/air) and country outlines.
// Iran and North Korea are "void": not drawn as land, and no route may cross them.
// Russia is replaced by the nations it holds (real admin-1 borders from Natural Earth, merged per nation).
// Muscovy itself is sea.
import fs from 'fs'; import { feature, merge } from 'topojson-client'; import { topology } from 'topojson-server'; import { presimplify, simplify } from 'topojson-simplify';
const topo = JSON.parse(fs.readFileSync(new URL('./node_modules/world-atlas/countries-50m.json', import.meta.url)));
const fc = feature(topo, topo.objects.countries);
const VOID = new Set(['408', '364']);
// name, lat, lng, tier(1-3), port(0/1), capitalOf(-1/0/1)
const C = `Лондон,51.51,-0.13,3,1|Париж,48.86,2.35,3,0|Берлін,52.52,13.40,2,0|Мадрид,40.42,-3.70,2,0|Лісабон,38.72,-9.14,1,1|Рим,41.90,12.50,2,1|Мілан,45.46,9.19,1,0|Марсель,43.30,5.37,1,1|Гамбург,53.55,9.99,1,1|Амстердам,52.37,4.90,2,1|Стокгольм,59.33,18.07,1,1|Осло,59.91,10.75,1,1|Гельсінкі,60.17,24.94,1,1|Варшава,52.23,21.01,2,0|Київ,50.45,30.52,2,0|Одеса,46.48,30.72,1,1|Харків,49.99,36.23,1,1|Львів,49.84,24.03,1,0|Мінськ,53.90,27.56,1,1|Відень,48.21,16.37,1,0|Бухарест,44.43,26.10,1,0|Будапешт,47.50,19.04,1,0|Афіни,37.98,23.73,1,1|Стамбул,41.01,28.98,3,1|Анкара,39.93,32.86,1,0|Рейкʼявік,64.15,-21.94,1,1|Дублін,53.35,-6.26,1,1|Белград,44.79,20.45,1,0|Тбілісі,41.72,44.79,1,0|Баку,40.41,49.87,1,1|Каїр,30.04,31.24,3,0|Порт-Саїд,31.26,32.30,1,1|Тель-Авів,32.08,34.78,1,1|Багдад,33.31,44.36,2,0|Ер-Ріяд,24.71,46.68,2,0|Джидда,21.49,39.19,1,1|Дубай,25.20,55.27,2,1|Маскат,23.59,58.41,1,1|Аден,12.79,45.03,1,1|Касабланка,33.57,-7.59,1,1|Алжир,36.75,3.06,1,1|Туніс,36.81,10.18,1,1|Триполі,32.89,13.19,1,1|Лагос,6.52,3.38,3,1|Дакар,14.72,-17.47,1,1|Аккра,5.60,-0.19,1,1|Абіджан,5.36,-4.01,1,1|Кіншаса,-4.32,15.31,2,0|Луанда,-8.84,13.23,1,1|Хартум,15.50,32.56,1,0|Аддис-Абеба,9.03,38.74,2,0|Найробі,-1.29,36.82,2,0|Момбаса,-4.04,39.67,1,1|Дар-ес-Салам,-6.79,39.21,1,1|Йоганнесбург,-26.20,28.05,2,0|Кейптаун,-33.92,18.42,1,1|Дурбан,-29.86,31.03,1,1|Антананаріву,-18.88,47.51,1,1|Кано,12.00,8.52,1,0|Бамако,12.64,-8.00,1,0|Лусака,-15.39,28.32,1,0|Алмати,43.24,76.89,1,0|Астана,51.17,71.45,1,0|Актау,43.65,51.17,1,1|Ташкент,41.30,69.24,1,0|Ашгабат,37.96,58.33,1,0|Кабул,34.53,69.17,1,0|Карачі,24.86,67.00,2,1|Лахор,31.55,74.34,1,0|Делі,28.61,77.21,3,0|Мумбаї,19.08,72.88,3,1|Колката,22.57,88.36,2,1|Ченнаї,13.08,80.27,1,1|Бенгалуру,12.97,77.59,1,0|Коломбо,6.93,79.86,1,1|Дакка,23.81,90.41,2,0|Катманду,27.72,85.32,1,0|Янгон,16.84,96.17,1,1|Бангкок,13.76,100.50,2,1,1|Ханой,21.03,105.85,1,0|Хошимін,10.82,106.63,1,1|Куала-Лумпур,3.14,101.69,1,0|Сінгапур,1.35,103.82,3,1|Джакарта,-6.20,106.85,2,1|Сурабая,-7.25,112.75,1,1|Маніла,14.60,120.98,2,1|Гонконг,22.32,114.17,2,1|Гуанчжоу,23.13,113.26,2,0|Шанхай,31.23,121.47,3,1|Пекін,39.90,116.41,3,0|Ченду,30.57,104.07,1,0|Ухань,30.59,114.31,1,0|Сіань,34.34,108.94,1,0|Урумчі,43.83,87.62,1,0|Лхаса,29.65,91.12,1,0|Улан-Батор,47.89,106.91,1,0|Сеул,37.57,126.98,2,1|Пусан,35.18,129.08,1,1|Токіо,35.68,139.69,3,1|Осака,34.69,135.50,1,1|Саппоро,43.06,141.35,1,1|Тайбей,25.03,121.57,1,1|Сідней,-33.87,151.21,2,1|Мельбурн,-37.81,144.96,1,1|Перт,-31.95,115.86,1,1|Дарвін,-12.46,130.84,1,1|Брисбен,-27.47,153.03,1,1|Порт-Морсбі,-9.44,147.18,1,1|Окленд,-36.85,174.76,1,1|Торонто,43.65,-79.38,2,1,0|Нью-Йорк,40.71,-74.01,3,1|Вашингтон,38.91,-77.04,2,0|Чикаго,41.88,-87.63,2,0|Маямі,25.76,-80.19,1,1|Гʼюстон,29.76,-95.37,2,1|Денвер,39.74,-104.99,1,0|Лос-Анджелес,34.05,-118.24,3,1|Сан-Франциско,37.77,-122.42,1,1|Сіетл,47.61,-122.33,1,1|Ванкувер,49.28,-123.12,1,1|Монреаль,45.50,-73.57,1,1|Галіфакс,44.65,-63.58,1,1|Вінніпег,49.90,-97.14,1,0|Анкоридж,61.22,-149.90,1,1|Нуук,64.18,-51.72,1,1|Мехіко,19.43,-99.13,3,0|Монтеррей,25.69,-100.32,1,0|Гватемала,14.63,-90.51,1,0|Панама,8.98,-79.52,1,1|Гавана,23.11,-82.37,1,1|Богота,4.71,-74.07,2,0|Каракас,10.48,-66.90,1,1|Ліма,-12.05,-77.04,2,1|Кіто,-0.18,-78.47,1,0|Ла-Пас,-16.50,-68.15,1,0|Сантьяго,-33.45,-70.67,2,1|Буенос-Айрес,-34.60,-58.38,2,1|Сан-Паулу,-23.55,-46.63,3,1|Ріо-де-Жанейро,-22.91,-43.17,2,1|Бразиліа,-15.79,-47.88,1,0|Салвадор,-12.97,-38.50,1,1|Ресіфі,-8.05,-34.88,1,1|Манаус,-3.12,-60.02,1,0|Гонолулу,21.31,-157.86,1,1`
  .split('|').map(s => { const a = s.split(','); return [a[0], +a[1], +a[2], +a[3], +a[4], a[5] === undefined ? -1 : +a[5]]; });

// ---------- polygons ----------
const polys = [];
const q = x => Math.round(x * 20) / 20;
function addPoly(p, v, n) {
  // unwrap rings that cross the antimeridian so they stay continuous (lng may leave [-180,180])
  const rings = p.map(r => { const o = []; let px, py, off = 0, raw; for (const [x0, y] of r) { if (raw !== undefined && x0 - raw > 180) off -= 360; else if (raw !== undefined && raw - x0 > 180) off += 360; raw = x0; const a = q(x0 + off), b = q(y); if (a === px && b === py) continue; o.push(a, b); px = a; py = b; } return o; }).filter(r => r.length >= 6);
  if (!rings.length) return;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let k = 0; k < rings[0].length; k += 2) { x0 = Math.min(x0, rings[0][k]); x1 = Math.max(x1, rings[0][k]); y0 = Math.min(y0, rings[0][k + 1]); y1 = Math.max(y1, rings[0][k + 1]); }
  polys.push({ v, rings, n, bbox: [x0, y0, x1, y1] });
}
const partsOf = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
for (const f of fc.features) {
  if (f.id === '010' || !f.geometry) continue; // Antarctica
  if (f.id === '643') continue;                // Russia: replaced by its nations below
  for (const p of partsOf(f.geometry)) addPoly(p, VOID.has(f.id) ? 1 : 0, -1);
}

// ---------- nations in place of Russia (real admin-1 borders, merged) ----------
const NATIONS = [
  ['Ічкерія', ['Chechnya']], ['Інгушетія', ['Ingush']], ['Дагестан', ['Dagestan']],
  ['Черкесія', ['Adygey', 'Kabardin-Balkar', 'Karachay-Cherkess']], ['Аланія', ['North Ossetia']], ['Калмикія', ['Kalmyk']],
  ['Татарстан', ['Tatarstan']], ['Башкортостан', ['Bashkortostan']], ['Чувашія', ['Chuvash']], ['Марій Ел', ['Mariy-El']],
  ['Удмуртія', ['Udmurt']], ['Ерзянь Мастор', ['Mordovia']], ['Комі', ['Komi']], ['Карелія', ['Karelia']],
  ['Інгрія', ['Leningrad', 'City of St. Petersburg']], ['Саха', ['Sakha (Yakutia)']], ['Бурятія', ['Buryat']], ['Тива', ['Tuva']],
  ['Хакасія', ['Khakass']], ['Алтай', ['Gorno-Altay']], ['Кенігсберг', ['Kaliningrad']], ['Кубань', ['Krasnodar']],
  ['Сибір', ["Tyumen'", 'Khanty-Mansiy', 'Yamal-Nenets', 'Omsk', 'Novosibirsk', 'Tomsk', 'Kemerovo', 'Altay', 'Krasnoyarsk', 'Irkutsk']],
  ['Далекий Схід', ['Chita', 'Amur', 'Yevrey', 'Khabarovsk', "Primor'ye", 'Sakhalin', 'Kamchatka', 'Maga Buryatdan', 'Chukchi Autonomous Okrug']],
  ['Урал', ['Sverdlovsk', 'Chelyabinsk', 'Kurgan', "Perm'", 'Orenburg']],
  ['Помор’я', ['Murmansk', "Arkhangel'sk", 'Nenets', 'Vologda']],
  ['Московія', null], // everything else
];
const admin1 = JSON.parse(fs.readFileSync(new URL('./data/admin1.geojson', import.meta.url), 'utf8'));
const rus = admin1.features.filter(f => f.properties.adm0_a3 === 'RUS');
const nationOf = name => { const k = NATIONS.findIndex(([, l]) => l && l.includes(name)); return k >= 0 ? k : NATIONS.length - 1; };
const objs = {}; const ukr = [];
for (const f of rus) {
  const nm = f.properties.name || '';
  if (/Crimea|Sevastopol/.test(nm)) { ukr.push(f); continue; } // occupied Ukrainian land stays Ukraine
  const k = nationOf(nm); (objs['n' + k] ||= { type: 'FeatureCollection', features: [] }).features.push(f);
}
objs.ukr = { type: 'FeatureCollection', features: ukr };
let rt = topology(objs, 1e5);
rt = simplify(presimplify(rt), 0.0008);
const nations = [];
NATIONS.forEach(([name], k) => {
  const o = rt.objects['n' + k]; if (!o) return;
  if (name === 'Московія') return; // drawn as sea
  const geom = merge(rt, o.geometries);
  for (const p of partsOf(geom)) addPoly(p, 0, k);
  const members = objs['n' + k].features;
  const lat = members.reduce((s, f) => s + f.properties.latitude, 0) / members.length, lng = members.reduce((s, f) => s + f.properties.longitude, 0) / members.length;
  nations[k] = [name, Math.round(lat * 100) / 100, Math.round(lng * 100) / 100];
});
for (const p of partsOf(merge(rt, rt.objects.ukr.geometries))) addPoly(p, 0, -1);

// nation cities: name, lat, lng, tier, port, nation
const NC = `Грозний,43.32,45.69,1,0,Ічкерія|Магас,43.17,44.81,1,0,Інгушетія|Махачкала,42.98,47.50,1,1,Дагестан|Нальчик,43.49,43.62,1,0,Черкесія|Владикавказ,43.02,44.68,1,0,Аланія|Еліста,46.31,44.26,1,1,Калмикія|Казань,55.79,49.12,2,1,Татарстан|Уфа,54.74,55.97,2,0,Башкортостан|Чебоксари,56.15,47.25,1,1,Чувашія|Йошкар-Ола,56.63,47.89,1,0,Марій Ел|Іжевськ,56.85,53.20,1,0,Удмуртія|Саранськ,54.18,45.17,1,1,Ерзянь Мастор|Сиктивкар,61.67,50.84,1,1,Комі|Петрозаводськ,61.79,34.36,1,0,Карелія|Санкт-Петербург,59.94,30.31,2,1,Інгрія|Якутськ,62.03,129.73,1,0,Саха|Улан-Уде,51.83,107.58,1,0,Бурятія|Кизил,51.72,94.45,1,0,Тива|Абакан,53.72,91.43,1,0,Хакасія|Горно-Алтайськ,51.96,85.96,1,0,Алтай|Кенігсберг,54.71,20.51,1,1,Кенігсберг|Краснодар,45.04,38.98,1,1,Кубань|Новоросійськ,44.72,37.77,1,1,Кубань|Новосибірськ,55.03,82.92,2,0,Сибір|Омськ,54.99,73.37,1,0,Сибір|Красноярськ,56.01,92.85,1,0,Сибір|Іркутськ,52.29,104.28,1,0,Сибір|Тюмень,57.15,65.53,1,0,Сибір|Владивосток,43.12,131.89,2,1,Далекий Схід|Хабаровськ,48.48,135.08,1,0,Далекий Схід|Чита,52.03,113.50,1,0,Далекий Схід|Петропавловськ-Камчатський,53.02,158.65,1,1,Далекий Схід|Магадан,59.56,150.80,1,1,Далекий Схід|Южно-Сахалінськ,46.96,142.73,1,1,Далекий Схід|Єкатеринбург,56.84,60.61,2,0,Урал|Челябінськ,55.16,61.40,1,0,Урал|Перм,58.01,56.23,1,0,Урал|Оренбург,51.77,55.10,1,1,Урал|Архангельськ,64.54,40.54,1,1,Помор’я|Мурманськ,68.97,33.07,1,1,Помор’я`;
for (const s of NC.split('|')) { const a = s.split(','); C.push([a[0], +a[1], +a[2], +a[3], +a[4], -1, NATIONS.findIndex(n => n[0] === a[5])]); }
for (const c of C) if (c.length < 7) c.push(-1);
function pip(r, x, y) { let ins = false; for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
function classify(lng, lat) { return classify1(lng, lat) || classify1(lng + 360, lat) || classify1(lng - 360, lat); }
function classify1(lng, lat) {
  for (const p of polys) {
    const b = p.bbox; if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
    if (pip(p.rings[0], lng, lat)) { let hole = false; for (let k = 1; k < p.rings.length; k++) if (pip(p.rings[k], lng, lat)) { hole = true; break; } if (!hole) return p.v ? 2 : 1; }
  }
  return 0;
}
const RS = 0.25, RW = 360 / RS, RH = 180 / RS, R = new Uint8Array(RW * RH);
for (let j = 0; j < RH; j++) { const lat = 90 - (j + 0.5) * RS; for (let i = 0; i < RW; i++) R[j * RW + i] = classify(-180 + (i + 0.5) * RS, lat); }
const cell = (lng, lat) => { let i = Math.floor((lng + 180) / RS), j = Math.floor((90 - lat) / RS); i = (i % RW + RW) % RW; j = Math.max(0, Math.min(RH - 1, j)); return R[j * RW + i]; };

// ---------- geodesy ----------
const D = Math.PI / 180;
const vec = (lat, lng) => [Math.cos(lat * D) * Math.cos(lng * D), Math.cos(lat * D) * Math.sin(lng * D), Math.sin(lat * D)];
const V = C.map(c => vec(c[1], c[2]));
const km = (a, b) => Math.acos(Math.min(1, V[a][0] * V[b][0] + V[a][1] * V[b][1] + V[a][2] * V[b][2])) * 6371;
function samples(a, b, n) {
  const A = V[a], B = V[b], w = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), out = [];
  for (let k = 1; k < n; k++) { const t = k / n, s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
    const x = A[0] * s1 + B[0] * s2, y = A[1] * s1 + B[1] * s2, z = A[2] * s1 + B[2] * s2; out.push([Math.atan2(y, x) / D, Math.asin(z) / D, t]); }
  return out;
}
const N = C.length, cand = [];
for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
  const d = km(a, b), n = Math.max(8, Math.ceil(d / 25));
  const S = samples(a, b, n).map(([x, y, t]) => [cell(x, y), t]);
  if (S.some(s => s[0] === 2)) continue; // never through the void
  const land = S.filter(s => s[0] === 1).length / S.length;
  let run = 0, maxRun = 0; for (const s of S) { run = s[0] === 0 ? run + 1 : 0; maxRun = Math.max(maxRun, run); } const waterKm = maxRun * d / n;
  const mid = S.filter(s => s[1] > 0.12 && s[1] < 0.88), midWater = mid.filter(s => s[0] === 0).length / Math.max(1, mid.length);
  if (d < 2000 && land > 0.7 && waterKm < 130) cand.push([a, b, 0, d]);
  else if (C[a][4] && C[b][4] && d < 6800 && midWater > 0.9) cand.push([a, b, 1, d]);
  if (C[a][3] === 3 && C[b][3] === 3 && d < 7000) cand.push([a, b, 2, d]);
}
const key = (a, b) => a < b ? a + '_' + b : b + '_' + a;
const cost = e => e[3] * (e[2] === 1 ? 1.3 : 1);
const best = new Map();
for (const e of cand.filter(e => e[2] !== 2)) { const k = key(e[0], e[1]), p = best.get(k); if (!p || cost(e) < cost(p)) best.set(k, e); }
let surf = [...best.values()];
// prune: drop A-B if there is a C with both legs shorter and a total detour < 35%
{
  const byNode = Array.from({ length: N }, () => new Map());
  for (const e of surf) { byNode[e[0]].set(e[1], cost(e)); byNode[e[1]].set(e[0], cost(e)); }
  surf = surf.filter(e => { const [a, b] = e, ce = cost(e);
    for (const [c, ca] of byNode[a]) { if (c === b) continue; const cb = byNode[b].get(c); if (cb !== undefined && Math.max(ca, cb) < ce && ca + cb < ce * 1.35) return false; }
    return true; });
  // cap long sea routes: each port keeps at most 3 sea links, shortest first
  const seaDeg = new Array(N).fill(0);
  surf = surf.sort((x, y) => x[3] - y[3]).filter(e => { if (e[2] !== 1) return true; if (seaDeg[e[0]] >= 3 || seaDeg[e[1]] >= 3) return false; seaDeg[e[0]]++; seaDeg[e[1]]++; return true; });
}
let air = cand.filter(e => e[2] === 2).sort((x, y) => x[3] - y[3]);
const airDeg = new Array(N).fill(0);
air = air.filter(e => { if (airDeg[e[0]] >= 3 || airDeg[e[1]] >= 3) return false; airDeg[e[0]]++; airDeg[e[1]]++; return true; });
const surfKeys = new Set(surf.map(e => key(e[0], e[1])));
air = air.filter(e => !surfKeys.has(key(e[0], e[1])));
const edges = [...surf, ...air].map(e => [e[0], e[1], e[2], Math.round(e[3])]);

// ---------- report ----------
const G = Array.from({ length: N }, () => []); for (const e of edges) { G[e[0]].push(e[1]); G[e[1]].push(e[0]); }
const comp = new Array(N).fill(-1); let k = 0;
for (let i = 0; i < N; i++) { if (comp[i] >= 0) continue; const st = [i]; comp[i] = k; while (st.length) { const v = st.pop(); for (const w of G[v]) if (comp[w] < 0) { comp[w] = k; st.push(w); } } k++; }
console.log('cities', N, 'edges', edges.length, 'land', edges.filter(e => e[2] === 0).length, 'sea', edges.filter(e => e[2] === 1).length, 'air', edges.filter(e => e[2] === 2).length, 'components', k);
for (let c = 0; c < k; c++) { const m = C.filter((_, i) => comp[i] === c).map(x => x[0]); if (m.length < 20) console.log('small component:', m.join(', ')); }
console.log('degree<=1:', C.filter((_, i) => G[i].length <= 1).map(x => x[0]).join(', '));
// English display names
const EN = {"Лондон":"London","Париж":"Paris","Берлін":"Berlin","Мадрид":"Madrid","Лісабон":"Lisbon","Рим":"Rome","Мілан":"Milan","Марсель":"Marseille","Гамбург":"Hamburg","Амстердам":"Amsterdam","Стокгольм":"Stockholm","Осло":"Oslo","Гельсінкі":"Helsinki","Варшава":"Warsaw","Київ":"Kyiv","Одеса":"Odesa","Харків":"Kharkiv","Львів":"Lviv","Мінськ":"Minsk","Відень":"Vienna","Бухарест":"Bucharest","Будапешт":"Budapest","Афіни":"Athens","Стамбул":"Istanbul","Анкара":"Ankara","Рейкʼявік":"Reykjavik","Дублін":"Dublin","Белград":"Belgrade","Тбілісі":"Tbilisi","Баку":"Baku","Каїр":"Cairo","Порт-Саїд":"Port Said","Тель-Авів":"Tel Aviv","Багдад":"Baghdad","Ер-Ріяд":"Riyadh","Джидда":"Jeddah","Дубай":"Dubai","Маскат":"Muscat","Аден":"Aden","Касабланка":"Casablanca","Алжир":"Algiers","Туніс":"Tunis","Триполі":"Tripoli","Лагос":"Lagos","Дакар":"Dakar","Аккра":"Accra","Абіджан":"Abidjan","Кіншаса":"Kinshasa","Луанда":"Luanda","Хартум":"Khartoum","Аддис-Абеба":"Addis Ababa","Найробі":"Nairobi","Момбаса":"Mombasa","Дар-ес-Салам":"Dar es Salaam","Йоганнесбург":"Johannesburg","Кейптаун":"Cape Town","Дурбан":"Durban","Антананаріву":"Antananarivo","Кано":"Kano","Бамако":"Bamako","Лусака":"Lusaka","Алмати":"Almaty","Астана":"Astana","Актау":"Aktau","Ташкент":"Tashkent","Ашгабат":"Ashgabat","Кабул":"Kabul","Карачі":"Karachi","Лахор":"Lahore","Делі":"Delhi","Мумбаї":"Mumbai","Колката":"Kolkata","Ченнаї":"Chennai","Бенгалуру":"Bengaluru","Коломбо":"Colombo","Дакка":"Dhaka","Катманду":"Kathmandu","Янгон":"Yangon","Бангкок":"Bangkok","Ханой":"Hanoi","Хошимін":"Ho Chi Minh City","Куала-Лумпур":"Kuala Lumpur","Сінгапур":"Singapore","Джакарта":"Jakarta","Сурабая":"Surabaya","Маніла":"Manila","Гонконг":"Hong Kong","Гуанчжоу":"Guangzhou","Шанхай":"Shanghai","Пекін":"Beijing","Ченду":"Chengdu","Ухань":"Wuhan","Сіань":"Xi'an","Урумчі":"Urumqi","Лхаса":"Lhasa","Улан-Батор":"Ulaanbaatar","Сеул":"Seoul","Пусан":"Busan","Токіо":"Tokyo","Осака":"Osaka","Саппоро":"Sapporo","Тайбей":"Taipei","Сідней":"Sydney","Мельбурн":"Melbourne","Перт":"Perth","Дарвін":"Darwin","Брисбен":"Brisbane","Порт-Морсбі":"Port Moresby","Окленд":"Auckland","Торонто":"Toronto","Нью-Йорк":"New York","Вашингтон":"Washington","Чикаго":"Chicago","Маямі":"Miami","Гʼюстон":"Houston","Денвер":"Denver","Лос-Анджелес":"Los Angeles","Сан-Франциско":"San Francisco","Сіетл":"Seattle","Ванкувер":"Vancouver","Монреаль":"Montreal","Галіфакс":"Halifax","Вінніпег":"Winnipeg","Анкоридж":"Anchorage","Нуук":"Nuuk","Мехіко":"Mexico City","Монтеррей":"Monterrey","Гватемала":"Guatemala City","Панама":"Panama City","Гавана":"Havana","Богота":"Bogotá","Каракас":"Caracas","Ліма":"Lima","Кіто":"Quito","Ла-Пас":"La Paz","Сантьяго":"Santiago","Буенос-Айрес":"Buenos Aires","Сан-Паулу":"São Paulo","Ріо-де-Жанейро":"Rio de Janeiro","Бразиліа":"Brasília","Салвадор":"Salvador","Ресіфі":"Recife","Манаус":"Manaus","Гонолулу":"Honolulu","Грозний":"Grozny","Магас":"Magas","Махачкала":"Makhachkala","Нальчик":"Nalchik","Владикавказ":"Vladikavkaz","Еліста":"Elista","Казань":"Kazan","Уфа":"Ufa","Чебоксари":"Cheboksary","Йошкар-Ола":"Yoshkar-Ola","Іжевськ":"Izhevsk","Саранськ":"Saransk","Сиктивкар":"Syktyvkar","Петрозаводськ":"Petrozavodsk","Санкт-Петербург":"St. Petersburg","Якутськ":"Yakutsk","Улан-Уде":"Ulan-Ude","Кизил":"Kyzyl","Абакан":"Abakan","Горно-Алтайськ":"Gorno-Altaysk","Кенігсберг":"Königsberg","Краснодар":"Krasnodar","Новоросійськ":"Novorossiysk","Новосибірськ":"Novosibirsk","Омськ":"Omsk","Красноярськ":"Krasnoyarsk","Іркутськ":"Irkutsk","Тюмень":"Tyumen","Владивосток":"Vladivostok","Хабаровськ":"Khabarovsk","Чита":"Chita","Петропавловськ-Камчатський":"Petropavlovsk","Магадан":"Magadan","Южно-Сахалінськ":"Yuzhno-Sakhalinsk","Єкатеринбург":"Yekaterinburg","Челябінськ":"Chelyabinsk","Перм":"Perm","Оренбург":"Orenburg","Архангельськ":"Arkhangelsk","Мурманськ":"Murmansk"};
const NEN = {"Ічкерія":"Ichkeria","Інгушетія":"Ingushetia","Дагестан":"Dagestan","Черкесія":"Circassia","Аланія":"Alania","Калмикія":"Kalmykia","Татарстан":"Tatarstan","Башкортостан":"Bashkortostan","Чувашія":"Chuvashia","Марій Ел":"Mari El","Удмуртія":"Udmurtia","Ерзянь Мастор":"Erzyan Mastor","Комі":"Komi","Карелія":"Karelia","Інгрія":"Ingria","Саха":"Sakha","Бурятія":"Buryatia","Тива":"Tuva","Хакасія":"Khakassia","Алтай":"Altai","Кенігсберг":"Königsberg","Кубань":"Kuban","Сибір":"Siberia","Далекий Схід":"Far East","Урал":"Ural","Помор’я":"Pomorie"};
for (const c of C) { if (!EN[c[0]]) throw new Error('no English name for ' + c[0]); c[0] = EN[c[0]]; }
for (const n of nations) n[0] = NEN[n[0]] || n[0];
fs.writeFileSync(new URL('../net.js', import.meta.url), 'window.NET=' + JSON.stringify({ cities: C, edges, polys: polys.map(p => [p.v, p.rings, p.n]), nations }) + ';');
console.log('KB', Math.round(fs.statSync(new URL('../net.js', import.meta.url)).size / 1024));
