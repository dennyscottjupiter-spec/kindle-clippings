// ---
// purpose: Assert every export format builds correctly and always carries the hashtag
// exports: run()
// depends: tests/harness.js, tests/fixture-clippings.txt
// ---
'use strict';
const fs = require('fs');
const path = require('path');
const { loadKC, ok, eq, section } = require('./harness');

function prepare(lang) {
  const KC = loadKC(lang);
  const parsed = KC.parse(fs.readFileSync(path.join(__dirname, 'fixture-clippings.txt'), 'utf8'));
  const out = KC.clean.process(parsed);
  const tags = KC.tags.build(out.books);
  out.visible.forEach(function (r) { r.tag = tags[r.bookKey]; });
  return { KC, out, tags };
}

function run() {
  const { KC, out } = prepare('pt-BR');
  const recs = out.visible;

  section('exports — markdown');
  const md = KC.exports.build('md', recs, {});
  eq(md.name, 'kindle-clippings.md', 'default markdown filename');
  ok(md.text.indexOf('---\n') === 0, 'starts with YAML frontmatter');
  ok(/tags:\n(?:\s+- [A-Za-z0-9_]+\n)+/.test(md.text), 'frontmatter lists bare tags');
  ok(md.text.indexOf('#HabitosAtomicos') !== -1, 'the hashtag rides in the attribution line');
  ok(md.text.indexOf('> Ação e reação.') !== -1, 'highlight text is a blockquote');
  ok(md.text.indexOf('> > Minha anotação.') !== -1, 'an attached note is a nested blockquote');
  ok(md.text.indexOf('## Hábitos Atômicos: Um Método Fácil — Clear, James') !== -1,
    'one section per book, title and author');
  ok(recs.every(function (r) { return md.text.indexOf(r.tag) !== -1; }), 'every record contributes its tag');

  section('exports — markdown, single book');
  const one = KC.exports.build('md', recs.filter(function (r) { return /Hábitos/.test(r.title); }),
    { bookTitle: 'Hábitos Atômicos: Um Método Fácil' });
  eq(one.name, 'habitos-atomicos-um-metodo-facil.md', 'single-book filename is an ascii slug');
  ok(one.text.indexOf('Dup Book') === -1, 'it contains only the selected book');

  section('exports — json');
  const json = KC.exports.build('json', recs, {});
  const arr = JSON.parse(json.text);
  eq(arr.length, recs.length, 'one JSON object per record');
  ok(arr.every(function (r) { return typeof r.tag === 'string' && r.tag.charAt(0) === '#'; }), 'every object carries its tag');
  ok(arr.every(function (r) { return !('_cmp' in r) && !('duplicates' in r) && !('bookKey' in r); }),
    'internal fields are not leaked');
  const hosted = arr.filter(function (r) { return r.note; })[0];
  ok(hosted && hosted.note.text === 'Minha anotação.', 'the attached note is projected');

  section('exports — csv');
  const csv = KC.exports.build('csv', recs, {});
  eq(csv.text.charAt(0), '﻿', 'CSV is BOM-prefixed for Excel');
  const firstLine = csv.text.slice(1).split('\r\n')[0];
  ok(firstLine.indexOf(';') !== -1, 'pt-BR uses the semicolon separator');
  eq(firstLine.split(';').length, 9, '9 header columns');
  const nasty = KC.exports.build('csv', [{
    id: 'rX', title: 'A; B', author: 'Say "hi"', authors: [], type: 'highlight', page: '1',
    locStart: 1, locEnd: 2, dateRaw: 'x', dateMs: 0, text: 'line one\nline two', truncated: false,
    note: null, noteMatch: null, bookKey: 'k', tag: '#T'
  }], {});
  const body = nasty.text.slice(1).split('\r\n')[1];
  ok(body.indexOf('"A; B"') !== -1, 'a field containing the separator is quoted');
  ok(body.indexOf('"Say ""hi"""') !== -1, 'an inner double quote is doubled, RFC 4180 style');
  ok(body.indexOf('"line one\nline two"') !== -1, 'a field containing a newline is quoted');
  const csvEn = prepare('en-US');
  csvEn.out.visible.forEach(function (r) { r.tag = csvEn.tags[r.bookKey]; });
  const csv2 = csvEn.KC.exports.build('csv', csvEn.out.visible, {});
  ok(csv2.text.slice(1).split('\r\n')[0].indexOf(',') !== -1, 'English uses the comma separator');

  section('exports — txt and anki');
  const txt = KC.exports.build('txt', recs, {});
  ok(txt.text.indexOf('#HabitosAtomicos') !== -1, 'TXT carries the tag inline');
  const anki = KC.exports.build('anki', recs, {});
  eq(anki.name, 'kindle-anki.tsv', 'anki filename');
  // Every field is quoted, so a row always starts with '"' — a newline inside a field (an attached
  // note on the back) is not followed by one. Split on row starts, not on every newline.
  const all = anki.text.trim().split(/\n(?=["#])/);
  const head = all.slice(0, 5), rows = all.slice(5);
  eq(head.join('|'), '#separator:tab|#html:false|#notetype:Basic|#deck:Kindle|#tags column:3',
    'the five Anki headers open the file, in order');
  ok(rows.every(function (r) { return r.charAt(0) !== '#'; }), 'no header line survives past the head');
  ok(rows.every(function (r) { return r.split('\t').length === 3; }), 'every Anki row has exactly 3 columns');
  ok(rows.every(function (r) { return /^"(?:[^"]|"")*"$/.test(r.split('\t')[0]); }), 'column 1 is a quoted field');
  ok(rows.every(function (r) { return r.split('\t')[2].slice(0, 2) === '"#'; }), 'column 3 is the quoted tag');
  ok(anki.text.indexOf('\r') === -1, 'no stray carriage returns in the TSV');
  const evil = KC.exports.build('anki', [{
    id: 'rY', title: 'T', author: '', type: 'highlight', page: null, locStart: null, locEnd: null,
    dateRaw: '', text: '#hash\tafter tab "quoted"\nsecond line', truncated: false, note: null, tag: '#T'
  }], {}).text.trim().split('\n').slice(5).join('\n');
  eq(evil, '"#hash\tafter tab ""quoted""\nsecond line"\t"T"\t"#T"',
    'a tab, a newline, a leading # and inner quotes all stay inside one quoted field');

  const noted = recs.filter(function (r) { return r.note && r.note.text; });
  ok(noted.length > 0, 'the fixture has at least one highlight with an attached note');
  ok(noted.every(function (r) { return txt.text.indexOf(r.note.text) !== -1; }), 'TXT keeps every attached note');
  ok(noted.every(function (r) { return anki.text.indexOf(r.note.text.replace(/"/g, '""')) !== -1; }),
    'Anki keeps every attached note (on the back of the card)');
  ok(rows.filter(function (r) { return r.indexOf('Nota: ') !== -1; }).every(function (r) {
    return r.split('\t')[1].indexOf('"Nota: ') === 0;
  }), 'the note opens the back field, above the source line');

  section('exports — guards');
  ok(['md', 'json', 'csv', 'txt', 'anki'].every(function (k) {
    try { KC.exports.build(k, [], {}); return true; } catch (e) { return false; }
  }), 'every format survives an empty record list');
  let threw = false;
  try { KC.exports.build('pdf', recs, {}); } catch (e) { threw = true; }
  ok(threw, 'an unknown export kind throws');
  eq(KC.exports.download('x.md', 'body', 'text/markdown'), false,
    'download() is a no-op outside the browser instead of crashing');
}

module.exports = { run };
