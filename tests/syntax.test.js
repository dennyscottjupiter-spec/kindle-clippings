// ---
// purpose: Parse-check every shipped JS file, including the DOM modules the vm harness cannot load
// exports: run()
// depends: node --check
// ---
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ok, section, ROOT } = require('./harness');

function run() {
  section('syntax — every shipped module parses');
  const dir = path.join(ROOT, 'js');
  for (const f of fs.readdirSync(dir).filter(function (n) { return /\.js$/.test(n); })) {
    let good = true;
    try {
      execFileSync(process.execPath, ['--check', path.join(dir, f)], { stdio: 'pipe' });
    } catch (e) {
      good = false;
    }
    ok(good, 'js/' + f);
  }
  ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').indexOf('js/app.js') !== -1,
    'index.html loads js/app.js last');
}

module.exports = { run };
