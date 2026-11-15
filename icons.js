// Line icons in place of emoji. One style for the whole game (24×24, 2px strokes in the text colour, like the ability
// buttons), so a feed line, a chip or a manual card no longer depends on how a phone draws its colour emoji.
// i18n.js calls slIcons on every text node it sees: emoji become inline <svg class="ei">, and tooltips lose them.
(function () {
  var R = function (x) { return Math.round(x * 100) / 100; };
  var pt = function (cx, cy, r, a) { return R(cx + r * Math.cos(a)) + ' ' + R(cy + r * Math.sin(a)); };
  // radiation trefoil: three blades around a dot
  var trefoil = function () {
    var d = '', k, a0, a1;
    for (k = 0; k < 3; k++) { a0 = -Math.PI / 2 - Math.PI / 6 + k * 2 * Math.PI / 3; a1 = a0 + Math.PI / 3;
      d += 'M' + pt(12, 12, 4, a0) + 'L' + pt(12, 12, 9.5, a0) + 'A9.5 9.5 0 0 1 ' + pt(12, 12, 9.5, a1) + 'L' + pt(12, 12, 4, a1) + 'A4 4 0 0 0 ' + pt(12, 12, 4, a0) + 'Z'; }
    return '<path d="' + d + '"/><circle cx="12" cy="12" r="1.2"/>';
  };
  // explosion: a ragged star
  var burst = function () {
    var d = '', k, n = 9;
    for (k = 0; k < n * 2; k++) d += (k ? 'L' : 'M') + pt(12, 12, k % 2 ? 4.6 : (k % 4 ? 9.5 : 10.5), -Math.PI / 2 + k * Math.PI / n);
    return '<path d="' + d + 'Z"/>';
  };
  // gear: eight teeth around a ring
  var gear = function () {
    var d = '', k, n = 8, a, w = Math.PI / n * 0.55;
    for (k = 0; k < n; k++) { a = k * 2 * Math.PI / n;
      d += (k ? 'L' : 'M') + pt(12, 12, 7, a - Math.PI / n + w * 0.4) + 'L' + pt(12, 12, 9.8, a - w) + 'L' + pt(12, 12, 9.8, a + w) + 'L' + pt(12, 12, 7, a + Math.PI / n - w * 0.4); }
    return '<path d="' + d + 'Z"/><circle cx="12" cy="12" r="2.8"/>';
  };
  var I = {
    radiation: trefoil(),
    shield: '<path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6z"/>',
    swords: '<path d="M4 4l12 12M14 18l4-4M16 16l4 4M20 4L8 16M6 14l4 4M8 16l-4 4"/>',
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M5 14a7 7 0 0 0 14 0M3 16l2-2 2 2M17 16l2-2 2 2"/>',
    drone: '<circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/>',
    fist: '<path d="M7 11V8.5a1.5 1.5 0 0 1 3 0V11M10 10V7.5a1.5 1.5 0 0 1 3 0V11M13 10V8.5a1.5 1.5 0 0 1 3 0V11M16 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-1.5A2.5 2.5 0 0 1 7.5 11H11a2 2 0 0 1 0 4H9"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    money: '<path d="M9.5 3h5l-1.5 3.5h-2zM8 7h8c2.6 2.6 4 5.6 4 8.5A4.5 4.5 0 0 1 15.5 20h-7A4.5 4.5 0 0 1 4 15.5C4 12.6 5.4 9.6 8 7z"/><path d="M14 11.2c-.5-.5-1.2-.7-2-.7-1.1 0-2 .6-2 1.4s.9 1.2 2 1.4 2 .6 2 1.4-.9 1.5-2 1.5c-.8 0-1.6-.3-2.1-.8M12 9.5v1M12 16.2v1"/>',
    spy: '<path d="M3 11h18M5.5 11l1.8-5.5a1 1 0 0 1 1.3-.6L12 6l3.4-1.1a1 1 0 0 1 1.3.6L18.5 11"/><circle cx="7.5" cy="16.5" r="2.7"/><circle cx="16.5" cy="16.5" r="2.7"/><path d="M10.2 16h3.6"/>',
    temple: '<path d="M3 21h18M4 18h16M6 18v-6.5M10 18v-6.5M14 18v-6.5M18 18v-6.5M3 11.5h18L12 4z"/>',
    warning: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    medal: '<path d="M8 3l3 6M16 3l-3 6M7 3h3M14 3h3"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.4l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.2 1.8-.3z"/>',
    mask: '<path d="M5 4h14v7a7 7 0 0 1-14 0z"/><path d="M8.5 9.5h2M13.5 9.5h2M9 14.5c1.8 1.2 4.2 1.2 6 0"/>',
    plane: '<path d="M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7.5 4.5V16l-7.5-2.5V19l2 1.5V22L12 21l-3.5 1v-1.5l2-1.5v-5.5L3 16v-2.5L10.5 9z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2.5 4L16 12H5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    thumb: '<path d="M7 10v11M3 10h4v11H3zM7 10l4-7a2 2 0 0 1 2 2v4h5.3a2 2 0 0 1 2 2.4l-1.3 6.2A3 3 0 0 1 16 21H7"/>',
    fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 11h10M14 8.5h1.5a2 2 0 0 1 2 2V16a1.5 1.5 0 0 0 3 0V8.5L18 6"/>',
    grain: '<path d="M12 21V6M12 6c-1.8-.4-3-2-3-3.8 1.8.3 3 1.6 3 3.3M12 6c1.8-.4 3-2 3-3.8-1.8.3-3 1.6-3 3.3M12 11c-2-.3-3.5-1.8-3.8-3.8 2 .3 3.5 1.7 3.8 3.5M12 11c2-.3 3.5-1.8 3.8-3.8-2 .3-3.5 1.7-3.8 3.5M12 16c-2-.3-3.5-1.8-3.8-3.8 2 .3 3.5 1.7 3.8 3.5M12 16c2-.3 3.5-1.8 3.8-3.8-2 .3-3.5 1.7-3.8 3.5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5z"/>',
    radar: '<circle cx="12" cy="12" r="1.8"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.5 1.2 4.6 3 5.9V20h9v-3.6c1.8-1.3 3-3.4 3-5.9A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="10.5" r="1.6"/><circle cx="15" cy="10.5" r="1.6"/><path d="M10.5 20v-2M13.5 20v-2"/>',
    burst: burst(),
    rail: '<path d="M8.5 3L6 21M15.5 3L18 21M7.6 7.5h8.8M7 12h10M6.4 16.5h11.2"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
    pin: '<path d="M12 21.5s7-6.4 7-11.5a7 7 0 0 0-14 0c0 5.1 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.5"/>',
    pointer: '<path d="M10 12V5a2 2 0 0 1 4 0v6M14 10.5a2 2 0 0 1 4 0V14a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 5 15.5V14a2 2 0 0 1 4 0"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 1.8L14.5 4M9.5 20l2.5-1.8 2.5 1.8M4.2 10.5l2.9-1.2-.4-3M19.8 13.5l-2.9 1.2.4 3M4.2 13.5l2.9 1.2-.4 3M19.8 10.5l-2.9-1.2.4-3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.1a5 5 0 0 1 5 5.4"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    satellite: '<path d="M13 7L9 3 5 7l4 4"/><path d="M17 11l4 4-4 4-4-4"/><path d="M8 12l4 4 6-6-4-4z"/><path d="M16 8l3-3"/><path d="M9 21a6 6 0 0 0-6-6"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11.5h7M9 15.5h7"/>',
    rings: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
    trophy: '<path d="M8 21h8M12 16.5V21M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a3 3 0 0 0 3 4.2M17 6h2.5a3 3 0 0 1-3 4.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    peace: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 12l-6.4 6.4M12 12l6.4 6.4"/>',
    cyclone: '<path d="M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a3.5 3.5 0 1 0-7 0a5.5 5.5 0 1 0 11 0a7.5 7.5 0 1 0-15 0"/>',
    gear: gear(),
    umbrella: '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v7a2 2 0 0 1-4 0"/>',
    siren: '<path d="M7 18v-5a5 5 0 0 1 10 0v5M5 21h14v-3H5zM12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4"/>',
  };
  // emoji (and the few dingbats that phones draw as emoji) → icon
  var MAP = {
    '☢': 'radiation', '🛡': 'shield', '⚔': 'swords', '⚓': 'anchor', '🛸': 'drone', '✊': 'fist', '⚡': 'bolt', '💰': 'money',
    '🕵': 'spy', '🏛': 'temple', '⚠': 'warning', '🎖': 'medal', '🎭': 'mask', '✈': 'plane', '⚑': 'flag', '➕': 'plus', '👍': 'thumb',
    '⛽': 'fuel', '🌾': 'grain', '🌙': 'moon', '📡': 'radar', '☠': 'skull', '💥': 'burst', '🛤': 'rail', '📲': 'phone', '📍': 'pin',
    '👆': 'pointer', '🗓': 'calendar', '❄': 'snow', '👥': 'users', '💡': 'bulb', '🛰': 'satellite', '📜': 'doc', '🤝': 'rings',
    '🏆': 'trophy', '☀': 'sun', '🕊': 'peace', '☮': 'peace', '🌀': 'cyclone', '⚙': 'gear', '☔': 'umbrella', '🚨': 'siren',
  };
  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  var src = '(?:' + keys.join('|') + ')\\uFE0F?';
  var TEST = new RegExp(src, 'u'), SPLIT = new RegExp('(' + src + ')', 'u'), ALL = new RegExp(src + '\\s?', 'gu');
  var markup = function (ch) { var k = MAP[ch.replace(/️/g, '')]; return k ? '<svg class="ei" viewBox="0 0 24 24" aria-hidden="true">' + I[k] + '</svg>' : ''; };
  var css = document.createElement('style');
  css.textContent = '.ei{display:inline-block;width:1.08em;height:1.08em;vertical-align:-.18em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none;overflow:visible}';
  (document.head || document.documentElement).appendChild(css);
  window.slIcons = {
    test: function (s) { return TEST.test(s); },
    split: function (s) { return s.split(SPLIT); },          // text, emoji, text, emoji, … (odd items are emoji)
    markup: markup,                                         // the <svg> for one emoji
    strip: function (s) { return s.replace(ALL, ''); },      // for tooltips, which cannot hold an icon
    svg: function (name) { return I[name] ? '<svg class="ei" viewBox="0 0 24 24" aria-hidden="true">' + I[name] + '</svg>' : ''; },
    names: Object.keys(I), map: MAP,
  };
})();
