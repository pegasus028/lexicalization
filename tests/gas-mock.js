// Minimal in-memory stand-ins for the Apps Script services Code.gs uses. Test-only.
const vm = require('vm'), fs = require('fs'), path = require('path');
function makeEnv(opts = {}) {
  const sheets = {}, propsMap = Object.assign({}, opts.props), cacheMap = {}, triggers = [], fetchLog = [];
  const sheetApi = (name) => {
    const rows = sheets[name];
    return {
      getLastRow: () => rows.length,
      setFrozenRows() {}, deleteRow(r) { rows.splice(r - 1, 1); },
      getRange(r, c, nr = 1, nc = 1) {
        const api = {
          setNumberFormat() { return api; },
          setValues(v) { v.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((x, j) => { rows[r - 1 + i][c - 1 + j] = x; }); }); return api; },
          getDisplayValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(String((rows[r - 1 + i] || [])[c - 1 + j] ?? '')); o.push(row); } return o; },
        };
        return api;
      },
    };
  };
  const ss = { getId: () => 'SHEET1', getUrl: () => 'https://sheet/SHEET1', getSheetByName: (n) => (sheets[n] ? sheetApi(n) : null), insertSheet: (n) => { sheets[n] = []; return sheetApi(n); } };
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  const ctx = {
    console, JSON, Math, Date: opts.Date || Date, Object, Array, String, Number, RegExp, Error, encodeURIComponent,
    SpreadsheetApp: { openById: () => ss, create: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in propsMap ? propsMap[k] : null), setProperty: (k, v) => { propsMap[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cacheMap ? cacheMap[k] : null), put: (k, v) => { cacheMap[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: (d, tz, f) => { const t = new Date(d.getTime() + 7 * 3600000).toISOString(); return f === 'yyyy-MM' ? t.slice(0, 7) : t.slice(0, 10); }, getUuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => Math.floor(Math.random() * 16).toString(16)) },
    UrlFetchApp: {
      fetchAll: (reqs) => reqs.map((r) => { fetchLog.push(r); return opts.search ? opts.search(r, resp) : resp(200, { organic: [] }); }),
      fetch: (url, o) => { fetchLog.push(Object.assign({ url }, o)); return opts.fetch ? opts.fetch(url, o, resp) : resp(200, { list: [] }); },
    },
    ScriptApp: { WeekDay: { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 },
      getProjectTriggers: () => triggers.slice(), deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: (fn) => { const t = { fn, getHandlerFunction: () => fn }; const b = { timeBased: () => b, onWeekDay: (d) => { t.day = d; return b; }, atHour: (h) => { t.hour = h; return b; }, inTimezone: () => b, create: () => { triggers.push(t); return t; } }; return b; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }) },
    Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), ctx);
  const call = (req) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(req) } }).text);
  return { ctx, call, sheets, props: propsMap, cache: cacheMap, triggers, fetchLog };
}
module.exports = { makeEnv };
