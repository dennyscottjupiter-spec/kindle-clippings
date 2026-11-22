// ---
// purpose: Build Markdown / JSON / CSV / TXT / Anki exports and hand them to the browser
// exports: KC.exports.build(kind, records, ctx), KC.exports.download(), KC.exports.run()
// depends: js/i18n.js (labels follow the UI language; the hashtag never does)
// gotcha: pt-BR CSV uses ';' — that is what Brazilian Excel expects; the Anki TSV opens with
//   '#'-headers that MUST stay the first lines, and every Anki field is quoted (see ankiField)
// ---
(function (KC) {
  'use strict';
  function L(k, fb) { return (KC.i18n && KC.i18n.t) ? KC.i18n.t(k) : fb; }

  function stripDiacritics(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 0x0300 || c > 0x036f) { out += s.charAt(i); } }
    return out;
  }

  function slugify(s) {
    var out = stripDiacritics(String(s).normalize('NFD'));
    out = out.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (out.length > 60) { out = out.slice(0, 60).replace(/-+$/, ''); }
    return out || 'book';
  }

  function locRange(rec, dash) {
    if (rec.locStart === null || rec.locStart === undefined) { return ''; }
    return rec.locStart === rec.locEnd ? String(rec.locStart) : (rec.locStart + dash + rec.locEnd);
  }

  function pageLocParts(rec) {
    var parts = [];
    if (rec.page) { parts.push(KC.i18n && KC.i18n.t ? KC.i18n.t('meta.page', { n: rec.page }) : ('p. ' + rec.page)); }
    var range = locRange(rec, '–');
    if (range) { parts.push(KC.i18n && KC.i18n.t ? KC.i18n.t('meta.loc', { range: range }) : ('loc. ' + range)); }
    return parts;
  }

  function attrParts(rec) {
    var parts = pageLocParts(rec).concat([rec.tag]);
    if (rec.truncated) { parts.push(L('card.truncated', 'truncated')); }
    return parts;
  }

  function toBlockquote(text, prefix) {
    var lines = String(text).split(/\r\n|\r|\n/), out = [];
    for (var i = 0; i < lines.length; i++) { out.push(lines[i] === '' ? prefix.replace(/ +$/, '') : prefix + lines[i]); }
    return out.join('\n');
  }

  function recordBlockMd(rec) {
    var out = [toBlockquote(rec.text, '> '), '>', '> — ' + attrParts(rec).join(' · ')];
    if (rec.note) { out.push(''); out.push(toBlockquote(rec.note.text, '> > ')); }
    return out.join('\n');
  }

  function buildMd(records, bookTitle) {
    var tagSet = {}, tags = [], i;
    for (i = 0; i < records.length; i++) {
      var tg = records[i].tag.replace(/^#/, '');
      if (!tagSet[tg]) { tagSet[tg] = true; tags.push(tg); }
    }
    tags.sort();
    var head = ['---',
      'title: "' + (L('ex.title', 'My highlights') + ' — ' + (bookTitle || L('ex.allBooks', 'All books'))).replace(/"/g, '\\"') + '"',
      'exported: ' + new Date().toISOString(), 'tags:'];
    for (i = 0; i < tags.length; i++) { head.push('  - ' + tags[i]); }
    head.push('---', '');

    var order = [], groups = {};
    for (i = 0; i < records.length; i++) {
      var rec = records[i], key = rec.bookKey;
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(rec);
    }
    var body = [];
    for (i = 0; i < order.length; i++) {
      var recs = groups[order[i]], first = recs[0], blocks = [];
      body.push('## ' + first.title + (first.author ? ' — ' + first.author : ''), '');
      for (var r = 0; r < recs.length; r++) { blocks.push(recordBlockMd(recs[r])); }
      body.push(blocks.join('\n\n'), '');
    }
    return (head.join('\n') + '\n' + body.join('\n')).replace(/\s+$/, '') + '\n';
  }

  function buildJson(records) {
    var out = [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      out.push({
        id: r.id, title: r.title, author: r.author, authors: r.authors, type: r.type,
        page: r.page, locStart: r.locStart, locEnd: r.locEnd, dateRaw: r.dateRaw, dateMs: r.dateMs,
        text: r.text, truncated: r.truncated, tag: r.tag,
        note: r.note ? { text: r.note.text, dateRaw: r.note.dateRaw, match: r.noteMatch } : null
      });
    }
    return JSON.stringify(out, null, 2);
  }

  function csvEscape(v, sep) {
    var s = (v === null || v === undefined) ? '' : String(v);
    if (s.indexOf(sep) !== -1 || s.indexOf('"') !== -1 || s.indexOf('\r') !== -1 || s.indexOf('\n') !== -1) { s = '"' + s.replace(/"/g, '""') + '"'; }
    return s;
  }

  function buildCsv(records) {
    var lang = (KC.i18n && KC.i18n.lang) || '', sep = lang.indexOf('pt') === 0 ? ';' : ',';
    var rows = [[L('ex.book', 'Book'), L('ex.author', 'Author'), L('ex.type', 'Type'), L('ex.page', 'Page'),
      L('ex.loc', 'Location'), L('ex.date', 'Date'), L('ex.text', 'Text'), L('ex.note', 'Note'), L('ex.tag', 'Tag')]];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      rows.push([r.title, r.author, L('type.' + r.type, r.type), r.page || '', locRange(r, '-'),
        r.dateRaw || '', r.text || '', r.note ? r.note.text : '', r.tag]);
    }
    var lines = [];
    for (var j = 0; j < rows.length; j++) {
      var cells = [];
      for (var c = 0; c < rows[j].length; c++) { cells.push(csvEscape(rows[j][c], sep)); }
      lines.push(cells.join(sep));
    }
    return String.fromCharCode(0xFEFF) + lines.join('\r\n') + '\r\n';
  }

  function buildTxt(records) {
    var dash = '----------------------------------------', blocks = [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i], titleLine = r.title + (r.author ? ' — ' + r.author : ''), parts = attrParts(r);
      var full = '  ' + titleLine + (parts.length ? ' · ' + parts.join(' · ') : '');
      var note = r.note && r.note.text ? '\n\n' + L('card.noteLabel', 'Note:') + ' ' + r.note.text : '';
      blocks.push(r.text + note + '\n\n' + full + '\n\n' + dash);
    }
    return blocks.join('\n\n') + '\n';
  }

  // Anki's reader skips any line starting with '#' and treats a leading '"' as a quote,
  // so EVERY field is quoted and inner quotes doubled — an unquoted highlight could
  // silently vanish or shift columns. Newlines stay real: #html:false makes Anki itself
  // escape the text and turn them into <br>, which beats hand-rolling HTML escaping.
  function ankiField(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return '"' + s.replace(/\r\n|\r/g, '\n').replace(/"/g, '""') + '"';
  }

  // No '#columns:' on purpose: named columns are matched against the note type's own
  // field names, so 'Front/Back' would leave the back unmapped on a pt-BR collection.
  // With no names Anki maps the non-meta columns by index, which is what we want.
  var ANKI_HEAD = ['#separator:tab', '#html:false', '#notetype:Basic', '#deck:Kindle', '#tags column:3'];

  function buildAnki(records) {
    var lines = ANKI_HEAD.slice();
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r.text) { continue; }
      var titleLine = r.title + (r.author ? ' — ' + r.author : ''), parts = pageLocParts(r);
      if (r.dateRaw) { parts.push(r.dateRaw); }
      var back = titleLine + (parts.length ? ' · ' + parts.join(' · ') : '');
      // The reader's own note belongs on the back, above the source — it is the point of the card.
      if (r.note && r.note.text) { back = L('card.noteLabel', 'Note:') + ' ' + r.note.text + '\n\n' + back; }
      lines.push(ankiField(r.text) + '\t' + ankiField(back) + '\t' + ankiField(r.tag));
    }
    return lines.join('\n') + '\n';
  }

  var EXT = { md: 'md', json: 'json', csv: 'csv', txt: 'txt', anki: 'tsv' };
  var MIME = {
    md: 'text/markdown;charset=utf-8', json: 'application/json;charset=utf-8',
    csv: 'text/csv;charset=utf-8', txt: 'text/plain;charset=utf-8',
    anki: 'text/tab-separated-values;charset=utf-8'
  };
  var DEFAULT_BASE = { md: 'kindle-clippings', json: 'kindle-clippings', csv: 'kindle-clippings', txt: 'kindle-clippings', anki: 'kindle-anki' };

  function build(kind, records, ctx) {
    records = records || [];
    ctx = ctx || {};
    if (EXT[kind] === undefined) { throw new Error('unknown export kind: ' + kind); }
    var bookTitle = (ctx.bookTitle && String(ctx.bookTitle).trim()) ? String(ctx.bookTitle) : null;
    var text;
    switch (kind) {
      case 'md': text = buildMd(records, bookTitle); break;
      case 'json': text = buildJson(records); break;
      case 'csv': text = buildCsv(records); break;
      case 'txt': text = buildTxt(records); break;
      case 'anki': text = buildAnki(records); break;
    }
    var base = bookTitle ? slugify(bookTitle) : DEFAULT_BASE[kind];
    return { name: base + '.' + EXT[kind], text: text, mime: MIME[kind] };
  }

  function download(name, text, mime) {
    if (typeof document === 'undefined' || typeof Blob === 'undefined') { return false; }
    try {
      var blob = new Blob([text], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  function run(kind, records, ctx) {
    var built = build(kind, records, ctx);
    download(built.name, built.text, built.mime);
    return built;
  }

  KC.exports = { build: build, download: download, run: run };
})(window.KC = window.KC || {});
