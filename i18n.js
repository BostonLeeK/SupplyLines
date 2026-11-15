// Runtime translator: English stays the source language in the code; this layer swaps visible text for
// Ukrainian as it appears on the page (text nodes and title/placeholder attributes), using i18n-uk.js.
// Language: ?lang=uk|en, then the saved choice, then the browser/timezone. window.slLang.set('en'|'uk') switches live.
(function () {
  var D = window.SL_I18N || { dict: {}, pat: [] };
  var dict = D.dict, cache = new Map(), originals = new WeakMap(), missing = new Set();   // texts with no translation yet
  var lang = (function () {
    try { var q = new URLSearchParams(location.search).get('lang'); if (q === 'uk' || q === 'en') { localStorage.setItem('sl-lang', q); return q; } } catch (e) {}
    try { var s = localStorage.getItem('sl-lang'); if (s === 'uk' || s === 'en') return s; } catch (e) {}
    var langs = (navigator.languages || [navigator.language || '']).join(' ');
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return /\buk\b|^uk|uk-/i.test(langs) || /Kyiv|Kiev|Zaporozhye|Uzhgorod/.test(tz) ? 'uk' : 'en';
  })();
  document.documentElement.lang = lang;

  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'); };
  // text is compared with its outer spaces trimmed, so a template's own outer spaces are dropped too
  // a value at either end may sit in its own element (<b>Kyiv</b>), so each template also matches without it
  var pats = [];
  (D.pat || []).forEach(function (parts) {
    var vs = [parts];
    if (parts.length > 1 && parts[parts.length - 1] === '') vs.push(parts.slice(0, -1));
    if (parts.length > 1 && parts[0] === '') vs.push(parts.slice(1));
    if (parts.length > 2 && parts[0] === '' && parts[parts.length - 1] === '') vs.push(parts.slice(1, -1));
    vs.forEach(function (v) {
      v = v.slice(); v[0] = v[0].replace(/^\s+/, ''); v[v.length - 1] = v[v.length - 1].replace(/\s+$/, '');
      if (!/[A-Za-z]{2,}/.test(v.join(''))) return;
      pats.push({ parts: v, re: new RegExp('^' + v.map(esc).join('([\\s\\S]+?)') + '$') });
    });
  });
  var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };
  // hand-written rules for sentences built from nested conditions: {n} = translated capture, $n = capture as is
  var rules = (D.rx || []).map(function (r) { return { re: new RegExp(r[0]), to: r[1] }; });
  function rule(core, depth) {
    for (var i = 0; i < rules.length; i++) {
      var m = rules[i].re.exec(core); if (!m) continue;
      return rules[i].to.replace(/\{(\d)\}/g, function (_, n) { return tr(m[+n] || '', depth + 1); }).replace(/\$(\d)/g, function (_, n) { return m[+n] || ''; });
    }
    return null;
  }

  // a fixed piece of a sentence: keep its own surrounding spaces, translate the words
  function part(p) {
    var m = p.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
    if (!/[A-Za-z]{2,}/.test(core)) return p;
    var t = dict[norm(core)]; return t === undefined ? null : m[1] + t + m[3];
  }
  function tr(s, depth) {
    if (lang === 'en' || !s || !/[A-Za-z]/.test(s)) return s;
    var hit = cache.get(s); if (hit !== undefined) return hit;
    var m = s.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2], out = null, t = dict[norm(core)];
    if (t !== undefined) out = m[1] + t + m[3];
    if (out === null && (depth || 0) < 3) { var ru = rule(core, depth || 0); if (ru !== null) out = m[1] + ru + m[3]; }
    // symbols and punctuation around the words (★ Toronto, 🏛 Great Port, · 0 votes:) stay as they are
    if (out === null) { var sm = core.match(/^([^A-Za-z]*)([A-Za-z][\s\S]*?[A-Za-z)%]|[A-Za-z])([^A-Za-z)%]*)$/); if (sm && (sm[1] || sm[3])) { var inner = tr(sm[2], (depth || 0) + 1); if (inner !== sm[2]) out = m[1] + sm[1] + inner + sm[3] + m[3]; } }
    if (out === null && (depth || 0) < 3) {
      for (var i = 0; i < pats.length && out === null; i++) {
        var p = pats[i], r = p.re.exec(core); if (!r) continue;
        var res = '', ok = true;
        for (var k = 0; k < p.parts.length; k++) {
          var tp = part(p.parts[k]); if (tp === null) { ok = false; break; }
          res += tp; if (k < p.parts.length - 1) res += tr(r[k + 1], (depth || 0) + 1);
        }
        if (ok) out = m[1] + res + m[3];
      }
    }
    if (out === null) { out = s; if (!depth && /[A-Za-z]{3,}/.test(core) && missing.size < 2000) missing.add(core); }
    if (cache.size > 6000) cache.clear(); cache.set(s, out); return out;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, PRE: 1, NOSCRIPT: 1 };
  function skip(el) { return !el || SKIP[el.nodeName] || (el.closest && el.closest('[translate="no"],.notr')); }
  function text(n) {
    var v = n.nodeValue; if (n.__slOut === v) return;          // our own last write
    if (skip(n.parentNode)) return;
    originals.set(n, v);
    var t = tr(v); n.__slOut = t; if (t !== v) n.nodeValue = t;
  }
  var ATTRS = ['title', 'placeholder', 'aria-label'];
  function attrs(el) {
    if (skip(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute && el.getAttribute(a); if (!v) continue;
      var key = '__sl_' + a; if (el[key] === v) continue;
      el[key + '_en'] = v; var t = tr(v); el[key] = t; if (t !== v) el.setAttribute(a, t);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return text(root);
    if (root.nodeType !== 1 || skip(root)) return;
    attrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) text(n); else attrs(n); }
  }
  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'characterData') text(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // whatever is already on the page when this script runs (pages that load it at the end of <body>)
  walk(document.documentElement);

  function set(l) {
    if (l !== 'uk' && l !== 'en') return; lang = l; cache.clear();
    try { localStorage.setItem('sl-lang', l); } catch (e) {}
    document.documentElement.lang = l;
    // back to the English originals, then translate again if needed
    var w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { var o = originals.get(n); if (o !== undefined && n.nodeValue === n.__slOut) { n.__slOut = undefined; n.nodeValue = o; } text(n); }
      else for (var i = 0; i < ATTRS.length; i++) { var a = ATTRS[i], en = n['__sl_' + a + '_en']; if (en && n.getAttribute(a) === n['__sl_' + a]) { n['__sl_' + a] = undefined; n.setAttribute(a, en); } attrs(n); }
    }
    document.dispatchEvent(new CustomEvent('sl-lang', { detail: l }));
  }
  // slLang.missing() lists texts that stayed English: handy for adding translations
  window.slLang = { get: function () { return lang; }, set: set, tr: function (s) { return tr(s); }, missing: function () { return Array.from(missing); } };
})();
