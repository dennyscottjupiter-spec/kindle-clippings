// ---
// purpose: Build one Obsidian-native Markdown note per book and download them
// exports: KC.obsidian.note(), run(), filename()
// depends: js/i18n.js, js/exports.js, js/tags.js
// gotcha: YAML values must be one line — newlines inside a title would break the frontmatter block
// ---
(function (KC) {
  'use strict';

  function L(k, fb, p) { return (KC.i18n && KC.i18n.t) ? KC.i18n.t(k, p) : fb; }

  function yamlStr(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/\r\n|\r|\n/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();
  }

  function tagSafe(s) {
    var out = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Dataview reads the local calendar date, so never toISOString() here.
  function ymd(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) { return ''; }
    var d = new Date(ms), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function quote(text, prefix) {
    var lines = String(text === null || text === undefined ? '' : text).split(/\r\n|\r|\n/), out = [];
    for (var i = 0; i < lines.length; i++) { out.push(lines[i] === '' ? '>' : prefix + lines[i]); }
    return out.join('\n');
  }

  function filename(book) {
    var s = String((book && book.title) || 'book');
    s = s.replace(/[\\\/:*?"<>|#^\[\]]/g, ' ').replace(/[\x00-\x1f]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length > 80) { s = s.slice(0, 80).trim(); }
    s = s.replace(/\.+$/, '').trim();
    return (s || 'book') + '.md';
  }

  function keep(rec) {
    return !!rec && rec.type !== 'bookmark' && !rec.deviceFooter && !!rec.text;
  }

  function metaLine(rec) {
    var parts = [];
    if (rec.page) { parts.push(L('meta.page', 'p. ' + rec.page, { n: rec.page })); }
    if (rec.locStart !== null && rec.locStart !== undefined) {
      var range = rec.locStart === rec.locEnd ? String(rec.locStart) : (rec.locStart + '–' + rec.locEnd);
      parts.push(L('meta.loc', 'loc. ' + range, { range: range }));
    }
    var d = (KC.i18n && KC.i18n.date) ? KC.i18n.date(rec.dateMs) : '';
    if (d) { parts.push(d); }
    return parts.length ? '<sub>' + parts.join(' · ') + '</sub>' : '';
  }

  function block(rec) {
    var out = [quote(rec.text, '> ')];
    if (rec.truncated) { out.push('', '%%truncated by the clipping limit%%'); }
    if (rec.note && rec.note.text) {
      out.push('', '**' + L('card.noteLabel', 'Note:', null) + '** ' +
        String(rec.note.text).replace(/\r\n|\r|\n/g, ' '));
    }
    var meta = metaLine(rec);
    if (meta) { out.push('', meta); }
    return out.join('\n');
  }

  function frontmatter(book, recs, topic, counts) {
    var tags = ['kindle', 'highlights'];
    if (topic) { tags.push(tagSafe(topic)); }
    var first = null, last = null;
    for (var i = 0; i < recs.length; i++) {
      var ms = recs[i].dateMs;
      if (ms === null || ms === undefined || isNaN(ms)) { continue; }
      if (first === null || ms < first) { first = ms; }
      if (last === null || ms > last) { last = ms; }
    }
    var out = ['---', 'title: "' + yamlStr(book.title) + '"'];
    if (book.author) { out.push('author: "' + yamlStr(book.author) + '"'); }
    out.push('tags: [' + tags.join(', ') + ']');
    out.push('highlights: ' + counts.h, 'notes: ' + counts.n, 'created: ' + ymd(Date.now()));
    if (first !== null) { out.push('first-highlight: ' + ymd(first)); }
    if (last !== null) { out.push('last-highlight: ' + ymd(last)); }
    out.push('source: kindle', '---', '');
    return out;
  }

  function note(book, records, opts) {
    book = book || {};
    opts = opts || {};
    var lib = opts.lib || {};
    var entry = (book.key && lib[book.key]) || null;
    var topic = (entry && entry.topic && entry.topic !== 'uncategorized') ? entry.topic : null;

    var recs = [], i, counts = { h: 0, n: 0 };
    for (i = 0; i < (records || []).length; i++) {
      if (!keep(records[i])) { continue; }
      recs.push(records[i]);
      counts.h++;
      if (records[i].note && records[i].note.text) { counts.n++; }
    }

    var out = frontmatter(book, recs, topic, counts);
    out.push('# ' + book.title);
    if (book.author) { out.push('*' + book.author + '*'); }
    out.push('');

    var summary = L('book.highlights', counts.h + ' highlights', { n: counts.h }) + ' · ' +
      L('obs.notes', counts.n + ' notes', { n: counts.n });
    var tag = book.tag || (recs[0] && recs[0].tag) || '';
    if (opts.callout === false) {
      out.push(summary + (tag ? ' · ' + tag : ''), '');
    } else {
      out.push('> [!abstract] ' + summary);
      if (tag) { out.push('> ' + tag); }
      out.push('');
    }

    out.push('---', '');
    for (i = 0; i < recs.length; i++) { out.push(block(recs[i]), '', '---', ''); }
    return out.join('\n').replace(/\s+$/, '') + '\n';
  }

  function group(records) {
    var order = [], byKey = {};
    for (var i = 0; i < (records || []).length; i++) {
      var rec = records[i];
      if (!keep(rec)) { continue; }
      var key = rec.bookKey;
      if (!byKey[key]) {
        byKey[key] = { book: { key: key, title: rec.title, author: rec.author, tag: rec.tag }, recs: [] };
        order.push(key);
      }
      byKey[key].recs.push(rec);
    }
    var out = [];
    for (i = 0; i < order.length; i++) { out.push(byKey[order[i]]); }
    return out;
  }

  var MIME = 'text/markdown;charset=utf-8';

  function send(name, text) {
    if (KC.exports && KC.exports.download) { return KC.exports.download(name, text, MIME); }
    return false;
  }

  // Browsers throttle a burst of downloads, so the multi-book case is spaced out.
  function run(records, opts) {
    var books = group(records), built = [], i;
    for (i = 0; i < books.length; i++) {
      built.push({ name: filename(books[i].book), text: note(books[i].book, books[i].recs, opts) });
    }
    if (!built.length) { return built; }
    if (built.length === 1) { send(built[0].name, built[0].text); return built; }
    for (i = 0; i < built.length; i++) {
      (function (b, delay) {
        setTimeout(function () { send(b.name, b.text); }, delay);
      })(built[i], i * 300);
    }
    return built;
  }

  KC.obsidian = { note: note, run: run, filename: filename };
})(window.KC = window.KC || {});
