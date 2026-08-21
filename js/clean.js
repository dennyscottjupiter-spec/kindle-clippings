// ---
// purpose: Normalize, filter, deduplicate and note-associate parsed Kindle records
// exports: KC.clean.process(), normalizeForDisplay(), normalizeForCompare(), bookKeyOf(), associateNotes()
// depends: js/parser.js (KC.CLIP_LIMIT_RE), js/dedupe.js (KC.dedupe)
// gotcha: normalizeForCompare KEEPS accents — two highlights differing by an accent are different text
// ---
(function (KC) {
  'use strict';

  var ZERO_WIDTH = /[\u00ad\u200b-\u200d\u2060\ufeff]/g;
  var NBSP = /[\u00a0\u202f]/g;
  var SMART_SINGLE = /[\u2018\u2019\u201a\u201b\u2032]/g;
  var SMART_DOUBLE = /[\u201c\u201d\u201e\u201f\u2033]/g;
  var DASHES = /[\u2010-\u2015]/g;

  function normalizeForDisplay(s) {
    if (!s) return '';
    var out = String(s);
    out = out.normalize ? out.normalize('NFC') : out;
    return out.replace(NBSP, ' ')
      .replace(ZERO_WIDTH, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  // Accents survive on purpose; only typography noise is levelled.
  function normalizeForCompare(s) {
    return normalizeForDisplay(s)
      .toLowerCase()
      .replace(SMART_SINGLE, "'")
      .replace(SMART_DOUBLE, '"')
      .replace(DASHES, '-')
      .replace(/…/g, '...')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function bookKeyOf(rec) {
    return normalizeForCompare(rec.title) + '|' + normalizeForCompare(rec.author);
  }

  // Kindle writes a highlight and its note in the same second, which beats any
  // location heuristic. File order is only ever a tie-breaker.
  function associateNotes(highlights, notes) {
    var attached = [], i, j;
    for (i = 0; i < notes.length; i++) {
      var n = notes[i];
      var best = null, bestKind = null, bestDist = Infinity;
      for (j = 0; j < highlights.length; j++) {
        var h = highlights[j];
        if (h.bookKey !== n.bookKey) continue;
        if (n.dateMs && h.dateMs === n.dateMs) { best = h; bestKind = 'time'; break; }
        if (n.locStart === null || h.locStart === null) continue;
        if (n.locStart >= h.locStart && n.locStart <= h.locEnd) {
          if (bestKind !== 'exact') { best = h; bestKind = 'exact'; bestDist = 0; }
          continue;
        }
        if (bestKind === 'exact') continue;
        var d = Math.min(Math.abs(n.locStart - h.locStart), Math.abs(n.locStart - h.locEnd));
        if (d <= 10 && d < bestDist) { best = h; bestKind = 'near'; bestDist = d; }
      }
      if (!best) { n.noteMatch = 'none'; continue; }
      n.noteMatch = bestKind;
      best.note = n;
      best.noteMatch = bestKind;
      attached.push(n);
    }
    return attached;
  }

  function hide(list, rec, reason) {
    rec.hiddenReason = reason;
    list.push(rec);
  }

  KC.clean = {
    normalizeForDisplay: normalizeForDisplay,
    normalizeForCompare: normalizeForCompare,
    bookKeyOf: bookKeyOf,
    associateNotes: associateNotes,

    process: function (input) {
      var records = input && input.records ? input.records : (input || []);
      var unparsed = input && input.unparsed ? input.unparsed : 0;
      var hidden = [], highlights = [], notes = [], others = [];
      var clipLimitDropped = 0, emptyBookmarks = 0, truncated = 0;
      var i;

      for (i = 0; i < records.length; i++) {
        var rec = records[i];
        rec.text = normalizeForDisplay(rec.text);
        rec.truncated = false;
        rec.note = null;
        rec.noteMatch = null;
        rec.hiddenReason = null;
        rec.bookKey = bookKeyOf(rec);

        if (rec.deviceFooter) { hide(hidden, rec, 'device'); continue; }

        if (rec.clipLimit) {
          // The sentinel is glued onto real truncated text: keep the surviving prefix.
          rec.text = normalizeForDisplay(rec.text.replace(KC.CLIP_LIMIT_RE, ''));
          if (!rec.text) { clipLimitDropped++; hide(hidden, rec, 'clipLimit'); continue; }
          rec.truncated = true;
          truncated++;
        }

        if (rec.type === 'bookmark' && !rec.text) { emptyBookmarks++; hide(hidden, rec, 'bookmark'); continue; }

        rec._cmp = normalizeForCompare(rec.text);
        if (rec.type === 'highlight' || rec.type === 'clipping') highlights.push(rec);
        else if (rec.type === 'note') notes.push(rec);
        else others.push(rec);
      }

      var d = KC.dedupe(highlights);
      for (i = 0; i < d.survivors.length; i++) {
        d.survivors[i]._kept = true;
        d.survivors[i].duplicates = d.duplicatesOf[d.survivors[i].id] || [];
      }
      for (i = 0; i < highlights.length; i++) {
        if (!highlights[i]._kept) hide(hidden, highlights[i], 'duplicate');
      }

      var attached = associateNotes(d.survivors, notes);
      var visible = d.survivors.slice();
      for (i = 0; i < notes.length; i++) {
        if (attached.indexOf(notes[i]) === -1) visible.push(notes[i]);
      }
      visible = visible.concat(others);
      visible.sort(function (a, b) { return a.order - b.order; });

      var books = KC.clean.buildBooks(visible, hidden);
      return {
        visible: visible,
        hidden: hidden,
        books: books,
        stats: {
          records: records.length,
          books: books.length,
          duplicates: d.stats.merged,
          bookmarks: emptyBookmarks,
          clipLimit: clipLimitDropped,
          truncated: truncated,
          unparsed: unparsed,
          dedupe: d.stats
        }
      };
    },

    // Display title is the longest raw variant, so a BOM- or space-mangled line never wins.
    buildBooks: function (visible, hidden) {
      var map = {}, order = [], i, k;
      function bump(rec, isHidden) {
        if (rec.deviceFooter) return;
        k = rec.bookKey;
        if (!map[k]) {
          map[k] = { key: k, title: rec.title, author: rec.author, authors: rec.authors || [], count: 0, hiddenCount: 0, lastMs: 0 };
          order.push(k);
        }
        if (rec.title.length > map[k].title.length) map[k].title = rec.title;
        if ((rec.author || '').length > (map[k].author || '').length) {
          map[k].author = rec.author;
          map[k].authors = rec.authors || [];
        }
        if (rec.dateMs && rec.dateMs > (map[k].lastMs || 0)) map[k].lastMs = rec.dateMs;
        if (isHidden) map[k].hiddenCount++; else map[k].count++;
      }
      for (i = 0; i < visible.length; i++) bump(visible[i], false);
      for (i = 0; i < hidden.length; i++) bump(hidden[i], true);

      var books = [];
      for (i = 0; i < order.length; i++) books.push(map[order[i]]);
      var lang = (KC.i18n && KC.i18n.lang) || 'pt-BR';
      books.sort(function (a, b) {
        return a.title.localeCompare(b.title, lang, { sensitivity: 'base', numeric: true });
      });
      return books;
    }
  };
})(window.KC = window.KC || {});
