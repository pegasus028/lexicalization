// Builds Code.gs (the single file pasted into Apps Script) from gs-src/main.gs + js/core.js.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), main = fs.readFileSync(path.join(root, 'gs-src/main.gs'), 'utf8');
const out = '/* GENERATED FILE - do not edit. Edit gs-src/main.gs or js/core.js, then run: node tools/build.js */\n\n' +
  '// ===== js/core.js =====\n' + core + '\n// ===== gs-src/main.gs =====\n' + main;
fs.writeFileSync(path.join(root, 'Code.gs'), out);
console.log('Code.gs written:', out.length, 'bytes');
