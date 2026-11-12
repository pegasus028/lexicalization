/* Lexicalization - shared core (browser, Node tests and Apps Script).
   Pure functions only: query building, hit coding, scoring. No I/O here.
   Built into Code.gs by tools/build.js - edit this file, never Code.gs. */
var LexCore = (function () {
  'use strict';
  var VERSION = '1.1.0';
  var MAX_TERMS = 10;
  var USER_CAP = 3; // counted uses per user per calendar week
  var DAY = 86400000;
  var PLATFORMS = [
    { id: 'tiktok', name: 'TikTok', site: 'site:tiktok.com' },
    { id: 'instagram', name: 'Instagram', site: 'site:instagram.com' },
    { id: 'facebook', name: 'Facebook', site: 'site:facebook.com' },
    { id: 'youtube', name: 'YouTube', site: 'site:youtube.com' },
    { id: 'forums', name: 'X, Threads, Reddit', site: '(site:x.com OR site:threads.net OR site:reddit.com)' },
    { id: 'web', name: 'Rest of the web', site: '-site:tiktok.com -site:instagram.com -site:facebook.com -site:youtube.com -site:x.com -site:threads.net -site:reddit.com' },
    { id: 'school', name: 'School (logged sightings)', site: null }
  ];
  var ONLINE = PLATFORMS.filter(function (p) { return p.site; }).map(function (p) { return p.id; });

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function lower(s) { return clean(s).toLowerCase(); }
  function list(v) {
    if (Array.isArray(v)) return v.map(clean).filter(Boolean);
    return clean(v) ? String(v).split(/[,;\n]/).map(clean).filter(Boolean) : [];
  }
  function uniq(a) { var seen = {}; return a.filter(function (x) { var k = x.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ('0000000' + (h >>> 0).toString(16)).slice(-8); }
  function isoDay(d) { return new Date(d).toISOString().slice(0, 10); }
  function ms(d) { return new Date(String(d).length === 10 ? d + 'T00:00:00Z' : d).getTime(); }
  function weekKey(d) { var t = new Date(ms(d)); var dow = (t.getUTCDay() + 6) % 7; return isoDay(t.getTime() - dow * DAY); }

  /* ---------- terms ---------- */
  function allForms(term) {
    var f = uniq([clean(term.word)].concat(list(term.forms)));
    var extra = [];
    f.forEach(function (x) { if (/\s|-/.test(x)) extra.push(x.replace(/[\s-]+/g, '')); });
    return uniq(f.concat(extra));
  }
  function normTerm(t) {
    var word = clean(t.word);
    return {
      id: t.id || 't' + hash(lower(word)), word: word, forms: uniq(list(t.forms)),
      kind: t.kind === 'existing' ? 'existing' : 'new', meaning: clean(t.meaning),
      cues: uniq(list(t.cues)), exclude: uniq(list(t.exclude)), coiner: clean(t.coiner),
      owned: uniq(list(t.owned).map(normHandle)), role: /^(control|foil)$/.test(t.role) ? t.role : 'student',
      active: t.active !== false && t.active !== 'false', created: t.created || '', dict: clean(t.dict)
    };
  }
  function normHandle(h) { return lower(h).replace(/^@/, ''); }

  /* ---------- search queries ---------- */
  // One query per online setting; every registered form is OR-ed into the same query, so a term
  // costs the same number of queries however many forms it has.
  function buildQueries(term, opts) {
    opts = opts || {};
    var forms = allForms(term).slice(0, 6).map(function (f) { return '"' + f + '"'; });
    var core = forms.length > 1 ? '(' + forms.join(' OR ') + ')' : forms[0];
    var want = opts.platforms || ONLINE;
    return PLATFORMS.filter(function (p) { return p.site && want.indexOf(p.id) >= 0; })
      .map(function (p) { return { platform: p.id, q: core + ' ' + p.site }; });
  }
  function platformOf(url) {
    var h = hostOf(url);
    if (/(^|\.)tiktok\.com$/.test(h)) return 'tiktok';
    if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
    if (/(^|\.)(facebook|fb)\.com$/.test(h)) return 'facebook';
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube';
    if (/(^|\.)(x\.com|twitter\.com|threads\.net|threads\.com|reddit\.com)$/.test(h)) return 'forums';
    return 'web';
  }
  function hostOf(url) { var m = /^https?:\/\/([^\/?#]+)/i.exec(clean(url)); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; }
  function pathOf(url) { var m = /^https?:\/\/[^\/?#]+([^?#]*)/i.exec(clean(url)); return m ? m[1] : ''; }
  // Best-effort account id from a result URL. When the account cannot be read from the URL,
  // the post itself is the id, so two posts by one unknown account count as two users.
  function userOf(url) {
    var h = hostOf(url), p = pathOf(url), seg = p.split('/').filter(Boolean), pf = platformOf(url);
    if (pf === 'tiktok') { var t = /\/@([^\/]+)/.exec(p); return t ? 'tt:' + t[1].toLowerCase() : 'tt:post:' + hash(url); }
    if (pf === 'instagram') {
      if (seg[0] && !/^(p|reel|reels|explore|tv|stories|popular)$/i.test(seg[0])) return 'ig:' + seg[0].toLowerCase();
      return 'ig:post:' + hash(url);
    }
    if (pf === 'facebook') {
      if (seg[0] && !/^(groups|watch|photo|photos|story\.php|permalink\.php|share|reel|events|hashtag|public|people)$/i.test(seg[0])) return 'fb:' + seg[0].toLowerCase();
      return 'fb:post:' + hash(url);
    }
    if (pf === 'youtube') { var c = /\/(@[^\/]+)/.exec(p); return c ? 'yt:' + c[1].toLowerCase() : 'yt:video:' + hash(url); }
    if (pf === 'forums') {
      if (/reddit\.com$/.test(h)) { var u = /\/user\/([^\/]+)/.exec(p); return u ? 'rd:' + u[1].toLowerCase() : 'rd:post:' + hash(url); }
      if (seg[0] && !/^(search|hashtag|i|explore|home)$/i.test(seg[0])) return (/threads/.test(h) ? 'th:' : 'x:') + seg[0].toLowerCase().replace(/^@/, '');
      return 'x:post:' + hash(url);
    }
    return 'web:' + h;
  }
  function handleOf(user) { var m = /^[a-z]+:(?!post:|video:)(.+)$/.exec(user || ''); return m ? m[1].replace(/^@/, '') : ''; }
  // What students see instead of an account name.
  function userCode(user) { var pre = String(user || '').split(':')[0].toUpperCase() || 'U'; return pre + '-' + hash(user).slice(0, 4).toUpperCase(); }

  /* ---------- coding a hit ---------- */
  function formRegex(f) { return new RegExp('(^|[^a-z0-9])(#?)' + esc(f.toLowerCase()).replace(/\\?[\s-]+/g, '[\\s-]*') + '(?![a-z0-9])', 'i'); }
  /* ---------- match score: how closely a result matches the keyword and the meaning ---------- */
  var KEYWORD_POINTS = { exact: 60, tag: 57, form: 54, near: 38 };
  var MEANING_POINTS = { new: 40, unclear: 25, other: -5 }; // an older meaning always lands under 60%
  var MEANING_BONUS = 5;
  var NEAR_SUFFIXES = ['ers', 'ing', 'ish', 'es', 'ed', 'er', 's', 'd', 'y'];
  var STOP = {};
  ('about above after again also always another because been before being between both could does doing down during each ever every from have having here into just like made make many more most much must only other over really same should some someone something such than that their them then there these they thing this those through under until very want were what when where which while will with without would your yours people person when you'
  ).split(' ').forEach(function (w) { STOP[w] = 1; });
  function parts(f) { return lower(f).split(/[\s-]+/).filter(Boolean).map(esc); }
  // plain = standalone word or phrase, not a hashtag; tag = "#word" or the joined form of a phrase
  function plainRe(f) { return new RegExp('(^|[^a-z0-9#])(' + parts(f).join('[\\s-]+') + ')(?![a-z0-9])', 'i'); }
  function tagRe(f) { var p = parts(f); return new RegExp(p.length > 1 ? '(^|[^a-z0-9])(#?' + p.join('') + '|#' + p.join('[\\s-]*') + ')(?![a-z0-9])' : '(^|[^a-z0-9])(#' + p[0] + ')(?![a-z0-9])', 'i'); }
  function editWithin1(a, b) {
    if (a === b) return false; var la = a.length, lb = b.length, i = 0, j = 0, diff = 0;
    if (Math.abs(la - lb) > 1) return false;
    while (i < la && j < lb) { if (a[i] === b[j]) { i++; j++; continue; } if (++diff > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
    return diff + (la - i) + (lb - j) <= 1;
  }
  // Which level of keyword match does the text contain? exact > tag > form > near > none.
  function keywordMatch(term, text) {
    var t = ' ' + lower(text) + ' ', head = lower(term.word), m, best = null;
    if (!head) return { level: 'none', points: 0, form: null, matched: '' };
    if ((m = plainRe(head).exec(t))) return { level: 'exact', points: KEYWORD_POINTS.exact, form: 'verbatim', matched: m[2] };
    if ((m = tagRe(head).exec(t))) return { level: 'tag', points: KEYWORD_POINTS.tag, form: 'verbatim', matched: m[2] };
    uniq(list(term.forms)).forEach(function (f) {
      if (lower(f) === head) return;
      var x = plainRe(f).exec(t) || tagRe(f).exec(t) || new RegExp('(^|[^a-z0-9])(#' + parts(f).join('[\\s-]*') + ')(?![a-z0-9])', 'i').exec(t);
      if (x && (!best || f.length > best.form.length)) best = { level: 'form', points: KEYWORD_POINTS.form, form: f, matched: x[2] };
    });
    if (best) return best;
    var p = parts(head), near = null;
    // (a) an unlisted inflection or derivative: headword + a common suffix
    var lastW = p[p.length - 1], stems = [lastW + '(?:' + NEAR_SUFFIXES.join('|') + ')'];
    if (/[a-z]e$/.test(lastW)) stems.push(lastW.slice(0, -1) + '(?:ing|ed|er|ers|ish|y)');           // snackrifice: snackrificing
    if (/[^aeiou][aeiou][^aeiouwxy]$/.test(lastW)) stems.push(lastW + lastW.slice(-1) + '(?:ing|ed|er|ers|y)'); // plotdrunk: no; yap: yapping
    m = new RegExp('(^|[^a-z0-9])#?(' + p.slice(0, -1).concat(['(?:' + stems.join('|') + ')']).join('[\\s-]*') + ')(?![a-z0-9])', 'i').exec(t);
    if (m) near = m[2];
    // (b) a likely misspelling: one letter added, removed or changed. Only for coined words of 5+ letters,
    //     because the one-letter neighbours of an existing word are usually other real words (cooked / booked).
    if (!near && p.length === 1 && head.length >= 5 && term.kind !== 'existing') {
      (t.match(/[a-z0-9]+/g) || []).some(function (tok) { if (editWithin1(tok, head)) { near = tok; return true; } return false; });
    }
    // (c) a phrase whose words all appear, but not side by side
    if (!near && p.length > 1 && p.every(function (w) { return new RegExp('(^|[^a-z0-9])' + w + '(?![a-z0-9])', 'i').test(t); })) near = head.split(/[\s-]+/).join(' … ');
    if (near) return { level: 'near', points: KEYWORD_POINTS.near, form: null, matched: near };
    return { level: 'none', points: 0, form: null, matched: '' };
  }
  function meaningMatch(term, text) {
    var cue = hasAny(term.cues, text), old = hasAny(term.exclude, text), level, bonus = 0;
    if (old && !cue) level = 'other';
    else if (old && cue) level = 'unclear';
    else if (term.kind === 'existing') level = cue ? 'new' : 'unclear';
    else level = 'new';
    if (level === 'unclear' && term.meaning) {
      var skip = {}; allForms(term).forEach(function (f) { lower(f).split(/[\s-]+/).forEach(function (w) { skip[w] = 1; }); });
      var words = (lower(term.meaning).match(/[a-z]{4,}/g) || []).filter(function (w) { return !STOP[w] && !skip[w]; });
      if (hasAny(words, text)) bonus = MEANING_BONUS;
    }
    return { level: level, points: MEANING_POINTS[level] + bonus, bonus: bonus };
  }
  function bandOf(pct) { return pct >= 100 ? 'exact' : pct >= 80 ? 'close' : pct >= 60 ? 'similar' : 'below'; }
  var KEYWORD_LABEL = { exact: 'Exact word', tag: 'Hashtag or joined form only', form: 'A listed form', near: 'Near match' };
  var MEANING_LABEL = { new: 'new meaning', unclear: 'meaning unclear', other: 'older meaning' };
  // raw = {title, snippet}. Returns null when nothing like the keyword is in the text.
  function matchScore(term, raw) {
    var text = clean(raw.title) + ' — ' + clean(raw.snippet), k = keywordMatch(term, text);
    if (k.level === 'none') return null;
    var m = meaningMatch(term, text), pct = k.points + m.points;
    return { pct: pct, band: bandOf(pct), keyword: k.level, keywordPoints: k.points, meaning: m.level, meaningPoints: m.points, bonus: m.bonus, matched: k.matched, form: k.form,
      why: KEYWORD_LABEL[k.level] + (k.level === 'near' || k.level === 'form' ? ' (' + k.matched + ')' : '') + ' · ' + MEANING_LABEL[m.level] + (m.bonus ? ' (+' + m.bonus + ' meaning words)' : '') };
  }
  // The form a countable hit uses, or null. Near matches are never countable.
  function findForm(term, text) { var k = keywordMatch(term, text); return k.level === 'none' || k.level === 'near' ? null : k.form; }
  // Clue and older-meaning words match as standalone words. A single word also matches with a common
  // ending (boil: boils, boiled, boiling); a phrase also matches with punctuation between its words (fine, but).
  function hasAny(words, text) {
    var t = lower(text);
    return list(words).some(function (w) {
      var p = lower(w).split(/\s+/).filter(Boolean).map(esc); if (!p.length) return false;
      var body = p.length > 1 ? p.join('[\\s,.;:!?\'"’-]+') : p[0] + (p[0].length >= 3 ? '(?:s|es|ed|d|ing)?' : '');
      return new RegExp('(^|[^a-z0-9])' + body + '(?![a-z0-9])', 'i').test(t);
    });
  }
  var MARKERS = /\b(means?|meaning|definition|defined as|define[sd]?|new word|new slang|slang for|slang term|is when|a word for|made[- ]up word|coined|urban dictionary)\b/i;
  function isMarked(term, text, settings) {
    var t = clean(text), forms = allForms(term);
    if (MARKERS.test(t)) return true;
    var tag = clean(settings && settings.projectTag);
    if (tag && lower(t).indexOf(lower(tag)) >= 0) return true;
    var quoted = false, plain = false;
    forms.forEach(function (f) {
      var e = esc(f).replace(/\\?[\s-]+/g, '[\\s-]*');
      if (new RegExp('["\u201C\u2018\'`*]\\s*' + e + '\\s*["\u201D\u2019\'`*]', 'i').test(t)) quoted = true;
      var re = new RegExp('(^|[^a-z0-9#])' + e + '(?![a-z0-9])', 'i');
      if (re.test(' ' + t)) plain = true;
    });
    if (quoted) return true;
    return !plain; // it only ever appears as a hashtag
  }
  // raw = {url, title, snippet, date?}. Returns null when the term is not actually in the text
  // (search engines return near-matches), so such results are never stored or counted.
  // opts.keepNear: also return near matches (Search screen only). They carry near:true and can never be stored or counted.
  function codeHit(term, raw, settings, opts) {
    settings = settings || {};
    var text = clean(raw.title) + ' \u2014 ' + clean(raw.snippet);
    var match = matchScore(term, raw);
    if (!match || (match.keyword === 'near' && !(opts && opts.keepNear))) return null;
    var form = match.form || match.matched;
    var user = raw.user || userOf(raw.url), handle = normHandle(handleOf(user));
    var ownership = 'earned_out';
    if (handle && term.owned.indexOf(handle) >= 0) ownership = 'owned';
    else if (handle && list(settings.classHandles).map(normHandle).indexOf(handle) >= 0) ownership = 'class';
    var sense = match.meaning === 'new' ? 'target' : match.meaning;
    return {
      platform: raw.platform || platformOf(raw.url), url: clean(raw.url), title: clean(raw.title).slice(0, 200),
      snippet: clean(raw.snippet).slice(0, 400), pubDate: clean(raw.date), user: user, ownership: ownership, sense: sense,
      marked: isMarked(term, text, settings) ? 'Y' : 'N', prompted: 'N', form: form, source: 'auto', reviewed: false,
      near: match.keyword === 'near', match: match
    };
  }

  /* ---------- counting and scoring ---------- */
  function band(total) { return total >= 7 ? 'Likely' : total >= 5 ? 'Fringe' : 'Doomed'; }
  // Counted use = new meaning AND someone outside the class AND not asked for AND not from the
  // baseline run; at most USER_CAP per user per calendar week.
  function countedHits(hits) {
    var per = {}, out = [];
    hits.slice().sort(function (a, b) { return ms(a.firstSeen) - ms(b.firstSeen); }).forEach(function (h) {
      if (h.sense !== 'target' || h.baseline || h.prompted === 'Y') return;
      if (h.ownership !== 'earned_in' && h.ownership !== 'earned_out') return;
      var k = weekKey(h.firstSeen) + '|' + h.user;
      per[k] = (per[k] || 0) + 1;
      if (per[k] <= USER_CAP) out.push(h);
    });
    return out;
  }
  function scoreAt(term, hits, date) {
    var T = ms(date) + DAY - 1, upTo = hits.filter(function (h) { return ms(h.firstSeen) <= T; });
    var cu = countedHits(upTo);
    var within = function (h, days) { return ms(h.firstSeen) > T - days * DAY; };
    var wk = cu.filter(function (h) { return within(h, 7); }), win = cu.filter(function (h) { return within(h, 28); });
    var n = wk.length, unmarked = wk.filter(function (h) { return h.marked !== 'Y'; }).length;
    var users = {}, settings = {}, hasOut = false;
    win.forEach(function (h) { users[h.user] = 1; settings[h.platform] = 1; if (h.ownership === 'earned_out') hasOut = true; });
    var nUsers = Object.keys(users).length, nSet = Object.keys(settings).length;
    var forms = {}; cu.forEach(function (h) { if (h.form && h.form !== 'verbatim') forms[h.form] = 1; });
    var formList = Object.keys(forms).sort();
    var active = 0;
    for (var k = 0; k < 4; k++) if (cu.some(function (h) { var t = ms(h.firstSeen); return t > T - 7 * (k + 1) * DAY && t <= T - 7 * k * DAY; })) active++;
    var ush = n ? unmarked / n : 0;
    var F = n === 0 ? 0 : n <= 4 ? 1 : 2;
    var U = n >= 3 && ush >= 0.6 ? 2 : n && ush >= 0.25 ? 1 : 0;
    var D = nUsers >= 6 && nSet >= 2 && hasOut ? 2 : nUsers >= 2 ? 1 : 0;
    var G = Math.min(2, formList.length);
    var E = active === 4 ? 2 : active >= 2 ? 1 : 0;
    var level = cu.some(function (h) { return h.ownership === 'earned_out'; }) ? 5 : cu.length ? 4
      : upTo.some(function (h) { return h.ownership === 'owned' && h.sense === 'target'; }) ? 1 : 0;
    var byPlatform = {}, targetBy = {}, readBy = {};
    PLATFORMS.forEach(function (p) { byPlatform[p.id] = 0; targetBy[p.id] = 0; readBy[p.id] = 0; });
    wk.forEach(function (h) { byPlatform[h.platform] = (byPlatform[h.platform] || 0) + 1; });
    var week = upTo.filter(function (h) { return within(h, 7) && !h.baseline; });
    week.forEach(function (h) { readBy[h.platform] = (readBy[h.platform] || 0) + 1; if (h.sense === 'target') targetBy[h.platform] = (targetBy[h.platform] || 0) + 1; });
    var online = week.filter(function (h) { return h.platform !== 'school'; });
    var coded = online.filter(function (h) { return h.sense !== 'unclear'; });
    var tgt = coded.filter(function (h) { return h.sense === 'target'; }).length;
    var base = hits.filter(function (h) { return h.baseline && h.sense !== 'unclear'; });
    var total = F + U + D + G + E;
    return {
      date: isoDay(ms(date)), F: F, U: U, D: D, G: G, E: E, fudge: total, band: band(total), level: level,
      earned: n, earnedIn: wk.filter(function (h) { return h.ownership === 'earned_in'; }).length,
      earnedOut: wk.filter(function (h) { return h.ownership === 'earned_out'; }).length,
      unmarked: unmarked, unmarkedShare: Math.round(ush * 100), users28: nUsers, settings28: nSet, forms: formList, activeWeeks: active,
      byPlatform: byPlatform, targetBy: targetBy, readBy: readBy,
      owned: week.filter(function (h) { return h.ownership === 'owned' && h.sense === 'target'; }).length,
      classmates: week.filter(function (h) { return h.ownership === 'class' && h.sense === 'target'; }).length,
      prompted: week.filter(function (h) { return h.prompted === 'Y' && h.sense === 'target'; }).length,
      unclear: online.length - coded.length, coded: coded.length, targetOnline: tgt,
      senseShare: coded.length ? Math.round(1000 * tgt / coded.length) / 10 : null,
      baselineShare: base.length ? Math.round(1000 * base.filter(function (h) { return h.sense === 'target'; }).length / base.length) / 10 : null,
      baselineHits: base.length, totalCounted: cu.length
    };
  }
  function series(term, hits, runs) {
    return runs.slice().sort(function (a, b) { return ms(a.date) - ms(b.date); }).map(function (r) {
      var m = scoreAt(term, hits, r.date); m.runId = r.id; m.kind = r.kind; m.queries = r.queries || 0; m.sample = r.sample || 0; m.error = r.error || ''; return m;
    });
  }
  // Control words should stay steady and foils at zero; otherwise the search tool changed.
  function instrumentCheck(term, hits, runs) {
    var rs = runs.filter(function (r) { return r.kind !== 'baseline'; }).sort(function (a, b) { return ms(a.date) - ms(b.date); });
    if (!rs.length) return null;
    var vals = rs.map(function (r) { return hits.filter(function (h) { return h.runId === r.id && h.sense !== 'other'; }).length; });
    var latest = vals[vals.length - 1], prior = vals.slice(Math.max(0, vals.length - 5), vals.length - 1).sort(function (a, b) { return a - b; });
    var med = prior.length ? (prior.length % 2 ? prior[(prior.length - 1) / 2] : (prior[prior.length / 2 - 1] + prior[prior.length / 2]) / 2) : null;
    var pass = term.role === 'foil' ? latest === 0 : med === null ? true : med === 0 ? latest === 0 : Math.abs(latest - med) / med <= 0.5;
    return { word: term.word, role: term.role, latest: latest, median: med, pass: pass };
  }
  function estimateQueries(nTerms, runsPerWeek, perTerm) { perTerm = perTerm || ONLINE.length; return { perRun: nTerms * perTerm, perWeek: nTerms * perTerm * runsPerWeek, perMonth: Math.round(nTerms * perTerm * runsPerWeek * 52 / 12) }; }

  return {
    VERSION: VERSION, MAX_TERMS: MAX_TERMS, USER_CAP: USER_CAP, PLATFORMS: PLATFORMS, ONLINE: ONLINE, DAY: DAY,
    clean: clean, list: list, hash: hash, isoDay: isoDay, ms: ms, weekKey: weekKey, allForms: allForms, normTerm: normTerm, normHandle: normHandle,
    buildQueries: buildQueries, platformOf: platformOf, hostOf: hostOf, userOf: userOf, handleOf: handleOf, userCode: userCode,
    findForm: findForm, keywordMatch: keywordMatch, meaningMatch: meaningMatch, matchScore: matchScore, bandOf: bandOf, isMarked: isMarked, codeHit: codeHit, band: band, countedHits: countedHits, scoreAt: scoreAt, series: series,
    instrumentCheck: instrumentCheck, estimateQueries: estimateQueries
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LexCore;
