// ---
// purpose: Accent-folded, token-based search over highlight text, book, author and attached note
// exports: KC.search.index(records), KC.search.filter(records, query), KC.search.match(rec, tokens)
// depends: js/i18n.js (fold)
// gotcha: tokens are AND-ed, not substring-matched — "cartas estoico" must find "Cartas de um Estoico"
// ---
(function (KC) {
  'use strict';

  function blobOf(rec) {
    var parts = [rec.text, rec.title, rec.author, rec.tag || ''];
    if (rec.note && rec.note.text) parts.push(rec.note.text);
    if (rec.duplicates) {
      for (var i = 0; i < rec.duplicates.length; i++) parts.push(rec.duplicates[i].text);
    }
    return KC.i18n.fold(parts.join(' \n '));
  }

  KC.search = {
    // Blobs are built once at load — hidden duplicates included, so revealing them
    // never needs a re-index.
    index: function (records) {
      for (var i = 0; i < records.length; i++) records[i]._blob = blobOf(records[i]);
      return records;
    },

    tokens: function (query) {
      var t = KC.i18n.fold(String(query || '')).split(/\s+/), out = [];
      for (var i = 0; i < t.length; i++) if (t[i]) out.push(t[i]);
      return out;
    },

    match: function (rec, tokens) {
      var blob = rec._blob || blobOf(rec);
      for (var i = 0; i < tokens.length; i++) {
        if (blob.indexOf(tokens[i]) === -1) return false;
      }
      return true;
    },

    filter: function (records, query) {
      var tokens = KC.search.tokens(query);
      if (!tokens.length) return records.slice();
      var out = [];
      for (var i = 0; i < records.length; i++) {
        if (KC.search.match(records[i], tokens)) out.push(records[i]);
      }
      return out;
    }
  };
})(window.KC = window.KC || {});
