// ---
// purpose: Load the browser modules into a bare node vm and provide assertion helpers
// exports: loadKC(lang), eq(), ok(), near(), section(), report(), state
// gotcha: the modules expect a `window` global only — no DOM is created, so nothing may touch it at load
// ---
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['js/i18n.js', 'js/topics.js', 'js/parser.js', 'js/dedupe.js', 'js/clean.js',
  'js/tags.js', 'js/search.js', 'js/sort.js', 'js/exports.js'];

function loadKC(lang) {
  const sandbox = { console, setTimeout, window: {}, navigator: { language: lang || 'pt-BR' } };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
  return sandbox.window.KC;
}

const state = { pass: 0, fail: 0, failures: [] };

function section(name) {
  console.log('\n\x1b[1m' + name + '\x1b[0m');
}

function record(cond, label, detail) {
  if (cond) {
    state.pass++;
    console.log('  \x1b[32mok\x1b[0m   ' + label);
  } else {
    state.fail++;
    state.failures.push(label + (detail ? ' — ' + detail : ''));
    console.log('  \x1b[31mFAIL\x1b[0m ' + label + (detail ? ' — ' + detail : ''));
  }
}

function ok(cond, label) {
  record(!!cond, label);
}

function eq(actual, expected, label) {
  const a = typeof actual === 'string' ? actual : JSON.stringify(actual);
  const e = typeof expected === 'string' ? expected : JSON.stringify(expected);
  record(a === e, label, a === e ? '' : 'got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}

function report() {
  console.log('\n' + (state.fail === 0 ? '\x1b[32m' : '\x1b[31m') +
    state.pass + ' passed, ' + state.fail + ' failed\x1b[0m');
  if (state.fail) {
    for (const f of state.failures) console.log('  - ' + f);
  }
  return state.fail === 0;
}

module.exports = { loadKC, ok, eq, section, report, state, ROOT };
