// Match-score test vectors. They were written independently from the scoring spec (not from the
// code), so a failure here means the code and the spec disagree.
const C = require('../js/core.js'); const vectors = require('./match_vectors.json');
let fail = 0; const bands = {};
for (const v of vectors) {
  const term = C.normTerm(v.term), m = C.matchScore(term, v.raw);
  const got = m ? { keyword: m.keyword, meaning: m.meaning, pct: m.pct, band: m.band } : { keyword: 'none', meaning: null, pct: null, band: 'dropped' };
  const e = v.expect, ok = got.keyword === e.keyword && got.pct === e.pct && got.band === e.band && (e.keyword === 'none' || got.meaning === e.meaning);
  bands[got.band] = (bands[got.band] || 0) + 1;
  if (!ok) { fail++; console.log(`FAIL ${v.id}${v.ambiguous ? ' (ambiguous)' : ''}: "${v.raw.title} | ${v.raw.snippet}"\n   term ${v.term.word} (${v.term.kind})  expected ${JSON.stringify(e)}\n   got      ${JSON.stringify(got)}\n   why: ${v.why}`); }
}
console.log(`match vectors: ${vectors.length - fail} of ${vectors.length} passed`, JSON.stringify(bands));
if (fail) process.exit(1);
