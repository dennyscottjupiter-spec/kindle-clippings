// ---
// purpose: Assert right-pane sort ordering and group-key assignment
// exports: run()
// depends: tests/harness.js
// ---
'use strict';
const { loadKC, ok, eq, section } = require('./harness');

function rec(id, order, dateMs, title, bookKey) {
  return { id: id, order: order, dateMs: dateMs, title: title, bookKey: bookKey };
}

function run() {
  const KC = loadKC('pt-BR');
  const recs = [
    rec('a', 0, 1000, 'Zeta Book', 'zeta'),
    rec('b', 1, 3000, 'Alpha Book', 'alpha'),
    rec('c', 2, null, 'Alpha Book', 'alpha'),
    rec('d', 3, 2000, 'Beta Book', 'beta'),
    rec('e', 4, null, 'Zeta Book', 'zeta')
  ];
  const lib = {
    zeta: { topic: 'science' },
    alpha: { topic: 'fiction' },
    beta: {}
  };

  section('sort — order (default)');
  const byOrder = KC.sort.apply(recs, 'order', lib);
  eq(byOrder.map(function (r) { return r.id; }).join(''), 'abcde', 'order mode returns file order');
  ok(byOrder.every(function (r) { return r._group === null; }), '_group is null in order mode');

  section('sort — dateDesc / dateAsc');
  const desc = KC.sort.apply(recs, 'dateDesc', lib);
  eq(desc.map(function (r) { return r.id; }).join(''), 'bdace', 'newest first, null dates fall to the end in order tie-break');
  const asc = KC.sort.apply(recs, 'dateAsc', lib);
  eq(asc.map(function (r) { return r.id; }).join(''), 'ceadb', 'oldest first, null dates (0) sort first, tie-broken by file order');

  section('sort — book');
  const byBook = KC.sort.apply(recs, 'book', lib);
  ok(byBook[0].title === 'Alpha Book' && byBook[1].title === 'Alpha Book', 'Alpha Book entries are contiguous');
  eq(byBook.filter(function (r) { return r._group !== null; }).length, recs.length, '_group is set for every record in book mode');

  section('sort — topic');
  const byTopic = KC.sort.apply(recs, 'topic', lib);
  const topicSeq = byTopic.map(function (r) { return lib[r.bookKey].topic || 'uncategorized'; });
  eq(topicSeq[topicSeq.length - 1], 'uncategorized', 'uncategorized topic sorts last');
  let contiguous = true, seen = {};
  for (let i = 0; i < topicSeq.length; i++) {
    if (i > 0 && topicSeq[i] !== topicSeq[i - 1] && seen[topicSeq[i]]) contiguous = false;
    seen[topicSeq[i]] = true;
  }
  ok(contiguous, 'topic groups stay contiguous');
  eq(byTopic.filter(function (r) { return r._group !== null; }).length, recs.length, '_group is set for every record in topic mode');
}

module.exports = { run };
