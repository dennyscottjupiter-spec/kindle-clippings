// ---
// purpose: Regression-test the pipeline against the user's real My Clippings.txt
// exports: run()
// depends: tests/harness.js, ../My Clippings.txt (gitignored; the suite skips it when absent)
// gotcha: numbers here are measured from the real export — a change means the parser changed
// ---
'use strict';
const fs = require('fs');
const path = require('path');
const { loadKC, ok, eq, section } = require('./harness');

const REAL = path.join(__dirname, '..', 'My Clippings.txt');

function run() {
  if (!fs.existsSync(REAL)) {
    section('real file — SKIPPED (My Clippings.txt not present)');
    return null;
  }

  const KC = loadKC('pt-BR');
  const parsed = KC.parse(fs.readFileSync(REAL, 'utf8'));
  const out = KC.clean.process(parsed);
  const tags = KC.tags.build(out.books);
  KC.search.index(out.visible.concat(out.hidden));

  section('real file — parsing');
  eq(parsed.records.length, 162, '162 records parsed');
  eq(parsed.unparsed, 0, '0 unparsed blocks');
  ok(parsed.records.every(function (r) { return r.title.indexOf('﻿') === -1; }),
    'no U+FEFF survives in any title');
  ok(parsed.records.every(function (r) { return r.locStart !== null; }),
    'every record resolved a location, in all four metadata shapes');
  ok(parsed.records.every(function (r) { return r.dateMs !== null; }), 'every date resolved');
  ok(parsed.records.filter(function (r) { return r.page === ''; }).length === 22,
    '22 records legitimately carry no page number');

  section('real file — BOM regression (finding #1)');
  const paper = out.books.filter(function (b) { return b.title === '1706.03762v7'; });
  eq(paper.length, 1, '1706.03762v7 is ONE book, not two');
  eq(paper[0].count + paper[0].hiddenCount, 9, 'that book holds all 9 of its records');

  section('real file — clipping limit (finding #2)');
  const trunc = out.visible.filter(function (r) { return r.truncated; });
  eq(trunc.length, 1, 'the inline sentinel record is KEPT and flagged truncated');
  ok(trunc[0].text.indexOf('the muscles in your body') !== -1, 'its real text survives');
  ok(trunc[0].text.indexOf('clipping limit') === -1, 'the sentinel itself is gone');
  eq(out.stats.clipLimit, 0, 'no record is dropped for the clipping limit');

  section('real file — filtering and books (findings #3 and #4)');
  eq(out.stats.bookmarks, 23, '23 empty bookmarks hidden');
  eq(out.hidden.filter(function (r) { return r.hiddenReason === 'device'; }).length, 1,
    'the "Your Clippings" footer is hidden as a device record, not a book');
  eq(out.stats.books, 35, '35 books after collapsing BOM and trailing-space variants');
  eq(out.visible.length, 130, '130 visible records');
  eq(out.hidden.length, 31, '31 hidden records');
  ok(!out.visible.some(function (r) { return /[\u0300-\u036f]/.test(r.text); }),
    'no loose combining marks survive NFC normalization');

  section('real file — duplicates');
  eq(out.stats.dedupe.overlapPairs, 7, '7 overlapping-location pairs');
  eq(out.stats.dedupe.containmentPairs, 5, '5 of them are also text containment');
  eq(out.stats.dedupe.exactPairs, 0, '0 exact duplicates');
  eq(out.stats.dedupe.multiComponents, 7, '7 duplicate components');
  eq(out.stats.duplicates, 7, '7 records absorbed, all recoverable behind the toggle');

  section('real file — note association (finding #5)');
  const host = out.visible.filter(function (r) { return r.note; });
  eq(host.length, 1, 'the single Note is attached to exactly one highlight');
  eq(host[0].locStart + '-' + host[0].locEnd, '85-86', 'it links to the highlight at Location 85-86');
  eq(host[0].noteMatch, 'time', 'matched by identical timestamp, not by file order');

  section('real file — search');
  const seneca = out.books.filter(function (b) { return /Estoico/i.test(b.title); })[0];
  const hits = KC.search.filter(out.visible, 'cartas estoico');
  ok(hits.length > 0, '"cartas estoico" finds the Seneca book');
  ok(hits.every(function (r) { return r.bookKey === seneca.key; }), 'and only that book');
  eq(seneca.count + seneca.hiddenCount, 29, 'the Seneca book holds 29 records');
  eq(KC.search.filter(out.visible, 'acao').length,
    KC.search.filter(out.visible, 'ação').length, 'accent-folded query matches the accented one');

  section('real file — tags');
  eq(Object.keys(tags).length, 35, 'every book gets a tag');
  eq(new Set(Object.keys(tags).map(function (k) { return tags[k]; })).size, 35, 'all 35 tags are unique');
  ok(Object.keys(tags).every(function (k) { return /^#[A-Za-z0-9_]{1,44}$/.test(tags[k]); }),
    'every tag is ASCII and within the length cap');

  return { KC, out, tags };
}

module.exports = { run };
