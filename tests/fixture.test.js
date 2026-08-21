// ---
// purpose: Assert parser/clean/dedupe/tags behaviour against the synthetic edge-case fixture
// exports: run()
// depends: tests/harness.js, tests/fixture-clippings.txt
// ---
'use strict';
const fs = require('fs');
const path = require('path');
const { loadKC, ok, eq, section } = require('./harness');

function byBook(books, needle) {
  return books.filter(function (b) { return b.title.indexOf(needle) !== -1; })[0];
}

function run() {
  const KC = loadKC('pt-BR');
  const text = fs.readFileSync(path.join(__dirname, 'fixture-clippings.txt'), 'utf8');
  const parsed = KC.parse(text);
  const out = KC.clean.process(parsed);
  const tags = KC.tags.build(out.books);

  section('parser — structure');
  eq(parsed.records.length, 19, '19 records parsed');
  eq(parsed.unparsed, 0, '0 unparsed blocks');
  ok(parsed.records.every(function (r) { return r.title.indexOf('﻿') === -1; }), 'no U+FEFF survives in any title');
  ok(parsed.records.every(function (r) { return r.dateRaw !== ''; }), 'every record keeps its raw date string');
  eq(parsed.records.filter(function (r) { return r.dateMs === null; }).length, 1,
    'only the unknown-locale record fails to resolve to a timestamp');

  section('parser — title and author');
  eq(parsed.records[0].author, 'Hessel, Stéphane', 'author is the LAST balanced paren group');
  eq(parsed.records[0].title, 'Test Book (Ceux qui restent) (French Edition)', 'inner paren groups stay in the title');
  eq(parsed.records[1].title, 'Authorless Paper 1234.5678v1', 'author-less title is trimmed');
  eq(parsed.records[1].author, '', 'author-less document has no author');

  section('parser — locales');
  eq(parsed.records[3].type, 'highlight', 'pt-BR "Seu destaque" is a highlight');
  eq(parsed.records[3].page, '27', 'pt-BR "página 27"');
  eq(parsed.records[3].locStart, 412, 'pt-BR "posição 412-414" start');
  eq(parsed.records[3].locEnd, 414, 'pt-BR "posição 412-414" end');
  eq(parsed.records[4].type, 'bookmark', 'pt-BR "Seu marcador" is a bookmark');
  eq(parsed.records[5].type, 'note', 'pt-BR "Sua nota" is a note');
  eq(parsed.records[2].locStart, 20, '"at location 20-24" lower-case variant');
  eq(parsed.records[15].locStart, 55, 'unknown locale falls back to the numeric run');
  eq(parsed.records[15].locEnd, 57, 'unknown locale range end');
  eq(parsed.records[15].type, 'unknown', 'unknown locale keyword is not guessed');
  ok(parsed.records[15].dateRaw.indexOf('2015') !== -1, 'unknown locale still keeps the raw date text');
  ok(parsed.records[14].dateMs > 0, '12-hour US date with PM parses');

  section('clean — normalization');
  const habit = out.visible.filter(function (r) { return r.locStart === 412; })[0];
  eq(habit.text, 'Ação e reação.', 'NFD combining marks normalize to NFC');
  const frog = out.visible.filter(function (r) { return r.locStart === 900; })[0];
  eq(frog.text, 'He said “do it now” and softhyphen and zerowidth.',
    'NBSP -> space, soft hyphen and ZWSP stripped, smart quotes preserved');

  section('clean — BOM regression');
  const paper = byBook(out.books, 'Authorless Paper');
  ok(!!paper, 'the author-less paper is a book');
  eq(paper.count, 2, 'mid-file BOM does not split one book into two');

  section('clean — clipping limit');
  const trunc = out.visible.filter(function (r) { return r.truncated; });
  eq(trunc.length, 1, 'exactly one record kept as truncated');
  ok(trunc[0].text.indexOf('clipping limit') === -1, 'the sentinel is stripped from the kept text');
  ok(trunc[0].text.indexOf('the same is tru') !== -1, 'the surviving prefix is kept as real content');
  eq(out.stats.clipLimit, 1, 'the standalone sentinel record is hidden, not kept');

  section('clean — filtering and dedup');
  eq(out.stats.bookmarks, 2, 'both empty bookmarks are hidden');
  eq(out.stats.duplicates, 4, '4 records absorbed as duplicates');
  eq(out.stats.dedupe.exactPairs, 1, 'one exact duplicate pair detected');
  eq(out.visible.length, 10, '10 visible records');
  eq(out.hidden.length, 8, '8 hidden records');
  eq(out.stats.books, 8, '8 books, device footer excluded');
  ok(!out.books.some(function (b) { return /Your Clippings/i.test(b.title); }), 'the device footer is not a book');

  section('clean — union-find transitivity');
  const chain = out.visible.filter(function (r) { return r.locStart === 30; });
  eq(chain.length, 1, 'A subset B subset C collapses to ONE survivor');
  eq(chain[0].text, 'The quick brown fox jumps over the lazy dog.', 'the longest text survives');
  eq(chain[0].duplicates.length, 2, 'both absorbed variants stay recoverable');

  section('clean — overlap without containment');
  const overlap = out.visible.filter(function (r) { return r.locStart === 200 || r.locStart === 208; });
  eq(overlap.length, 1, 'overlapping locations land in one component');
  eq(overlap[0].locStart, 208, 'the longer of two different sentences survives');

  section('clean — note association');
  eq(habit.noteMatch, 'time', 'the note matches its highlight on an identical timestamp');
  ok(habit.note && habit.note.text === 'Minha anotação.', 'the note text is attached to the highlight');
  ok(!out.visible.some(function (r) { return r.type === 'note'; }), 'an attached note does not also render as its own card');

  section('i18n');
  eq(KC.i18n.fold('ação'), KC.i18n.fold('acao'), 'accent folding makes acao find ação');
  eq(KC.i18n.lang, 'pt-BR', 'navigator.language pt-BR selects the Portuguese catalog');
  ok(KC.i18n.t('sidebar.all').length > 0, 'the catalog resolves a key');
  const en = loadKC('en-US');
  eq(en.i18n.lang, 'en', 'navigator.language en-US selects the English catalog');
  eq(loadKC('de-DE').i18n.lang, 'pt-BR', 'an unknown language falls back to pt-BR');

  section('tags');
  const habitBook = byBook(out.books, 'Hábitos');
  eq(tags[habitBook.key], '#HabitosAtomicos', 'subtitle dropped, accents stripped, PascalCase');
  const values = Object.keys(tags).map(function (k) { return tags[k]; });
  eq(values.length, new Set(values).size, 'every book gets a unique tag');
  ok(values.every(function (t) { return /^#[A-Za-z0-9_]+$/.test(t); }), 'every tag is Obsidian-safe ASCII');

  return { KC, out, tags };
}

module.exports = { run };
