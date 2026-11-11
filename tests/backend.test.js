const assert = require('assert'); const { makeEnv } = require('./gas-mock.js');
let now = new Date('2026-11-16T02:00:00Z');
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now.getTime()); } static now() { return now.getTime(); } }
const pages = { tiktok: [{ link: 'https://www.tiktok.com/@rando/video/1', title: 'big snackrifice at lunch', snippet: 'gave her my chips' }, { link: 'https://www.tiktok.com/@snack.project/video/2', title: 'snackrifice means giving up your snack', snippet: '' }, { link: 'https://www.tiktok.com/@x/video/3', title: 'snacks', snippet: 'unrelated' }] };
const search = (r, resp) => { const q = JSON.parse(r.payload).q; const p = Object.keys(pages).find(k => q.includes('site:' + k + '.com') && !q.includes('-site:' + k)); return resp(200, { organic: p ? pages[p] : [] }); };
const env = makeEnv({ Date: FakeDate, props: { TEACHER_PIN: '4321', SERPER_API_KEY: 'test-key' }, search });
const call = env.call; let n = 0; const ok = (name, fn) => { fn(); n++; };

ok('public state needs no PIN and holds no hits', () => { const s = call({ action: 'state' }); assert.equal(s.ok, true); assert.deepEqual(s.terms, []); assert.equal(s.configured.provider, 'serper'); assert.equal(JSON.stringify(s).includes('test-key'), false); });
ok('PIN is enforced', () => { assert.equal(call({ action: 'search', term: { word: 'x' } }).ok, false); assert.equal(call({ action: 'login', pin: '0000' }).error, 'Wrong PIN.'); assert.equal(call({ action: 'login', pin: '4321' }).ok, true); });
ok('live search: 6 queries, coded hits, near-matches dropped, then cached', () => {
  const r = call({ action: 'search', pin: '4321', term: { word: 'snackrifice', owned: 'snack.project' } });
  assert.equal(r.ok, true); assert.equal(r.queries, 6); assert.equal(r.hits.length, 2);
  assert.equal(r.hits[0].ownership, 'earned_out'); assert.equal(r.hits[1].ownership, 'owned'); assert.equal(r.hits[1].marked, 'Y'); assert.equal(r.usage.queries, 6);
  const again = call({ action: 'search', pin: '4321', term: { word: 'snackrifice', owned: 'snack.project' } });
  assert.equal(again.queries, 0); assert.equal(again.cachedQueries, 6); assert.equal(again.usage.queries, 6);
  assert.equal(env.fetchLog[0].headers['X-API-KEY'], 'test-key'); assert.equal(JSON.parse(env.fetchLog[0].payload).tbs, undefined);
});
let id;
ok('save term, 10-slot limit', () => {
  const r = call({ action: 'saveTerm', pin: '4321', term: { word: 'snackrifice', forms: 'snackrificed', owned: '@snack.project', coiner: 'Demo' } }); assert.equal(r.ok, true); id = r.term.id;
  for (let i = 0; i < 9; i++) assert.equal(call({ action: 'saveTerm', pin: '4321', term: { word: 'filler' + i, active: false } }).ok, true);
  const over = call({ action: 'saveTerm', pin: '4321', term: { word: 'eleven' } }); assert.equal(over.ok, false); assert.ok(over.error.includes('10'));
  assert.equal(call({ action: 'saveTerm', pin: '4321', term: { id, word: 'snackrifice', forms: 'snackrificed, snackrificial', owned: '@snack.project' } }).ok, true);
  assert.equal(call({ action: 'state' }).terms.length, 10);
});
ok('first run is a baseline and is never counted', () => {
  const r = call({ action: 'runNow', pin: '4321', id }); assert.equal(r.runs[0].kind, 'baseline'); assert.equal(r.runs[0].newHits, 2);
  const t = call({ action: 'state' }).terms.find(x => x.id === id); assert.equal(t.series.length, 1); assert.equal(t.series[0].earned, 0); assert.equal(t.series[0].fudge, 0);
});
ok('later run: week filter, only new URLs stored, counted and scored', () => {
  now = new Date('2026-11-19T02:00:00Z');
  pages.tiktok.push({ link: 'https://www.tiktok.com/@newgirl/video/7', title: 'total snackrifice energy', snippet: '' }); pages.instagram = [{ link: 'https://www.instagram.com/someone/p/5/', title: 'she snackrificed her fries', snippet: '' }];
  const before = env.fetchLog.length; const r = call({ action: 'runNow', pin: '4321', id });
  assert.equal(r.runs[0].kind, 'manual'); assert.equal(r.runs[0].newHits, 2); assert.equal(JSON.parse(env.fetchLog[before].payload).tbs, 'qdr:w');
  const t = call({ action: 'state' }).terms.find(x => x.id === id), last = t.series[t.series.length - 1];
  assert.equal(last.earned, 2); assert.equal(last.byPlatform.tiktok, 1); assert.equal(last.byPlatform.instagram, 1); assert.deepEqual(last.forms, ['snackrificed']); assert.equal(last.level, 5);
  assert.deepEqual([last.F, last.U, last.D, last.G, last.E], [1, 1, 1, 1, 0]);
});
ok('teacher can recode a hit and log a school sighting', () => {
  const hits = call({ action: 'hits', pin: '4321', id }).hits; assert.equal(hits.length, 4);
  const h = hits.find(x => x.url.includes('newgirl')); assert.equal(call({ action: 'codeHit', pin: '4321', hitId: h.id, patch: { prompted: 'Y', sense: 'bogus' } }).ok, true);
  const h2 = call({ action: 'hits', pin: '4321', id }).hits.find(x => x.id === h.id); assert.equal(h2.prompted, 'Y'); assert.equal(h2.sense, 'target'); assert.equal(h2.reviewed, true);
  assert.equal(call({ action: 'addSighting', pin: '4321', termId: id, sighting: { who: 'M5 student', ownership: 'earned_out', text: 'said it in the canteen', form: 'verbatim' } }).ok, true);
  const last = call({ action: 'state' }).terms.find(x => x.id === id).series.pop(); assert.equal(last.earned, 2); assert.equal(last.byPlatform.school, 1); assert.equal(last.byPlatform.tiktok, 0);
});
ok('budget cap blocks searches', () => {
  assert.equal(call({ action: 'saveSettings', pin: '4321', settings: { monthlyCap: 20, days: '1,4', hour: 7 } }).ok, true); assert.equal(env.triggers.length, 2); assert.equal(env.triggers[0].hour, 7);
  const r = call({ action: 'search', pin: '4321', fresh: true, term: { word: 'brandnewword' } }); assert.equal(r.ok, false); assert.ok(r.error.includes('budget'));
  call({ action: 'saveSettings', pin: '4321', settings: { monthlyCap: 900 } });
});
ok('scheduled run covers active terms only; search errors are recorded', () => {
  now = new Date('2026-11-23T02:00:00Z'); const done = env.ctx.scheduledRun(); assert.equal(done.length, 1); assert.equal(done[0].kind, 'scheduled');
});
ok('formula injection is neutralised and delete purges', () => {
  call({ action: 'addSighting', pin: '4321', termId: id, sighting: { text: '=HYPERLINK("x")', who: 'a' } });
  assert.ok(env.sheets.Hits.some(r => r.includes("'=HYPERLINK(\"x\")")));
  assert.equal(call({ action: 'deleteTerm', pin: '4321', id }).ok, true); assert.equal(call({ action: 'hits', pin: '4321', id }).hits.length, 0); assert.equal(call({ action: 'state' }).terms.length, 9);
});
ok('no provider key gives a clear error', () => { const e2 = makeEnv({ props: { TEACHER_PIN: '1' } }); assert.ok(e2.call({ action: 'search', pin: '1', term: { word: 'x' } }).error.includes('No search key')); });
console.log('backend tests passed:', n);
