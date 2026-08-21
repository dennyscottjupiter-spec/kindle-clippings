// ---
// purpose: Assert the 15-topic taxonomy and Open Library subject classifier
// exports: run()
// depends: tests/harness.js
// ---
'use strict';
const { loadKC, ok, eq, section } = require('./harness');

function run() {
  const KC = loadKC('pt-BR');

  section('topics — classify');
  eq(KC.topics.classify(['Psychology', 'Cognitive science']), 'psychology', 'psychology wins on keyword hits');
  eq(KC.topics.classify(['Business & Economics', 'Leadership']), 'business', 'business scores higher than economics here');
  eq(KC.topics.classify([]), 'uncategorized', 'empty subjects -> uncategorized');
  eq(KC.topics.classify(undefined), 'uncategorized', 'undefined subjects -> uncategorized');
  eq(KC.topics.classify(['Underwater basket weaving']), 'uncategorized', 'no keyword hits -> uncategorized');

  section('topics — taxonomy shape');
  eq(KC.topics.list.length, 15, 'exactly 15 topics');
  const ids = {};
  let allHued = true;
  for (const t of KC.topics.list) {
    ok(!ids[t.id], 'unique id: ' + t.id);
    ids[t.id] = true;
    if (typeof t.h !== 'number' || t.h < 0 || t.h > 359) allHued = false;
  }
  ok(allHued, 'every topic has a hue in 0-359');
  eq(KC.topics.hueOf('psychology'), KC.topics.byId.psychology.h, 'hueOf reads byId');
  eq(KC.topics.hueOf('uncategorized'), null, 'uncategorized has no hue');
}

module.exports = { run };
