/* Demo mode: an in-browser stand-in for the backend with SIMULATED data, so the whole app can be
   explored before the Apps Script backend is deployed. Nothing here is real usage. */
var LexDemo = (function () {
  'use strict';
  var C = LexCore, seed = 30202;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  var TODAY = '2027-01-11';
  var RUNS = ['2026-11-16', '2026-11-19', '2026-11-23', '2026-11-26', '2026-11-30', '2026-12-03', '2026-12-07', '2026-12-10', '2026-12-14', '2026-12-17', '2026-12-21', '2026-12-24', '2026-12-28', '2026-12-31', '2027-01-04', '2027-01-07', '2027-01-11'];
  // weekly [owned, classmates, inside network, outside network]; weeks start 16 Nov
  var PLAN = [
    { word: 'kettling', coiner: 'Baiplu', kind: 'existing', meaning: 'getting quietly angrier until you suddenly boil over', forms: 'kettled, kettler', cues: 'quietly, angry, mad, fine but, about to snap', exclude: 'police, protest, tea, boil, crowd', owned: 'kettling.project',
      plan: [[0,0,0,0],[0,0,0,0],[4,2,1,0],[5,3,3,1],[4,2,5,3],[4,2,6,4],[1,0,4,2],[0,0,2,2],[3,1,5,4]], um: [0,0,0,.2,.35,.5,.5,.6,.55], gen: [[4,'kettled'],[8,'kettler']], noise: 4, pin: 7, pout: 9 },
    { word: 'snackrifice', coiner: 'Lookchin', kind: 'new', meaning: 'giving up your snack for a friend', forms: 'snackrificed, snackrificial', owned: 'snackrifice.project',
      plan: [[0,0,0,0],[0,0,0,0],[5,3,2,0],[6,3,4,1],[5,2,6,2],[4,2,7,4],[2,1,5,3],[1,0,5,3],[3,2,8,5]], um: [0,0,.2,.3,.5,.6,.65,.7,.7], gen: [[3,'snackrificed'],[5,'snackrificial']], noise: 0, pin: 9, pout: 12 },
    { word: 'glimmerish', coiner: 'Proud', kind: 'new', meaning: 'slightly hopeful', forms: '', owned: 'glimmerish.project',
      plan: [[0,0,0,0],[0,0,0,0],[3,2,1,0],[3,2,1,0],[2,1,2,0],[2,1,1,0],[0,0,0,0],[0,0,1,0],[1,1,1,0]], um: [0,0,0,0,.3,.3,0,.5,.5], gen: [], noise: 0, pin: 3, pout: 2 },
    { word: 'tabbed', coiner: 'Airin', kind: 'existing', meaning: 'having too many things on your mind at once', forms: 'over-tabbed', cues: 'brain, mind, so tabbed, too many, overwhelmed', exclude: 'browser, guitar, folder, keyboard, chrome', owned: 'tabbed.project',
      plan: [[0,0,0,0],[0,0,0,0],[3,2,2,0],[4,2,3,0],[4,2,4,1],[3,1,4,1],[1,0,2,1],[0,0,2,0],[2,1,3,1]], um: [0,0,.2,.3,.4,.5,.5,.5,.6], gen: [[5,'over-tabbed']], noise: 5, pin: 5, pout: 3 },
    { word: 'yapless', coiner: 'Sun', kind: 'new', meaning: 'with nothing to say for once', forms: '', owned: 'yapless.project',
      plan: [[0,0,0,0],[0,0,0,0],[6,3,1,0],[6,2,1,0],[5,2,1,0],[5,2,0,0],[2,0,0,0],[1,0,0,0],[4,1,1,0]], um: [0,0,0,0,0,0,0,0,0], gen: [], noise: 0, pin: 2, pout: 1 },
    { word: 'plotdrunk', coiner: 'Mint', kind: 'new', meaning: 'over-excited by a story twist', forms: 'plotdrunkenness', owned: 'plotdrunk.project',
      plan: [[0,0,0,0],[0,0,0,0],[4,2,0,0],[4,2,2,1],[4,2,3,3],[3,2,3,5],[2,1,2,5],[1,0,2,6],[3,1,3,7]], um: [0,0,0,.3,.4,.6,.7,.7,.75], gen: [[6,'plotdrunkenness']], noise: 0, pin: 4, pout: 16 },
    { word: 'sideload', coiner: 'Donut', kind: 'existing', meaning: 'to quietly add a friend to plans already made', forms: 'sideloaded, sideloading', cues: 'friend, plans, invite, bring along', exclude: 'apk, android, app, install, iphone', owned: 'sideload.project',
      plan: [[0,0,0,0],[0,0,0,0],[2,1,0,0],[3,2,1,0],[3,2,2,0],[3,1,2,0],[1,0,1,0],[0,0,0,0],[2,1,2,0]], um: [0,0,0,0,.3,.3,.3,0,.4], gen: [], noise: 5, pin: 3, pout: 1 },
    { word: 'fomojo', coiner: 'Pin', kind: 'new', meaning: 'the burst of energy you get from fear of missing out', forms: 'fomojo-ing', owned: 'fomojo.project',
      plan: [[0,0,0,0],[0,0,0,0],[4,3,2,0],[5,3,3,0],[4,2,4,1],[4,2,5,2],[2,1,3,1],[1,0,3,1],[3,2,4,2]], um: [0,0,.1,.3,.4,.5,.5,.6,.6], gen: [[7,'fomojo-ing']], noise: 0, pin: 6, pout: 5 },
    { word: 'aura farming', coiner: '', kind: 'new', role: 'control', meaning: 'real slang: doing something only to look cool', forms: '', owned: '', control: [9, 11] },
    { word: 'drovish', coiner: '', kind: 'new', role: 'foil', meaning: 'invented check word that should never appear', forms: '', owned: '', control: [0, 0] }
  ];
  var IN_PF = ['school', 'school', 'school', 'school', 'school', 'instagram', 'instagram', 'instagram', 'tiktok', 'tiktok', 'facebook'];
  var OUT_PF = ['tiktok', 'tiktok', 'tiktok', 'tiktok', 'tiktok', 'instagram', 'instagram', 'instagram', 'youtube', 'forums', 'web', 'school', 'school'];
  var OWN_PF = ['tiktok', 'tiktok', 'instagram', 'instagram', 'facebook'];
  var db = { terms: [], hits: [], runs: [], usage: 0, settings: { days: '1,4', hour: '6', sample: '10', monthlyCap: '900', recency: 'week', classHandles: 'class.account1, class.account2', projectTag: '#makefetchhappen', cacheHours: '6' } };
  var n = 0; function id(p) { n++; return p + ('00000' + n).slice(-5); }
  function url(pf, user) {
    var u = user.split(':')[1] || 'someone', k = Math.floor(rnd() * 9e6);
    return pf === 'tiktok' ? 'https://www.tiktok.com/@' + u + '/video/' + k : pf === 'instagram' ? 'https://www.instagram.com/' + u + '/p/' + k + '/' : pf === 'facebook' ? 'https://www.facebook.com/' + u + '/posts/' + k
      : pf === 'youtube' ? 'https://www.youtube.com/@' + u + '/shorts/' + k : pf === 'forums' ? 'https://x.com/' + u + '/status/' + k : pf === 'web' ? 'https://example.org/blog/' + k : '';
  }
  function build() {
    PLAN.forEach(function (p) {
      var t = C.normTerm(p); t.created = RUNS[0]; t.dict = ''; db.terms.push(t);
      var seenForms = {};
      RUNS.forEach(function (date, ri) {
        var run = { id: id('r'), termId: t.id, date: date, kind: ri === 0 ? 'baseline' : 'scheduled', queries: 6, sample: 0, newHits: 0, error: '' };
        var wk = Math.min(8, Math.floor((C.ms(date) - C.ms(RUNS[0])) / (7 * C.DAY))), first = ri % 2 === 0, before = db.hits.length;
        function add(h) { db.hits.push(Object.assign({ id: id('h'), termId: t.id, runId: run.id, firstSeen: date, baseline: ri === 0, prompted: 'N', marked: 'N', form: 'verbatim', source: 'auto', reviewed: false, pubDate: '', note: '', title: 'Simulated post', snippet: 'Simulated result for the demo.' }, h)); }
        if (p.control) { for (var c = 0; c < p.control[0] + Math.floor(rnd() * (p.control[1] - p.control[0] + 1)); c++) { var pf0 = pick(['tiktok', 'tiktok', 'instagram', 'youtube', 'forums', 'web']), u0 = 'x:user' + Math.floor(rnd() * 500); add({ platform: pf0, user: u0, url: url(pf0, u0), ownership: 'earned_out', sense: 'target' }); } }
        else {
          for (var k = 0; k < (p.noise ? p.noise + Math.floor(rnd() * 3) : 0); k++) { var pfn = pick(['web', 'web', 'youtube', 'forums', 'facebook', 'tiktok']), un = 'web:site' + Math.floor(rnd() * 900); add({ platform: pfn, user: un, url: url(pfn, un), ownership: 'earned_out', sense: rnd() < .08 ? 'unclear' : 'other', title: 'Older meaning of the word', snippet: 'Simulated result showing the older meaning.' }); }
          var w = p.plan[wk]; if (ri === 0) w = [0, 0, 0, 0];
          var half = function (x) { return first ? Math.ceil(x / 2) : Math.floor(x / 2); };
          for (var o = 0; o < half(w[0]); o++) { var pfo = pick(OWN_PF); add({ platform: pfo, user: 'tt:' + p.owned, url: url(pfo, 'tt:' + p.owned), ownership: 'owned', sense: 'target', marked: 'Y', title: 'Project account post', snippet: 'Simulated post from the coiner\'s project account.' }); }
          for (var cl = 0; cl < half(w[1]); cl++) add({ platform: 'instagram', user: 'ig:class.account' + (1 + Math.floor(rnd() * 2)), url: url('instagram', 'ig:class.account1'), ownership: 'class', sense: 'target', title: 'Classmate post', snippet: 'Simulated post by a classmate.' });
          [['earned_in', half(w[2]), p.pin, IN_PF, 'in'], ['earned_out', half(w[3]), p.pout, OUT_PF, 'out']].forEach(function (g) {
            for (var i = 0; i < g[1]; i++) {
              var grow = Math.max(1, Math.min(g[2], 1 + Math.floor((wk - 1) * g[2] / 6))), pf = pick(g[3]);
              var user = (pf === 'school' ? 'sc:' : pf === 'tiktok' ? 'tt:' : pf === 'instagram' ? 'ig:' : 'x:') + g[4] + '.user' + (1 + Math.floor(rnd() * grow)), form = 'verbatim';
              p.gen.forEach(function (gf) { if (form === 'verbatim' && wk >= gf[0] && ((!seenForms[gf[1]] && g[0] === 'earned_in') || (seenForms[gf[1]] && rnd() < .12))) { form = gf[1]; seenForms[gf[1]] = 1; } });
              add({ platform: pf, user: user, url: url(pf, user), ownership: g[0], sense: 'target', marked: rnd() < p.um[wk] ? 'N' : 'Y', form: form, source: pf === 'school' ? 'manual' : 'auto', reviewed: pf === 'school',
                title: pf === 'school' ? 'Logged sighting' : 'Post using the word', snippet: pf === 'school' ? 'Simulated sighting logged by the student and checked by her auditor.' : 'Simulated public post that uses "' + (form === 'verbatim' ? t.word : form) + '".' });
            }
          });
        }
        run.newHits = db.hits.length - before; run.sample = 40 + Math.floor(rnd() * 15); db.runs.push(run);
      });
    });
    db.usage = 480;
  }
  build();
  function state() {
    return { ok: true, demo: true, version: C.VERSION, today: TODAY, usage: { month: TODAY.slice(0, 7), queries: db.usage, cap: Number(db.settings.monthlyCap) },
      settings: { days: db.settings.days, hour: db.settings.hour, sample: db.settings.sample, monthlyCap: db.settings.monthlyCap, recency: db.settings.recency },
      configured: { provider: 'demo', ai: false, pin: true },
      terms: db.terms.map(function (t) { var h = db.hits.filter(function (x) { return x.termId === t.id; }), r = db.runs.filter(function (x) { return x.termId === t.id; });
        return { id: t.id, word: t.word, forms: t.forms, kind: t.kind, meaning: t.meaning, coiner: t.coiner, role: t.role, active: t.active, dict: t.dict, series: C.series(t, h, r),
          check: t.role === 'student' ? null : C.instrumentCheck(t, h, r), review: h.filter(function (x) { return x.sense === 'unclear' && !x.reviewed; }).length }; }) };
  }
  function fakeSearch(term) {
    var out = [], samples = [['tiktok', 'tt:demo.viewer', 'honestly {w} is my whole personality this week'], ['tiktok', 'tt:another.user', '"{w}" — new word unlocked'], ['instagram', 'ig:demo.gram', 'weekend dump. very {w} #{h}'],
      ['youtube', 'yt:@demochannel', 'Why everyone is saying {w}'], ['forums', 'x:demo_poster', 'is {w} a real word or did my sister make it up'], ['web', 'web:example.org', 'What does {w} mean? Definition and examples']];
    samples.forEach(function (s) { var raw = { platform: s[0], user: s[1], url: url(s[0], s[1]), title: s[2].replace('{w}', term.word).replace('{h}', term.word.replace(/\s+/g, '')), snippet: 'Demo result. Connect the backend to search the live web.' };
      var h = C.codeHit(term, raw, db.settings); if (h) out.push(h); });
    return out;
  }
  function call(req) {
    var a = req.action, t;
    if (a === 'state') return state();
    if (a === 'login') return { ok: true };
    if (a === 'search') { t = C.normTerm(req.term || {}); if (!t.word) return { ok: false, error: 'Enter a word to search.' }; db.usage += 6;
      return { ok: true, demo: true, term: t, hits: fakeSearch(t), read: { tiktok: 10, instagram: 10, facebook: 8, youtube: 10, forums: 9, web: 10 }, queries: 6, cachedQueries: 0, errors: [], provider: 'demo', usage: state().usage }; }
    if (a === 'term') { t = db.terms.filter(function (x) { return x.id === req.id; })[0]; return t ? { ok: true, term: Object.assign({}, t) } : { ok: false, error: 'Term not found.' }; }
    if (a === 'hits') return { ok: true, hits: db.hits.filter(function (h) { return h.termId === req.id; }), settings: db.settings };
    if (a === 'saveTerm') { t = C.normTerm(req.term || {}); if (!t.word) return { ok: false, error: 'A term needs a word.' };
      var i = db.terms.findIndex(function (x) { return x.id === t.id; });
      if (i < 0 && db.terms.length >= C.MAX_TERMS) return { ok: false, error: 'All ' + C.MAX_TERMS + ' term slots are in use. Delete one first.' };
      t.created = i < 0 ? TODAY : db.terms[i].created; t.dict = ''; if (i < 0) db.terms.push(t); else db.terms[i] = t; return { ok: true, term: t }; }
    if (a === 'deleteTerm') { db.terms = db.terms.filter(function (x) { return x.id !== req.id; }); db.hits = db.hits.filter(function (h) { return h.termId !== req.id; }); db.runs = db.runs.filter(function (r) { return r.termId !== req.id; }); return { ok: true }; }
    if (a === 'runNow') { var runs = []; db.terms.filter(function (x) { return req.id ? x.id === req.id : x.active; }).forEach(function (x) {
        var first = !db.runs.some(function (r) { return r.termId === x.id; }), run = { id: id('r'), termId: x.id, date: TODAY, kind: first ? 'baseline' : 'manual', queries: 6, sample: 50, newHits: 0, error: '' };
        db.runs = db.runs.filter(function (r) { return !(r.termId === x.id && r.date === TODAY && r.kind !== 'baseline' && !first); });
        if (first) fakeSearch(x).forEach(function (h) { db.hits.push(Object.assign(h, { id: id('h'), termId: x.id, runId: run.id, firstSeen: TODAY, baseline: true })); run.newHits++; });
        db.runs.push(run); db.usage += 6; runs.push(run); }); return { ok: true, runs: runs, usage: state().usage }; }
    if (a === 'codeHit') { var h = db.hits.filter(function (x) { return x.id === req.hitId; })[0]; if (!h) return { ok: false, error: 'Hit not found.' }; Object.assign(h, req.patch || {}); h.reviewed = true; return { ok: true }; }
    if (a === 'deleteHit') { db.hits = db.hits.filter(function (x) { return x.id !== req.hitId; }); return { ok: true }; }
    if (a === 'addSighting') { var s = req.sighting || {}; db.hits.push({ id: id('h'), termId: req.termId, runId: 'manual', firstSeen: s.date || TODAY, platform: 'school', url: '', title: 'Logged sighting', snippet: C.clean(s.text), pubDate: '', user: 'sc:' + (C.clean(s.who) || id('p')).toLowerCase(),
        ownership: s.ownership === 'earned_out' ? 'earned_out' : 'earned_in', sense: 'target', marked: s.marked === 'Y' ? 'Y' : 'N', prompted: s.prompted === 'Y' ? 'Y' : 'N', form: C.clean(s.form) || 'verbatim', source: 'manual', reviewed: true, baseline: false, note: C.clean(s.note) }); return { ok: true }; }
    if (a === 'saveSettings') { Object.assign(db.settings, req.settings || {}); return { ok: true, settings: db.settings }; }
    return { ok: false, error: 'Unknown action: ' + a };
  }
  return { call: call, TODAY: TODAY };
})();
