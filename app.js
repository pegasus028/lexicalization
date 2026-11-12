/* Lexicalization front end. Talks to the Apps Script backend (config.js) or, when none is set,
   to the in-browser demo (js/demo.js). All scoring logic lives in js/core.js. */
(function () {
  'use strict';
  var C = LexCore, $ = function (s, r) { return (r || document).querySelector(s); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  var S = { api: '', demo: true, pin: '', state: null, sel: null, metric: 'byPlatform', search: null, draft: null, reviewTerm: null, reviewAll: false, hits: null, busy: false };
  var PF = {}; C.PLATFORMS.forEach(function (p) { PF[p.id] = p.name; });
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var METRICS = { byPlatform: 'Counted uses', targetBy: 'New-meaning hits', readBy: 'All matching hits' };
  var LABEL = { sense: { target: 'New meaning', other: 'Other meaning', unclear: 'Unclear' }, ownership: { owned: 'Coiner (owned)', class: 'Classmate or teacher', earned_in: 'Inside her network', earned_out: 'Outside her network' }, marked: { Y: 'Marked', N: 'Unmarked' }, prompted: { N: 'Not asked for', Y: 'Asked for (prompted)' } };

  /* ---------- small helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElementNS(/^(svg|g|rect|line|path|circle|text|title)$/.test(tag) ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag), k, i, c;
    for (k in attrs || {}) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'text') el.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'value' && 'value' in el) el.value = attrs[k]; else if (k === 'checked') el.checked = !!attrs[k]; else el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) { c = arguments[i]; if (c == null || c === false) continue; (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) el.appendChild(typeof x === 'object' ? x : document.createTextNode(String(x))); }); }
    return el;
  }
  function day(d) { return new Date(C.ms(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); }
  function dayLong(d) { return new Date(C.ms(d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  function signed(n) { return n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : 'no change'; }
  function bandClass(b) { return b === 'Likely' ? 'ok' : b === 'Fringe' ? 'warn' : 'bad'; }
  function pill(text, cls) { return h('span', { class: 'pill ' + (cls || ''), text: text }); }
  var toastT; function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3800); }
  function cssVar(n) { return 'var(--p-' + n + ')'; }
  function sel(options, value, onchange, label) { return h('select', { 'aria-label': label, onchange: onchange }, Object.keys(options).map(function (k) { return h('option', { value: k, selected: k === value, text: options[k] }); })); }

  /* ---------- backend ---------- */
  function call(req) {
    if (S.demo) return new Promise(function (res) { setTimeout(function () { res(LexDemo.call(req)); }, 120); });
    req.pin = S.pin;
    return fetch(S.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('The backend answered HTTP ' + r.status + '.'); return r.json(); })
      .catch(function (e) { return { ok: false, error: e.message === 'Failed to fetch' ? 'Could not reach the backend. Check the web app URL and that it is deployed for "Anyone".' : e.message }; });
  }
  function act(req, okMsg) {
    if (S.busy) return Promise.resolve({ ok: false });
    S.busy = true; $('#app').classList.add('busy');
    return call(req).then(function (r) {
      S.busy = false; $('#app').classList.remove('busy');
      if (!r.ok) { toast(r.error || 'Something went wrong.'); if (/PIN/.test(r.error || '')) { S.pin = ''; chrome(); } }
      else if (okMsg) toast(okMsg);
      return r;
    });
  }
  function refresh() { return call({ action: 'state' }).then(function (r) { if (r.ok) { S.state = r; if (!term(S.sel)) S.sel = pickDefault(); } else S.error = r.error; chrome(); return r; }); }
  function term(id) { return S.state && S.state.terms.filter(function (t) { return t.id === id; })[0]; }
  function last(t) { return t.series[t.series.length - 1]; }
  function pickDefault() { var st = students().filter(function (t) { return t.series.length; }); st.sort(function (a, b) { return last(b).fudge - last(a).fudge; }); return (st[0] || S.state.terms[0] || {}).id || null; }
  function students() { return S.state.terms.filter(function (t) { return t.role === 'student'; }); }
  function authed() { return S.demo || !!S.pin; }

  /* ---------- chrome ---------- */
  var VIEWS = [['', 'Dashboard'], ['search', 'Search'], ['terms', 'Terms'], ['review', 'Review'], ['settings', 'Settings']];
  function route() { return (location.hash.replace(/^#\/?/, '').split('/')[0]) || ''; }
  function chrome() {
    var r = route(), nav = $('#nav'), review = S.state ? S.state.terms.reduce(function (a, t) { return a + (t.review || 0); }, 0) : 0;
    nav.replaceChildren.apply(nav, VIEWS.map(function (v) { return h('a', { href: '#/' + v[0], 'aria-current': v[0] === r ? 'page' : null }, v[1], v[0] === 'review' && review ? h('span', { class: 'dot', text: review, title: review + ' hits need review' }) : null); }));
    var lock = $('#lock'); lock.textContent = S.demo ? 'Demo' : S.pin ? 'Lock' : 'Teacher PIN'; lock.disabled = S.demo;
    var b = $('#banner'); b.hidden = !S.demo; if (S.demo) b.textContent = 'Demo mode: every term, hit and number here is simulated. Connect the backend in Settings to search the live web.';
    $('#ver').textContent = 'v' + C.VERSION;
  }
  function pinGate(app, what) {
    var input = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Teacher PIN', placeholder: 'Teacher PIN' });
    var go = function (e) { e.preventDefault(); S.pin = input.value.trim(); act({ action: 'login' }, 'Unlocked').then(function (r) { if (r.ok) { store.set('lex_pin_session', null); chrome(); render(); } else S.pin = ''; }); };
    app.replaceChildren(h('h1', { text: what }), h('form', { class: 'card stack', onsubmit: go, style: 'max-width:420px' },
      h('p', { text: 'This part uses search credits and edits the tracked terms, so it needs the teacher PIN. The dashboard stays open to everyone.' }), input, h('button', { type: 'submit', text: 'Unlock' })));
    input.focus();
  }

  /* ---------- charts ---------- */
  function tipFor(box) {
    var t = h('div', { class: 'tip', hidden: true }); box.appendChild(t);
    return { show: function (lines, x, y) { t.replaceChildren.apply(t, lines.map(function (s) { return h('div', { text: s }); })); t.hidden = false; var w = t.offsetWidth; t.style.left = Math.max(0, Math.min(box.clientWidth - w, x - w / 2)) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 8) + 'px'; }, hide: function () { t.hidden = true; } };
  }
  function ticks(max) { var step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10, out = [], v; for (v = 0; v <= max; v += step) out.push(v); return out; }
  function stackedChart(box, t, metric) {
    box.replaceChildren();
    var ser = t.series, W = Math.max(300, box.clientWidth), H = 260, m = { t: 16, r: 8, b: 26, l: 30 }, ids = C.PLATFORMS.map(function (p) { return p.id; });
    var totals = ser.map(function (s) { return ids.reduce(function (a, id) { return a + (s[metric][id] || 0); }, 0); }), top = Math.max(4, Math.max.apply(null, totals.concat([0])));
    var tk = ticks(top); top = tk[tk.length - 1] < top ? tk[tk.length - 1] + (tk[1] - tk[0]) : tk[tk.length - 1]; if (tk[tk.length - 1] < top) tk.push(top);
    var bw = (W - m.l - m.r) / Math.max(1, ser.length), y = function (v) { return H - m.b - v / top * (H - m.t - m.b); };
    var svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': METRICS[metric] + ' for ' + t.word + ' at each run, stacked by where they were found' });
    tk.forEach(function (v) { svg.appendChild(h('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: 'var(--grid)' })); svg.appendChild(h('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', text: v })); });
    box.appendChild(svg); var tp = tipFor(box), every = Math.ceil(ser.length / Math.max(2, Math.floor((W - m.l) / 58)));
    ser.forEach(function (s, i) {
      var x = m.l + i * bw + bw * 0.14, w = bw * 0.72, acc = 0, lines = ['Run of ' + dayLong(s.date) + (s.kind === 'baseline' ? ' (baseline)' : '')];
      ids.forEach(function (id) { var v = s[metric][id] || 0; if (!v) return; svg.appendChild(h('rect', { x: x, width: w, y: y(acc + v), height: Math.max(0, y(acc) - y(acc + v) - 1), fill: cssVar(id), rx: 1.5 })); acc += v; lines.push(PF[id] + ': ' + v); });
      if (acc && (w >= 20 || i === ser.length - 1)) svg.appendChild(h('text', { class: 'v', x: x + w / 2, y: y(acc) - 5, 'text-anchor': 'middle', text: acc })); else lines.push('None');
      if (i === ser.length - 1 || (i % every === 0 && ser.length - 1 - i >= every)) svg.appendChild(h('text', { x: x + w / 2, y: H - 8, 'text-anchor': 'middle', text: day(s.date) }));
      svg.appendChild(h('rect', { x: m.l + i * bw, width: bw, y: m.t, height: H - m.t - m.b, fill: 'transparent', onpointermove: function () { tp.show(lines, x + w / 2, y(acc)); }, onpointerleave: tp.hide }));
    });
  }
  function fudgeChart(box, t) {
    box.replaceChildren();
    var ser = t.series, W = Math.max(300, box.clientWidth), H = 230, m = { t: 14, r: 34, b: 26, l: 30 };
    var x = function (i) { return m.l + (ser.length > 1 ? i * (W - m.l - m.r) / (ser.length - 1) : (W - m.l - m.r) / 2); }, y = function (v) { return H - m.b - v / 10 * (H - m.t - m.b); };
    var svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': 'Observed FUDGE score for ' + t.word + ' at each run' });
    [0, 2, 4, 6, 8, 10].forEach(function (v) { svg.appendChild(h('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: 'var(--grid)' })); svg.appendChild(h('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', text: v })); });
    [[7, 'Likely'], [5, 'Fringe']].forEach(function (b) { svg.appendChild(h('line', { x1: m.l, x2: W - m.r, y1: y(b[0]), y2: y(b[0]), stroke: 'var(--muted)', 'stroke-dasharray': '4 3' })); svg.appendChild(h('text', { x: m.l + 4, y: y(b[0]) - 4, text: b[1] + ' from ' + b[0] })); });
    if (ser.length) svg.appendChild(h('path', { d: 'M' + ser.map(function (s, i) { return x(i) + ',' + y(s.fudge); }).join(' L'), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5 }));
    box.appendChild(svg); var tp = tipFor(box), every = Math.ceil(ser.length / Math.max(2, Math.floor((W - m.l) / 58)));
    ser.forEach(function (s, i) {
      svg.appendChild(h('circle', { cx: x(i), cy: y(s.fudge), r: 3.5, fill: 'var(--accent)' }));
      if (i === ser.length - 1 || (i % every === 0 && ser.length - 1 - i >= every)) svg.appendChild(h('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', text: day(s.date) }));
      if (i === ser.length - 1) svg.appendChild(h('text', { class: 'v', x: x(i) + 8, y: y(s.fudge) + 4, text: s.fudge }));
      svg.appendChild(h('rect', { x: x(i) - 12, width: 24, y: m.t, height: H - m.t - m.b, fill: 'transparent', onpointermove: function () { tp.show(['Run of ' + dayLong(s.date), 'FUDGE ' + s.fudge + ' of 10 (' + s.band + ')', 'F' + s.F + ' U' + s.U + ' D' + s.D + ' G' + s.G + ' E' + s.E, s.earned + ' counted uses in 7 days'], x(i), y(s.fudge)); }, onpointerleave: tp.hide }));
    });
  }
  function spark(t) {
    var ser = t.series, W = 200, H = 34, svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (ser.length > 1) svg.appendChild(h('path', { d: 'M' + ser.map(function (s, i) { return (i * W / (ser.length - 1)).toFixed(1) + ',' + (H - 3 - s.fudge / 10 * (H - 6)).toFixed(1); }).join(' L'), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
    return svg;
  }

  /* ---------- dashboard ---------- */
  function nextRun(st) {
    var days = C.list(st.settings.days).map(Number), hour = Number(st.settings.hour) || 6, t = C.ms(st.today), i;
    if (!days.length) return 'No automatic runs are scheduled.';
    for (i = 1; i <= 7; i++) if (days.indexOf(new Date(t + i * C.DAY).getUTCDay()) >= 0) return 'Next automatic run: ' + dayLong(t + i * C.DAY) + ', ' + ('0' + hour).slice(-2) + ':00 Bangkok time.';
    return '';
  }
  function viewDashboard(app) {
    var st = S.state, studs = students().filter(function (t) { return t.series.length; });
    if (!st.terms.length) { app.replaceChildren(h('h1', { text: 'No terms are being tracked yet' }), h('p', { class: 'lede', text: 'Search a word to see where it is being used, then save it as a tracked term. Up to ' + C.MAX_TERMS + ' terms are searched automatically on the schedule.' }), h('p', {}, h('a', { class: 'btn', href: '#/search', text: 'Search a word' }))); return; }
    var likely = studs.filter(function (t) { return last(t).fudge >= 7; }).length, lead = studs.slice().sort(function (a, b) { return last(b).fudge - last(a).fudge || last(b).earned - last(a).earned; })[0];
    var u = st.usage, head = h('div', { class: 'stack' }, h('h1', { text: lead ? likely + ' of ' + studs.length + ' terms score 7 or more; "' + lead.word + '" leads on ' + last(lead).fudge : 'Waiting for the first run' }),
      h('p', { class: 'lede muted', text: 'Observed FUDGE (0 to 10) is built only from counted uses: the new meaning, used by someone outside the class, without being asked. It is evidence for analysis, not a mark.' }),
      h('div', { class: 'row small muted' }, h('span', { text: nextRun(st) }), h('span', { class: 'num', text: 'Searches this month: ' + u.queries + (u.cap ? ' of ' + u.cap : '') })));
    var grid = h('div', { class: 'grid', id: 'term-grid' }, st.terms.map(function (t) {
      var l = last(t), prev = t.series[t.series.length - 2];
      return h('button', { class: 'tcard', type: 'button', 'aria-pressed': String(t.id === S.sel), 'data-term': t.id, onclick: function () { S.sel = t.id; render(); var d = $('#detail'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
        h('span', { class: 'row spread' }, h('span', { class: 'w', text: t.word }), t.role !== 'student' ? pill(t.role === 'foil' ? 'Foil' : 'Control', 'muted') : l ? pill(l.band, bandClass(l.band)) : null),
        h('span', { class: 'small muted', text: t.role === 'student' ? (t.coiner || 'No coiner set') : 'Instrument check word' }),
        l ? h('span', { class: 'row spread' }, h('span', { class: 'big', text: l.fudge }), h('span', { class: 'small muted', text: (prev ? signed(l.fudge - prev.fudge) : 'first run') + ' · ' + l.earned + ' uses' })) : h('span', { class: 'small muted', text: 'Not run yet' }), spark(t));
    }));
    app.replaceChildren(head, h('section', { class: 'stack', 'aria-label': 'Tracked terms' }, h('h2', { text: 'Tracked terms' }), grid), detail(term(S.sel)), instrument());
    drawCharts();
  }
  function drawCharts() { var t = term(S.sel); if (!t || !t.series.length) return; var a = $('#chart-usage'), b = $('#chart-fudge'); if (a) stackedChart(a, t, S.metric); if (b) fudgeChart(b, t); }
  function detail(t) {
    if (!t) return null;
    var l = last(t), p = t.series[t.series.length - 2], box = h('section', { class: 'stack', id: 'detail' });
    box.appendChild(h('div', { class: 'card stack' }, h('div', { class: 'row spread' }, h('h2', { text: t.word }), h('div', { class: 'chips' }, pill(t.kind === 'existing' ? 'Existing word, new meaning' : 'New word', 'muted'), t.dict ? pill(t.dict, 'ok') : null, t.forms.length ? pill('Forms: ' + t.forms.join(', '), 'muted') : null)),
      h('p', { text: t.meaning || 'No meaning recorded.' }), t.coiner ? h('p', { class: 'small muted', text: 'Coined by ' + t.coiner }) : null));
    if (!l) { box.appendChild(h('p', { class: 'card', text: 'This term has not been run yet. Its first run records the baseline.' })); return box; }
    var d = function (k) { return p ? signed(l[k] - p[k]) + ' vs the run before' : 'first run'; };
    box.appendChild(h('div', { class: 'tiles' },
      tile('Observed FUDGE', l.fudge + ' / 10', [d('fudge') + '. ', pill(l.band, bandClass(l.band))]), tile('Counted uses, last 7 days', l.earned, d('earned')),
      tile('Different users, last 28 days', l.users28, 'across ' + l.settings28 + ' of ' + C.PLATFORMS.length + ' settings'), tile('Highest evidence level', 'Level ' + l.level, '4 = inside her network, 5 = outside it')));
    box.appendChild(h('div', { class: 'card stack' }, h('div', { class: 'row spread' }, h('h3', { text: 'Usage by app and location over time' }),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'What to count' }, Object.keys(METRICS).map(function (k) { return h('button', { type: 'button', 'aria-pressed': String(S.metric === k), text: METRICS[k], onclick: function () { S.metric = k; render(); } }); }))),
      h('div', { class: 'legend' }, C.PLATFORMS.map(function (pf) { return h('span', {}, h('span', { class: 'key', style: 'background:' + cssVar(pf.id) }), pf.name); })), h('div', { class: 'chart', id: 'chart-usage' }),
      h('p', { class: 'small muted', text: S.metric === 'byPlatform' ? 'Each bar is the 7 days before that run. Only counted uses are shown.' : S.metric === 'targetBy' ? 'Every hit carrying the new meaning in the 7 days before each run, including the coiner’s own posts and classmates.' : 'Every stored hit that contains the word in the 7 days before each run, whatever its meaning.' })));
    var comps = [['F', 'Frequency', l.earned + ' counted uses in 7 days. 1 to 4 scores 1; 5 or more scores 2.'], ['U', 'Unobtrusiveness', l.unmarked + ' of ' + l.earned + ' uses unmarked (' + l.unmarkedShare + '%). 25% scores 1; 60% with at least 3 uses scores 2.'],
      ['D', 'Diversity', l.users28 + ' users in 28 days across ' + l.settings28 + ' settings. 2 users score 1; 6 or more in 2 or more settings with an outside user score 2.'],
      ['G', 'Generation', 'New forms made by other people: ' + (l.forms.join(', ') || 'none yet') + '. One scores 1; two or more score 2.'], ['E', 'Endurance', 'A counted use in ' + l.activeWeeks + ' of the last 4 weeks. 2 or 3 score 1; all 4 score 2.']];
    box.appendChild(h('div', { class: 'two' }, h('div', { class: 'card stack' }, h('h3', { text: 'Observed FUDGE at each run' }), h('div', { class: 'chart', id: 'chart-fudge' })),
      h('div', { class: 'card' }, h('h3', { text: 'How the score is made up' }), comps.map(function (c) { return h('div', { class: 'comp' }, h('span', { class: 'l', text: c[0] }), h('span', { text: c[1] }), h('span', { class: 'num', text: l[c[0]] + ' / 2' + (p ? ' (was ' + p[c[0]] + ')' : '') }), h('span', { class: 'r small muted', text: c[2] })); }))));
    var rows = C.PLATFORMS.map(function (pf) { return h('tr', {}, h('td', {}, h('span', { class: 'key', style: 'background:' + cssVar(pf.id) }), pf.name), h('td', { class: 'n', text: l.readBy[pf.id] }), h('td', { class: 'n', text: l.targetBy[pf.id] }), h('td', { class: 'n', text: l.byPlatform[pf.id] })); });
    box.appendChild(h('div', { class: 'card stack scroll' }, h('h3', { text: 'Latest run, ' + dayLong(l.date) + ': where the word was found' }),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Setting' }), h('th', { class: 'n', text: 'Matching hits, 7 days' }), h('th', { class: 'n', text: 'New meaning' }), h('th', { class: 'n', text: 'Counted uses' }))), h('tbody', {}, rows)),
      h('p', { class: 'small muted', text: 'Not counted this week: ' + l.owned + ' owned, ' + l.classmates + ' classmate, ' + l.prompted + ' prompted, ' + l.unclear + ' unclear.' + (t.kind === 'existing' && l.senseShare != null ? ' New-meaning share of coded online hits: ' + l.senseShare + '%' + (l.baselineShare != null ? ' (baseline ' + l.baselineShare + '%).' : '.') : '') }),
      t.review ? h('p', { class: 'small' }, h('a', { href: '#/review', text: t.review + ' unclear hits need a decision in Review' })) : null));
    return box;
  }
  function tile(label, big, sub) { return h('div', { class: 'card tile stack' }, h('span', { class: 'small muted', text: label }), h('span', { class: 'big', text: big }), h('span', { class: 'small muted' }, sub)); }
  function instrument() {
    var checks = S.state.terms.filter(function (t) { return t.check; });
    if (!checks.length) return h('p', { class: 'small muted', text: 'No instrument check yet. Save one real slang word as a "control" and one invented word as a "foil" to check the search tool itself each run.' });
    return h('section', { class: 'card stack scroll', id: 'instrument' }, h('h3', { text: 'Instrument check' }), h('table', {}, h('thead', {}, h('tr', {}, h('th', { text: 'Word' }), h('th', { text: 'Role' }), h('th', { class: 'n', text: 'Hits, latest run' }), h('th', { class: 'n', text: 'Median of earlier runs' }), h('th', { text: 'Check' }))),
      h('tbody', {}, checks.map(function (t) { var c = t.check; return h('tr', {}, h('td', { text: c.word }), h('td', { text: c.role === 'foil' ? 'Foil (invented)' : 'Control (real slang)' }), h('td', { class: 'n', text: c.latest }), h('td', { class: 'n', text: c.median == null ? '—' : c.median }), h('td', {}, pill(c.pass ? 'Pass' : 'Flag', c.pass ? 'ok' : 'bad'))); }))),
      h('p', { class: 'small muted', text: 'A control word should stay within 50% of its recent median and a foil at zero. A flag means the search tool changed that run, not the language.' }));
  }

  /* ---------- search ---------- */
  function termFields(d, compact) {
    var f = function (key, label, hint, ph, wide) { return h('label', { class: wide ? 'wide' : '' }, h('span', {}, label, hint ? h('span', { class: 'hint', text: ' ' + hint }) : null), h('input', { name: key, value: Array.isArray(d[key]) ? d[key].join(', ') : d[key] || '', placeholder: ph || '', autocomplete: 'off' })); };
    return [f('forms', 'Other forms', '(comma separated)', 'kettled, kettler'),
      h('label', {}, h('span', { text: 'Kind of term' }), h('select', { name: 'kind' }, h('option', { value: 'new', selected: d.kind !== 'existing', text: 'New word' }), h('option', { value: 'existing', selected: d.kind === 'existing', text: 'Existing word, new meaning' }))),
      f('cues', 'Clue words for the new meaning', '(needed for an existing word)', 'quietly, angry, about to snap'), f('exclude', 'Words that signal an older meaning', '', 'police, tea, boil'),
      f('meaning', 'Meaning', compact ? '(optional; sharpens the match %)' : '', 'getting quietly angrier until you boil over', true), compact ? null : f('coiner', 'Coiner', '', 'Student name'),
      compact ? null : f('owned', 'Coiner’s project accounts', '(their posts are "owned", not counted)', '@word.project'),
      compact ? null : h('label', {}, h('span', { text: 'Role' }), h('select', { name: 'role' }, h('option', { value: 'student', selected: d.role === 'student' || !d.role, text: 'Student term' }), h('option', { value: 'control', selected: d.role === 'control', text: 'Control (real slang)' }), h('option', { value: 'foil', selected: d.role === 'foil', text: 'Foil (invented word)' })))];
  }
  function readForm(form) { var o = {}; Array.prototype.forEach.call(form.elements, function (e) { if (e.name && !e.disabled) o[e.name] = e.type === 'checkbox' ? e.checked : e.value; }); return o; }
  function viewSearch(app) {
    var d = (S.search && S.search.term) || { kind: 'new' }, perTerm = C.ONLINE.length;
    var form = h('form', { class: 'card stack', id: 'search-form', onsubmit: function (e) { e.preventDefault(); var o = readForm(form); if (!C.clean(o.word)) return toast('Enter a word to search.');
        act({ action: 'search', term: o, recent: o.recent, fresh: !!o.fresh }).then(function (r) { if (r.ok) { S.search = r; S.search.recent = o.recent; S.band = 'all'; refreshUsage(r.usage); render(); } }); } },
      h('div', { class: 'searchbar' }, h('input', { name: 'word', value: d.word || '', placeholder: 'Type a word or phrase', 'aria-label': 'Word to search', autocomplete: 'off', autofocus: true }), h('button', { type: 'submit', text: 'Search now' })),
      h('div', { class: 'form' }, termFields(d, true), h('label', {}, h('span', { text: 'How recent' }), h('select', { name: 'recent' }, [['', 'Any time'], ['week', 'Past week'], ['month', 'Past month']].map(function (o) { return h('option', { value: o[0], selected: (S.search && S.search.recent || '') === o[0], text: o[1] }); }))),
        h('label', { style: 'align-content:end' }, h('span', { class: 'row' }, h('input', { type: 'checkbox', name: 'fresh', style: 'width:auto' }), 'Skip the cache'))),
      h('p', { class: 'small muted', text: 'One search sends ' + perTerm + ' queries: TikTok, Instagram, Facebook, YouTube, X/Threads/Reddit and the rest of the web. Repeating the same search within 6 hours is free.' }));
    var out = h('div', { class: 'stack', id: 'search-results' });
    if (S.search) {
      var r = S.search, band = S.band || 'all', counts = { exact: 0, close: 0, similar: 0, below: 0 }, byPf = {};
      r.hits.forEach(function (x) { if (!x.match) x.match = C.matchScore(r.term, x) || { pct: 0, band: 'below', why: 'No match in the title or snippet' }; counts[x.match.band]++;
        var b = byPf[x.platform] = byPf[x.platform] || { exact: 0, close: 0, similar: 0, below: 0 }; b[x.match.band]++; });
      var shown = r.hits.filter(function (x) { return band === 'all' || x.match.band === band; }).sort(function (a, b) { return b.match.pct - a.match.pct; });
      var by = {}; shown.forEach(function (x) { (by[x.platform] = by[x.platform] || []).push(x); });
      var bandBtn = function (id, n) { return h('button', { type: 'button', class: 'band b-' + id, 'data-band': id, 'aria-pressed': String(band === id), onclick: function () { S.band = id; render(); var el = $('#search-list'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } },
        h('span', { class: 'bn', text: n }), h('span', { class: 'bl', text: BANDS[id][0] }), h('span', { class: 'br', text: BANDS[id][1] })); };
      var near = r.hits.filter(function (x) { return x.match.keyword === 'near'; }).length;
      out.appendChild(h('section', { class: 'card stack', id: 'search-summary', 'aria-label': 'Summary of results' },
        h('div', { class: 'row spread' }, h('h2', { text: 'Summary: ' + r.hits.length + (r.hits.length === 1 ? ' result for "' : ' results for "') + r.term.word + '"' }),
          h('button', { type: 'button', text: 'Track this term', onclick: function () { S.draft = Object.assign({}, r.term, { id: null }); location.hash = '#/terms'; } })),
        h('p', { class: 'small muted', text: (r.term.kind === 'existing' ? 'Existing word, new meaning' : 'New word') + (r.term.meaning ? ': ' + r.term.meaning + '.' : '.') + (r.term.forms.length ? ' Other forms: ' + r.term.forms.join(', ') + '.' : '') +
          (r.term.kind === 'existing' && !r.term.cues.length ? ' No clue words were given, so no result can reach 100%.' : '') }),
        h('div', { class: 'bands', role: 'group', 'aria-label': 'Filter results by match' }, bandBtn('exact', counts.exact), bandBtn('close', counts.close), bandBtn('similar', counts.similar), bandBtn('all', r.hits.length)),
        h('div', { class: 'scroll' }, h('table', { id: 'summary-table' }, h('thead', {}, h('tr', {}, h('th', { text: 'Setting' }), h('th', { class: 'n', text: 'Results read' }), h('th', { class: 'n', text: 'Exact' }), h('th', { class: 'n', text: 'Close' }), h('th', { class: 'n', text: 'Similar' }), h('th', { class: 'n', text: 'Under 60%' }))),
          h('tbody', {}, C.ONLINE.map(function (id) { var b = byPf[id] || { exact: 0, close: 0, similar: 0, below: 0 }; return h('tr', {}, h('td', {}, h('span', { class: 'key', style: 'background:' + cssVar(id) }), PF[id]), h('td', { class: 'n', text: r.read[id] || 0 }), h('td', { class: 'n', text: b.exact }), h('td', { class: 'n', text: b.close }), h('td', { class: 'n', text: b.similar }), h('td', { class: 'n', text: b.below })); })))),
        h('p', { class: 'small muted', text: (counts.below ? counts.below + ' under 60% (shown under All). ' : '') + (near ? near + ' near ' + (near === 1 ? 'match is' : 'matches are') + ' shown here only: a near match is never stored or counted. ' : '') +
          r.queries + ' queries used' + (r.cachedQueries ? ', ' + r.cachedQueries + ' answered from the cache' : '') + (r.demo ? ' (simulated results).' : ' via ' + r.provider + '.') + (r.errors.length ? ' Problems: ' + r.errors.join('; ') : '') }),
        h('details', { class: 'small' }, h('summary', { text: 'How the match % is worked out' }),
          h('p', { class: 'muted', text: 'Match % = keyword points (up to 60) + meaning points (up to 40), read from the title and snippet of each result.' }),
          h('ul', { class: 'check muted' }, h('li', { text: 'Keyword: the exact word 60; only as a hashtag or joined-up phrase 57; one of your listed forms 54; a near match (an unlisted ending such as -ing or -s, a one-letter misspelling of a new word, or the words of a phrase apart) 38.' }),
            h('li', { text: 'Meaning: new meaning 40 (a new word with no older-meaning word, or an existing word with a clue word); unclear 25, or 30 if words from the Meaning box appear; older meaning minus 5, so it always falls under 60%.' }),
            h('li', { text: '100% is the exact word with the new meaning. A result with nothing like the word in its title or snippet is left out.' })))));
      var listBox = h('div', { class: 'stack', id: 'search-list' });
      listBox.appendChild(h('h3', { text: band === 'all' ? 'All results, best match first' : BANDS[band][0] + ' (' + BANDS[band][1] + '): ' + shown.length + (shown.length === 1 ? ' result' : ' results') }));
      C.ONLINE.forEach(function (id) { if (!by[id]) return; listBox.appendChild(h('div', { class: 'card' }, h('h3', {}, h('span', { class: 'key', style: 'background:' + cssVar(id) }), PF[id] + ' (' + by[id].length + ')'), by[id].map(hitCard))); });
      if (!r.hits.length) listBox.appendChild(h('p', { class: 'card', text: 'Nothing found that contains the word or anything close to it. For a newly coined word, that is the expected baseline.' }));
      else if (!shown.length) listBox.appendChild(h('p', { class: 'card', text: 'No results in this group. Choose All to see every result.' }));
      out.appendChild(listBox);
    }
    app.replaceChildren(h('h1', { text: 'Search a word' }), form, out);
  }
  var BANDS = { exact: ['Exact', '100%'], close: ['Close match', '80 to 99%'], similar: ['Similar', '60 to 79%'], all: ['All', 'every result'], below: ['Under 60%', 'under 60%'] };
  function hitCard(x) {
    var m = x.match || { pct: 0, band: 'below', why: '' };
    return h('div', { class: 'hit', 'data-band': m.band }, h('span', { class: 'row' }, h('span', { class: 'mpct b-' + m.band, text: m.pct + '%' }), h('span', { class: 'small muted', text: BANDS[m.band][0] + ': ' + m.why })),
      x.url ? h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', text: x.title || x.url }) : h('b', { text: x.title }), h('span', { class: 'small', text: x.snippet }),
      h('span', { class: 'chips' }, pill(LABEL.sense[x.sense], x.sense === 'target' ? 'ok' : x.sense === 'unclear' ? 'warn' : 'muted'), pill(LABEL.ownership[x.ownership], 'muted'), pill(LABEL.marked[x.marked], 'muted'), x.near ? pill('Near match: not countable', 'warn') : x.form !== 'verbatim' ? pill('Form: ' + x.form, 'muted') : null, x.pubDate ? pill(x.pubDate, 'muted') : null, pill(C.userCode(x.user), 'muted')));
  }
  function refreshUsage(u) { if (u && S.state) S.state.usage = u; }

  /* ---------- terms ---------- */
  function viewTerms(app) {
    var st = S.state, d = S.draft, n = st.terms.length;
    var list = h('div', { class: 'card scroll' }, h('table', { id: 'terms-table' }, h('thead', {}, h('tr', {}, h('th', { text: 'Term' }), h('th', { text: 'Coiner' }), h('th', { text: 'Role' }), h('th', { text: 'Last run' }), h('th', { class: 'n', text: 'FUDGE' }), h('th', { text: '' }))),
      h('tbody', {}, st.terms.map(function (t) { var l = last(t); return h('tr', {}, h('td', {}, h('b', { text: t.word }), t.active ? null : h('span', { class: 'small muted', text: ' (paused)' })), h('td', { text: t.coiner || '—' }), h('td', { text: t.role }), h('td', { text: l ? day(l.date) : 'never' }), h('td', { class: 'n', text: l ? l.fudge : '—' }),
        h('td', {}, h('span', { class: 'row' }, h('button', { class: 'sm ghost', type: 'button', text: 'Edit', onclick: function () { act({ action: 'term', id: t.id }).then(function (r) { if (!r.ok) return; S.draft = r.term; render(); $('#term-form input[name=word]').focus(); }); } }),
          h('button', { class: 'sm ghost', type: 'button', text: 'Run now', onclick: function () { act({ action: 'runNow', id: t.id }, 'Run finished for ' + t.word).then(function (r) { if (r.ok) refresh().then(render); }); } }),
          h('button', { class: 'sm danger', type: 'button', text: 'Delete', onclick: function () { if (confirmDelete(t)) act({ action: 'deleteTerm', id: t.id }, 'Deleted ' + t.word).then(function (r) { if (r.ok) refresh().then(render); }); } })))); }))));
    var form = null;
    if (d || n < C.MAX_TERMS) {
      d = d || { kind: 'new', role: 'student' };
      form = h('form', { class: 'card stack', id: 'term-form', onsubmit: function (e) { e.preventDefault(); var o = readForm(form); o.id = d.id || undefined; o.active = o.active !== false;
          act({ action: 'saveTerm', term: o }, 'Saved').then(function (r) { if (r.ok) { S.draft = null; S.sel = r.term.id; refresh().then(render); } }); } },
        h('h2', { text: d.id ? 'Edit "' + d.word + '"' : 'Add a term' }),
        h('div', { class: 'form' }, h('label', {}, h('span', { text: 'Word or phrase' }), h('input', { name: 'word', value: d.word || '', required: true, autocomplete: 'off' })), termFields(d, false),
          h('label', { style: 'align-content:end' }, h('span', { class: 'row' }, h('input', { type: 'checkbox', name: 'active', checked: d.active !== false, style: 'width:auto' }), 'Include in automatic runs'))),
        h('div', { class: 'row' }, h('button', { type: 'submit', text: d.id ? 'Save changes' : 'Save term' }), S.draft ? h('button', { type: 'button', class: 'ghost', text: 'Cancel', onclick: function () { S.draft = null; render(); } }) : null),
        h('p', { class: 'small muted', text: 'The first run of a new term records its baseline: whatever already exists online is stored but never counted as a use.' }));
    }
    app.replaceChildren(h('div', { class: 'row spread' }, h('h1', { text: 'Tracked terms' }), h('span', { class: 'num', id: 'slots', text: n + ' of ' + C.MAX_TERMS + ' slots used' })),
      h('p', { class: 'lede muted', text: 'These terms are searched automatically on the schedule. Use one slot for a real slang "control" and one for an invented "foil" to check the instrument.' }),
      n ? list : null, form || h('p', { class: 'card', text: 'All ' + C.MAX_TERMS + ' slots are in use. Delete a term to add another.' }),
      n ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'ghost', text: 'Run all active terms now', onclick: function () { act({ action: 'runNow' }, 'Run finished').then(function (r) { if (r.ok) refresh().then(render); }); } }), h('span', { class: 'small muted', text: 'Uses about ' + st.terms.filter(function (t) { return t.active; }).length * C.ONLINE.length + ' queries.' })) : null);
  }
  function confirmDelete(t) { return window.confirm('Delete "' + t.word + '" and all of its stored hits and runs? This cannot be undone.'); }

  /* ---------- review ---------- */
  function viewReview(app) {
    var st = S.state; if (!st.terms.length) { app.replaceChildren(h('h1', { text: 'Review' }), h('p', { class: 'card', text: 'No terms yet.' })); return; }
    if (!term(S.reviewTerm)) S.reviewTerm = (st.terms.filter(function (t) { return t.review; })[0] || term(S.sel) || st.terms[0]).id;
    var t = term(S.reviewTerm), picker = h('select', { 'aria-label': 'Term', onchange: function (e) { S.reviewTerm = e.target.value; S.hits = null; render(); } }, st.terms.map(function (x) { return h('option', { value: x.id, selected: x.id === t.id, text: x.word + (x.review ? ' (' + x.review + ' to review)' : '') }); }));
    var body = h('div', { class: 'stack', id: 'review-body' }, h('p', { class: 'muted', text: 'Loading hits…' }));
    app.replaceChildren(h('h1', { text: 'Review and log' }), h('p', { class: 'lede muted', text: 'The rules code every hit automatically. Check the unclear ones, correct anything wrong, and log uses the search cannot see: speech, private chats and private accounts.' }),
      h('div', { class: 'row' }, picker, h('div', { class: 'seg', role: 'group', 'aria-label': 'Which hits' }, h('button', { type: 'button', 'aria-pressed': String(!S.reviewAll), text: 'Needs review', onclick: function () { S.reviewAll = false; render(); } }), h('button', { type: 'button', 'aria-pressed': String(S.reviewAll), text: 'All hits', onclick: function () { S.reviewAll = true; render(); } }))), body, sightingForm(t));
    var show = function (hits) {
      var rows = hits.filter(function (x) { return S.reviewAll || (x.sense === 'unclear' && !x.reviewed); }).sort(function (a, b) { return C.ms(b.firstSeen) - C.ms(a.firstSeen); }).slice(0, 150);
      if (!rows.length) { body.replaceChildren(h('p', { class: 'card', text: S.reviewAll ? 'No hits stored for this term yet.' : 'Nothing needs review for "' + t.word + '".' })); return; }
      var patch = function (x, k) { return function (e) { var p = {}; p[k] = e.target.value; x[k] = e.target.value; act({ action: 'codeHit', hitId: x.id, patch: p }, 'Saved').then(function (r) { if (r.ok) refresh(); }); }; };
      body.replaceChildren(h('div', { class: 'card scroll' }, h('table', { id: 'review-table' }, h('thead', {}, h('tr', {}, h('th', { text: 'First seen' }), h('th', { text: 'Where' }), h('th', { text: 'Text' }), h('th', { text: 'Meaning' }), h('th', { text: 'Who' }), h('th', { text: 'Marked' }), h('th', { text: 'Asked for' }), h('th', { text: '' }))),
        h('tbody', {}, rows.map(function (x) { return h('tr', {}, h('td', { class: 'num', text: day(x.firstSeen) + (x.baseline ? ' (baseline)' : '') }), h('td', { text: PF[x.platform] }),
          h('td', { style: 'min-width:240px' }, x.url ? h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer', text: x.title || 'Open' }) : h('b', { text: x.title }), h('div', { class: 'small muted', text: x.snippet }), x.form !== 'verbatim' ? h('div', { class: 'small', text: 'Form: ' + x.form }) : null),
          h('td', {}, sel(LABEL.sense, x.sense, patch(x, 'sense'), 'Meaning')), h('td', {}, sel(LABEL.ownership, x.ownership, patch(x, 'ownership'), 'Who')), h('td', {}, sel(LABEL.marked, x.marked, patch(x, 'marked'), 'Marked')), h('td', {}, sel(LABEL.prompted, x.prompted, patch(x, 'prompted'), 'Asked for')),
          h('td', {}, h('button', { class: 'sm danger', type: 'button', text: 'Remove', onclick: function () { if (window.confirm('Remove this hit from the ledger?')) act({ action: 'deleteHit', hitId: x.id }, 'Removed').then(function (r) { if (r.ok) { S.hits = null; refresh().then(render); } }); } }))); })))),
        h('p', { class: 'small muted', text: 'Showing ' + rows.length + ' of ' + hits.length + ' stored hits. Account names are shown here only; the dashboard uses codes.' }));
    };
    if (S.hits && S.hits.id === t.id) show(S.hits.list); else call({ action: 'hits', id: t.id }).then(function (r) { if (!r.ok) { body.replaceChildren(h('p', { class: 'card bad', text: r.error })); return; } S.hits = { id: t.id, list: r.hits }; if (route() === 'review' && S.reviewTerm === t.id) show(r.hits); });
  }
  function sightingForm(t) {
    var form = h('form', { class: 'card stack', id: 'sighting-form', onsubmit: function (e) { e.preventDefault(); var o = readForm(form); act({ action: 'addSighting', termId: t.id, sighting: o }, 'Sighting logged').then(function (r) { if (r.ok) { S.hits = null; refresh().then(render); } }); } },
      h('h2', { text: 'Log a sighting of "' + t.word + '"' }),
      h('div', { class: 'form' }, h('label', {}, h('span', { text: 'Date' }), h('input', { type: 'date', name: 'date', value: S.state.today })), h('label', {}, h('span', {}, 'Who used it ', h('span', { class: 'hint', text: '(a code or role, not a full name)' })), h('input', { name: 'who', placeholder: 'M5 student A', required: true })),
        h('label', {}, h('span', { text: 'Network' }), h('select', { name: 'ownership' }, h('option', { value: 'earned_in', text: 'Inside her network' }), h('option', { value: 'earned_out', text: 'Outside her network' }))),
        h('label', {}, h('span', { text: 'Marked?' }), h('select', { name: 'marked' }, h('option', { value: 'N', text: 'Unmarked' }), h('option', { value: 'Y', text: 'Marked (explained, quoted)' }))),
        h('label', {}, h('span', { text: 'Asked for?' }), h('select', { name: 'prompted' }, h('option', { value: 'N', text: 'No' }), h('option', { value: 'Y', text: 'Yes (will not count)' }))),
        h('label', {}, h('span', { text: 'Form used' }), h('input', { name: 'form', placeholder: 'verbatim, or the new form' })), h('label', { class: 'wide' }, h('span', { text: 'What was said or written, and the witness' }), h('input', { name: 'text', placeholder: 'Said in the canteen; witnessed by her auditor' }))),
      h('div', {}, h('button', { type: 'submit', text: 'Log sighting' })));
    return form;
  }

  /* ---------- settings ---------- */
  function viewSettings(app) {
    var st = S.state, s = st.settings, days = C.list(s.days).map(Number), active = st.terms.filter(function (t) { return t.active; }).length;
    var est = C.estimateQueries(Math.max(active, 1), Math.max(days.length, 1)), est10 = C.estimateQueries(10, 2);
    var conn = h('form', { class: 'card stack', id: 'conn-form', onsubmit: function (e) { e.preventDefault(); var v = readForm(conn).api.trim(); if (v && !/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/.test(v)) return toast('That does not look like an Apps Script web app URL ending in /exec.'); store.set('lex_api', v || null); location.reload(); } },
      h('h2', { text: 'Backend connection' }), h('p', { class: 'small muted', text: S.demo ? 'Not connected: the app is showing simulated data.' : 'Connected to ' + S.api }),
      h('label', {}, h('span', {}, 'Apps Script web app URL ', h('span', { class: 'hint', text: '(ends in /exec; saved in this browser only. Put it in config.js to set it for everyone.)' })), h('input', { name: 'api', value: store.get('lex_api') || '', placeholder: 'https://script.google.com/macros/s/…/exec' })),
      h('div', { class: 'row' }, h('button', { type: 'submit', text: 'Save and reload' }), !S.demo ? pill('Search: ' + (st.configured.provider || 'no key set'), st.configured.provider ? 'ok' : 'bad') : null, !S.demo ? pill('AI coding: ' + (st.configured.ai ? 'on' : 'off'), 'muted') : null, !S.demo ? pill('PIN: ' + (st.configured.pin ? 'set' : 'missing'), st.configured.pin ? 'ok' : 'bad') : null));
    if (!authed()) { app.replaceChildren(h('h1', { text: 'Settings' }), conn, h('p', { class: 'card', text: 'Unlock with the teacher PIN (top right) to change the schedule and budget.' })); return; }
    if (!S.full) { call({ action: 'hits', id: '-' }).then(function (r) { if (r.ok && r.settings) { S.full = r.settings; if (route() === 'settings') render(); } }); }
    var full = S.full || {};
    var form = h('form', { class: 'card stack', id: 'settings-form', onsubmit: function (e) { e.preventDefault(); var o = readForm(form), d = []; DAYS.forEach(function (_, i) { if (o['d' + i]) d.push(i); delete o['d' + i]; }); o.days = d.join(',');
        act({ action: 'saveSettings', settings: o }, 'Settings saved').then(function (r) { if (r.ok) { S.full = r.settings || null; refresh().then(render); } }); } },
      h('h2', { text: 'Schedule and budget' }),
      h('div', {}, h('span', { class: 'small', style: 'font-weight:600', text: 'Automatic run days' }), h('div', { class: 'chips', style: 'margin-top:6px' }, DAYS.map(function (n, i) { return h('label', { class: 'chip', style: 'font-weight:400' }, h('input', { type: 'checkbox', name: 'd' + i, checked: days.indexOf(i) >= 0, style: 'width:auto' }), n); }))),
      h('div', { class: 'form' }, h('label', {}, h('span', { text: 'Hour (Bangkok time, 0 to 23)' }), h('input', { type: 'number', name: 'hour', min: 0, max: 23, value: s.hour })),
        h('label', {}, h('span', {}, 'Results per query ', h('span', { class: 'hint', text: '(10 is cheapest)' })), h('input', { type: 'number', name: 'sample', min: 5, max: 20, value: s.sample })),
        h('label', {}, h('span', {}, 'Monthly query cap ', h('span', { class: 'hint', text: '(searching stops at this number)' })), h('input', { type: 'number', name: 'monthlyCap', min: 0, value: s.monthlyCap })),
        h('label', {}, h('span', { text: 'Scheduled runs look back' }), h('select', { name: 'recency' }, h('option', { value: 'week', selected: s.recency !== 'month', text: 'One week' }), h('option', { value: 'month', selected: s.recency === 'month', text: 'One month' })))),
      h('div', { class: 'form' }, h('label', {}, h('span', {}, 'Class accounts ', h('span', { class: 'hint', text: '(classmates and teacher; their posts are never counted)' })), h('input', { name: 'classHandles', value: full.classHandles || '', placeholder: '@account1, @account2', disabled: !S.full })),
        h('label', {}, h('span', {}, 'Project tag ', h('span', { class: 'hint', text: '(posts carrying it are coded as marked)' })), h('input', { name: 'projectTag', value: full.projectTag || '', placeholder: '#EN30202', disabled: !S.full }))),
      h('div', {}, h('button', { type: 'submit', text: 'Save settings' })));
    var u = st.usage, pct = u.cap ? Math.min(100, Math.round(100 * u.queries / u.cap)) : 0;
    var budget = h('div', { class: 'card stack', id: 'budget' }, h('h2', { text: 'Search budget' }), h('p', {}, h('span', { class: 'num', text: u.queries + (u.cap ? ' of ' + u.cap : '') }), ' queries used in ' + u.month + '.'), h('div', { class: 'meter', role: 'img', 'aria-label': pct + '% of the monthly cap used' }, h('i', { style: 'width:' + pct + '%' })),
      h('p', { class: 'small muted', text: 'At the current settings: ' + active + ' active terms × ' + C.ONLINE.length + ' queries × ' + days.length + ' runs a week = ' + est.perWeek + ' queries a week, about ' + est.perMonth + ' a month. Ten terms twice a week is ' + est10.perWeek + ' a week, about ' + est10.perMonth + ' a month. Each search typed by hand adds ' + C.ONLINE.length + ' unless it is cached.' }),
      h('ul', { class: 'check small muted' }, h('li', { text: 'All forms of a term share one query per setting, so extra forms cost nothing.' }), h('li', { text: 'Scheduled runs ask only for the past week and store only web addresses not seen before.' }), h('li', { text: 'Sense, marking and ownership are coded by rules in the script. The optional AI check runs once per term per run, only on hits the rules could not decide.' })));
    app.replaceChildren(h('h1', { text: 'Settings' }), conn, form, budget);
  }

  /* ---------- render ---------- */
  function render() {
    var app = $('#app'), r = route(); chrome();
    if (!S.state) { app.replaceChildren(h('h1', { text: S.error ? 'The backend could not be reached' : 'Loading…' }), S.error ? h('p', { class: 'card bad', text: S.error }) : null, S.error ? h('p', {}, h('a', { href: '#/settings', text: 'Check the connection in Settings' })) : null); if (r !== 'settings' || !S.error) return; }
    if (!S.state) S.state = { terms: [], usage: { queries: 0, cap: 0, month: '' }, settings: { days: '', hour: '6', sample: '10', monthlyCap: '900', recency: 'week' }, configured: {}, today: C.isoDay(Date.now()) };
    if (r === 'settings') return viewSettings(app);
    if (r && !authed()) return pinGate(app, { search: 'Search a word', terms: 'Tracked terms', review: 'Review and log' }[r] || 'Teacher area');
    if (r === 'search') return viewSearch(app);
    if (r === 'terms') return viewTerms(app);
    if (r === 'review') return viewReview(app);
    viewDashboard(app);
  }
  function init() {
    var q = new URLSearchParams(location.search), api = q.get('demo') ? '' : (store.get('lex_api') || window.LEX_API_URL || '');
    S.api = api; S.demo = !api;
    var th = store.get('lex_theme'); if (th) document.documentElement.setAttribute('data-theme', th);
    $('#theme').addEventListener('click', function () { var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', nx); store.set('lex_theme', nx); });
    $('#lock').addEventListener('click', function () { if (S.pin) { S.pin = ''; toast('Locked'); render(); } else location.hash = '#/search'; });
    window.addEventListener('hashchange', function () { render(); $('#app').focus({ preventScroll: true }); window.scrollTo(0, 0); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (!route()) drawCharts(); }, 150); });
    render(); refresh().then(render);
  }
  window.LexApp = { state: function () { return S; } };
  init();
})();
