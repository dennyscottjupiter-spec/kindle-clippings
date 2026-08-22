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
  eq(s.byYear, [{ year: 2024, count: 5, words: 17, books: 2 }],
    'byYear carries count, words and distinct books for the year');

  section('stats — dense months across a gap');
  const gap = [
    rec({ id: 'g1', type: 'highlight', text: 'one', dateMs: at(2023, 10, 2, 9, 0), order: 0, title: PHILO.title, author: PHILO.author, bookKey: PHILO.bookKey }),
    rec({ id: 'g2', type: 'highlight', text: 'two words', dateMs: at(2024, 1, 4, 9, 0), order: 1, title: NOVEL.title, author: NOVEL.author, bookKey: NOVEL.bookKey }),
    rec({ id: 'g3', type: 'highlight', text: 'three', dateMs: at(2024, 1, 6, 9, 0), order: 2, title: NOVEL.title, author: NOVEL.author, bookKey: NOVEL.bookKey })
  ];
  const g = KC.stats.compute(gap, BOOKS, LIB);
  eq(g.byMonth.map(function (m) { return m.key; }),
    ['2023-11', '2023-12', '2024-01', '2024-02'],
    'byMonth is contiguous across the year boundary — no month is skipped');
  eq(g.byMonth.map(function (m) { return m.count; }), [1, 0, 0, 2],
    'the empty months inside the span are emitted with count 0');
  eq(g.byYear, [
    { year: 2023, count: 1, words: 1, books: 1 },
    { year: 2024, count: 2, words: 3, books: 1 }
  ], 'byYear is ascending, one entry per year, with per-year words and book counts');

  section('stats — days and streaks');
  eq(s.activeDays, 4, 'four distinct local days with highlights');
  eq(s.busiestDay.count, 2, 'busiest day has two highlights');
  eq(s.longestStreak, 3, 'Jan 3-4-5 is a three-day streak');
  eq(s.currentStreak, 1, 'the Jan 15 gap resets the running streak');
  eq(s.spanDays, 12, 'span from first to last dated record, rounded to days');

  section('stats — longest highlight');
  eq(s.longest.words, 7, 'longest picks the highlight with the most words');
  eq(s.longest.title, 'Philosophy Book', 'longest carries its book title');

  section('stats — adaptive bucketing (months -> quarters -> years)');
  function monthsFrom(y, m, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({ key: y + '-' + (m < 10 ? '0' + m : m), count: 1 });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  const short = monthsFrom(2024, 1, 4);
  const shortB = KC.stats.bucketMonths(short, 48);
  eq(shortB.granularity, 'month', 'a span within budget stays at monthly resolution');
  eq(shortB.buckets, short, 'and the month list passes through unchanged');

  const atBudget = monthsFrom(2024, 1, 48);
  eq(KC.stats.bucketMonths(atBudget, 48).granularity, 'month', 'a span exactly at budget still stays monthly');

  const midSpan = monthsFrom(2016, 1, 51);
  const midB = KC.stats.bucketMonths(midSpan, 48);
  eq(midB.granularity, 'quarter', 'a span over budget but fitting in quarters buckets by quarter');
  eq(midB.buckets.length, 17, '51 months bucket into 17 quarters');
  eq(midB.buckets[0], { key: '2016-Q1', count: 3 }, 'first quarter sums its 3 months');
  eq(midB.buckets[16], { key: '2020-Q1', count: 3 }, 'last quarter sums its 3 months');

  const longSpan = monthsFrom(2016, 1, 150);
  const longB = KC.stats.bucketMonths(longSpan, 48);
  eq(longB.granularity, 'year', 'a span too long even for quarterly budget falls back to years');
  eq(longB.buckets.length, 13, '150 months bucket into 13 years');
  eq(longB.buckets[0], { key: '2016', count: 12 }, 'a full year sums all 12 months');
  eq(longB.buckets[12], { key: '2028', count: 6 }, 'the trailing partial year sums only its 6 present months');

  const emptyB = KC.stats.bucketMonths([], 48);
  eq(emptyB, { granularity: 'month', buckets: [] }, 'an empty month list stays month-granularity, no buckets');

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
