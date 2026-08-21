// ---
// purpose: Assert stats totals, per-book/topic aggregates, time histograms and streaks
// exports: run()
// depends: tests/harness.js, js/stats.js
// ---
'use strict';
const { loadKC, eq, ok, section } = require('./harness');

function rec(o) {
  return {
    id: o.id, type: o.type, text: o.text || '', title: o.title, author: o.author,
    bookKey: o.bookKey, dateMs: o.dateMs === undefined ? null : o.dateMs,
    order: o.order, note: o.note || null
  };
}

const PHILO = { title: 'Philosophy Book', author: 'A. Author', bookKey: 'philo' };
const NOVEL = { title: 'Novel Book', author: 'B. Writer', bookKey: 'novel' };

function at(y, m, d, hh, mm) { return new Date(y, m, d, hh || 0, mm || 0).getTime(); }

function build() {
  const P = PHILO, N = NOVEL;
  return [
    // philo — 4 highlights (3 + 7 + 2 + 1 = 13 words), 1 standalone note
    rec({ id: 'h1', type: 'highlight', text: 'one two three', dateMs: at(2024, 0, 3, 14, 30), order: 0, title: P.title, author: P.author, bookKey: P.bookKey }),
    rec({ id: 'h2', type: 'highlight', text: 'alpha beta gamma delta five six seven', dateMs: at(2024, 0, 4, 10, 0), order: 1, title: P.title, author: P.author, bookKey: P.bookKey }),
    rec({ id: 'h3', type: 'highlight', text: 'a b', dateMs: at(2024, 0, 5, 10, 0), order: 2, title: P.title, author: P.author, bookKey: P.bookKey }),
    rec({ id: 'h4', type: 'highlight', text: 'solo', dateMs: at(2024, 0, 5, 16, 0), order: 3, title: P.title, author: P.author, bookKey: P.bookKey }),
    rec({ id: 'n1', type: 'note', text: 'a standalone note', dateMs: null, order: 4, title: P.title, author: P.author, bookKey: P.bookKey }),
    // novel — 2 highlights (4 + 2 = 6 words), one of them carrying an attached note, 1 bookmark
    rec({ id: 'h5', type: 'clipping', text: 'x y z w', dateMs: at(2024, 0, 15, 9, 0), order: 5, title: N.title, author: N.author, bookKey: N.bookKey }),
    rec({ id: 'h6', type: 'highlight', text: 'hello world', dateMs: null, order: 6, title: N.title, author: N.author, bookKey: N.bookKey, note: { text: 'attached' } }),
    rec({ id: 'b1', type: 'bookmark', text: '', dateMs: at(2024, 0, 10, 12, 0), order: 7, title: N.title, author: N.author, bookKey: N.bookKey })
  ];
}

const BOOKS = [
  { key: 'philo', title: 'Philosophy Book', author: 'A. Author', count: 4 },
  { key: 'novel', title: 'Novel Book', author: 'B. Writer', count: 2 },
  { key: 'empty', title: 'Empty Book', author: 'C. Ghost', count: 0 }
];
const LIB = { philo: { topic: 'philosophy' } };

function run() {
  const KC = loadKC('pt-BR');
  const s = KC.stats.compute(build(), BOOKS, LIB);

  section('stats — totals');
  eq(s.highlights, 6, 'highlights counts highlight + clipping only');
  eq(s.notes, 2, 'notes = standalone note records + records with an attached rec.note');
  eq(s.bookmarks, 1, 'bookmarks counts bookmark records');
  eq(s.books, 2, 'books counts only books with at least one highlight or note');
  eq(s.words, 19, 'total words across highlights');
  eq(s.avgWords, 3, 'avgWords = round(19 / 6)');

  section('stats — per book');
  eq(s.topBooks.length, 2, 'topBooks drops the book with no visible records');
  eq(s.topBooks[0].title, 'Philosophy Book', 'topBooks is sorted by highlight count descending');
  eq(s.topBooks[0].words, 13, 'top book word total');
  eq(s.topBooks[0].notes, 1, 'top book note total');
  eq(s.topBooks[1].title, 'Novel Book', 'second book by count');
  eq(s.topBooks[1].words, 6, 'second book word total');

  section('stats — topics');
  eq(s.topics.length, 2, 'two topic buckets');
  eq(s.topics[0].topic, 'philosophy', 'topic comes from the lib map, busiest first');
  eq(s.topics[0].count, 4, 'philosophy highlight count');
  eq(s.topics[1].topic, 'uncategorized', 'a book missing from lib falls back to uncategorized');
  eq(s.topics[1].count, 2, 'uncategorized highlight count');

  section('stats — time histograms');
  eq(s.byWeekday.length, 7, 'byWeekday has 7 buckets');
  eq(s.byHour.length, 24, 'byHour has 24 buckets');
  eq(s.byWeekday[3], 1, 'Wed 2024-01-03 lands in the Wednesday bucket (local)');
  eq(s.byHour[14], 1, '14:30 local lands in the 14h bucket');
  eq(s.byWeekday.reduce(function (a, b) { return a + b; }, 0), 5, 'only dated highlights reach the histograms');
  eq(s.byHour.reduce(function (a, b) { return a + b; }, 0), 5, 'null-dated highlight is excluded from byHour');
  eq(s.byMonth, [{ key: '2024-01', count: 5 }], 'byMonth key and count');
  eq(s.byYear, [{ year: 2024, count: 5 }], 'byYear key and count');

  section('stats — days and streaks');
  eq(s.activeDays, 4, 'four distinct local days with highlights');
  eq(s.busiestDay.count, 2, 'busiest day has two highlights');
  eq(s.longestStreak, 3, 'Jan 3-4-5 is a three-day streak');
  eq(s.currentStreak, 1, 'the Jan 15 gap resets the running streak');
  eq(s.spanDays, 12, 'span from first to last dated record, rounded to days');

  section('stats — longest highlight');
  eq(s.longest.words, 7, 'longest picks the highlight with the most words');
  eq(s.longest.title, 'Philosophy Book', 'longest carries its book title');

  section('stats — empty input');
  const z = KC.stats.compute([], [], {});
  ok(z && typeof z === 'object', 'compute([], [], {}) does not throw');
  eq(z.highlights, 0, 'zero highlights');
  eq(z.avgWords, 0, 'zero avgWords');
  eq(z.longest, null, 'no longest highlight');
  eq(z.busiestDay, null, 'no busiest day');
  eq(z.longestStreak, 0, 'no streak');
}

module.exports = { run };
