const assert = require('assert'); const C = require('../js/core.js');
let n = 0; const t = (name, fn) => { fn(); n++; };
const kett = C.normTerm({ word: 'kettling', forms: 'kettled, kettler, to kettle', kind: 'existing', meaning: 'getting quietly angrier', cues: 'quietly, angry, mad, fine but, rn', exclude: 'police, protest, tea, boil, crowd', owned: '@kettle.project' });
const snack = C.normTerm({ word: 'snackrifice', forms: 'snackrificed' });

t('normTerm', () => { assert.equal(kett.kind, 'existing'); assert.deepEqual(kett.owned, ['kettle.project']); assert.equal(snack.kind, 'new'); assert.equal(snack.role, 'student'); assert.equal(C.normTerm({ word: 'x', role: 'foil' }).role, 'foil'); });
t('queries: one per online setting, forms OR-ed', () => {
  const q = C.buildQueries(kett); assert.equal(q.length, 6);
  assert.ok(q[0].q.includes('"kettling" OR "kettled"')); assert.ok(q.find(x => x.platform === 'tiktok').q.endsWith('site:tiktok.com'));
  assert.equal(C.buildQueries(snack)[0].q.startsWith('("snackrifice" OR "snackrificed")'), true);
  assert.deepEqual(C.estimateQueries(10, 2), { perRun: 60, perWeek: 120, perMonth: 520 });
});
t('platform and user from URL', () => {
  assert.equal(C.platformOf('https://www.tiktok.com/@amy/video/1'), 'tiktok'); assert.equal(C.userOf('https://www.tiktok.com/@Amy/video/1'), 'tt:amy');
  assert.equal(C.userOf('https://www.instagram.com/some.one/p/abc/'), 'ig:some.one'); assert.ok(C.userOf('https://www.instagram.com/p/abc/').startsWith('ig:post:'));
  assert.equal(C.platformOf('https://m.facebook.com/x'), 'facebook'); assert.equal(C.platformOf('https://youtu.be/x'), 'youtube');
  assert.equal(C.userOf('https://x.com/jo/status/1'), 'x:jo'); assert.equal(C.platformOf('https://www.reddit.com/r/a/comments/1'), 'forums');
  assert.equal(C.userOf('https://blog.example.org/a'), 'web:blog.example.org'); assert.ok(/^TT-[0-9A-F]{4}$/.test(C.userCode('tt:amy')));
  assert.equal(C.handleOf('tt:amy'), 'amy'); assert.equal(C.handleOf('ig:post:abc'), '');
});
t('findForm', () => {
  assert.equal(C.findForm(kett, 'she is KETTLING rn'), 'verbatim'); assert.equal(C.findForm(kett, 'total kettler energy'), 'kettler');
  assert.equal(C.findForm(kett, 'the kettle is on'), null); assert.equal(C.findForm(kett, 'unkettling'), null); assert.equal(C.findForm(kett, '#kettling'), 'verbatim');
  const aura = C.normTerm({ word: 'aura farming' }); assert.equal(C.findForm(aura, 'pure #aurafarming'), 'verbatim'); assert.equal(C.findForm(aura, 'aura-farming again'), 'verbatim');
});
t('codeHit: sense', () => {
  const h = (title, snippet, url) => C.codeHit(kett, { url: url || 'https://www.tiktok.com/@z/video/9', title, snippet }, { classHandles: 'mint.class', projectTag: '#makefetchhappen' });
  assert.equal(h('she said fine but she is kettling', '').sense, 'target');
  assert.equal(h('Police were kettling the crowd', '').sense, 'other');
  assert.equal(h('kettling??', '').sense, 'unclear');
  assert.equal(h('quietly kettling at the police station', '').sense, 'unclear');
  assert.equal(h('nothing here', 'no match'), null);
  assert.equal(C.codeHit(snack, { url: 'https://x.com/a/status/1', title: 'big snackrifice today', snippet: '' }).sense, 'target');
});
t('codeHit: ownership and marked', () => {
  const s = { classHandles: '@mint.class', projectTag: '#makefetchhappen' };
  assert.equal(C.codeHit(kett, { url: 'https://www.tiktok.com/@kettle.project/video/1', title: 'quietly kettling', snippet: '' }, s).ownership, 'owned');
  assert.equal(C.codeHit(kett, { url: 'https://www.instagram.com/mint.class/p/1', title: 'quietly kettling', snippet: '' }, s).ownership, 'class');
  assert.equal(C.codeHit(kett, { url: 'https://www.tiktok.com/@rando/video/1', title: 'quietly kettling', snippet: '' }, s).ownership, 'earned_out');
  const m = (txt) => C.codeHit(snack, { url: 'https://x.com/a/status/1', title: txt, snippet: '' }, s).marked;
  assert.equal(m('that was a real snackrifice'), 'N'); assert.equal(m('"snackrifice" is my new favourite'), 'Y'); assert.equal(m('snackrifice means giving up your snack'), 'Y');
  assert.equal(m('lunch time #snackrifice'), 'Y'); assert.equal(m('a snackrifice for you #makefetchhappen'), 'Y'); assert.equal(m('my snackrifice #lunch'), 'N');
});
const mk = (o) => Object.assign({ sense: 'target', ownership: 'earned_out', prompted: 'N', marked: 'N', form: 'verbatim', platform: 'tiktok', user: 'tt:a', firstSeen: '2026-12-07', baseline: false }, o);
t('countedHits rules and cap', () => {
  const hits = [mk({}), mk({ ownership: 'owned' }), mk({ ownership: 'class' }), mk({ sense: 'other' }), mk({ sense: 'unclear' }), mk({ prompted: 'Y' }), mk({ baseline: true }),
    mk({ user: 'tt:b', firstSeen: '2026-12-08' }), mk({ user: 'tt:b', firstSeen: '2026-12-08' }), mk({ user: 'tt:b', firstSeen: '2026-12-09' }), mk({ user: 'tt:b', firstSeen: '2026-12-10' }), mk({ user: 'tt:b', firstSeen: '2026-12-14' })];
  assert.equal(C.countedHits(hits).length, 1 + 3 + 1);
});
t('scoreAt thresholds', () => {
  assert.equal(C.scoreAt(snack, [], '2026-12-07').fudge, 0); assert.equal(C.scoreAt(snack, [], '2026-12-07').band, 'Doomed');
  let s = C.scoreAt(snack, [mk({})], '2026-12-07'); assert.deepEqual([s.F, s.U, s.D, s.G, s.E, s.level], [1, 1, 0, 0, 0, 5]);
  const many = []; for (let i = 0; i < 6; i++) many.push(mk({ user: 'u' + i, platform: i % 2 ? 'instagram' : 'tiktok', form: i === 0 ? 'snackrificed' : i === 1 ? 'snackrificial' : 'verbatim' }));
  for (const d of ['2026-11-16', '2026-11-23', '2026-11-30']) many.push(mk({ user: 'old', firstSeen: d, ownership: 'earned_in', platform: 'school' }));
  s = C.scoreAt(snack, many, '2026-12-07'); assert.deepEqual([s.F, s.U, s.D, s.G, s.E, s.fudge, s.band], [2, 2, 2, 2, 2, 10, 'Likely']);
  assert.equal(s.byPlatform.tiktok, 3); assert.equal(s.byPlatform.instagram, 3); assert.equal(s.users28, 7);
  s = C.scoreAt(snack, many, '2026-11-20'); assert.equal(s.earned, 1); assert.equal(s.level, 4);
  s = C.scoreAt(snack, [mk({ marked: 'Y' }), mk({ marked: 'Y', user: 'b' }), mk({ marked: 'Y', user: 'c' }), mk({ user: 'd' })], '2026-12-07'); assert.equal(s.U, 1); assert.equal(s.D, 1);
});
t('sense share and baseline', () => {
  const hits = [mk({ baseline: true, sense: 'other', firstSeen: '2026-11-16' }), mk({ baseline: true, sense: 'other', firstSeen: '2026-11-16' }), mk({}), mk({ sense: 'other' }), mk({ sense: 'other' }), mk({ sense: 'unclear' })];
  const s = C.scoreAt(kett, hits, '2026-12-07'); assert.equal(s.senseShare, 33.3); assert.equal(s.baselineShare, 0); assert.equal(s.unclear, 1);
});
t('series and instrument check', () => {
  const runs = [{ id: 'r0', date: '2026-11-16', kind: 'baseline' }, { id: 'r1', date: '2026-11-19', kind: 'scheduled' }, { id: 'r2', date: '2026-11-23', kind: 'scheduled' }];
  const se = C.series(snack, [mk({ firstSeen: '2026-11-19', runId: 'r1' })], runs); assert.deepEqual(se.map(x => x.earned), [0, 1, 1]);
  const foil = C.normTerm({ word: 'drovish', role: 'foil' });
  assert.equal(C.instrumentCheck(foil, [], runs).pass, true); assert.equal(C.instrumentCheck(foil, [mk({ runId: 'r2' })], runs).pass, false);
});
console.log('core tests passed:', n);
