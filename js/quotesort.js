// ---
// purpose: Quote-gallery list pipeline — source pool, book/text filters, five stable sort orders
// exports: KC.quotesort.MODES, pool(), books(), apply()
// depends: js/i18n.js (fold + locale compare), js/favorites.js (starred subset)
// gotcha: pure — never mutates the array it is handed; every sort tie falls back to the incoming index
// ---
(function (KC) {
  'use strict';

  var MODES = ['dateDesc', 'dateAsc', 'book', 'text', 'long'];
  var own = Object.prototype.hasOwnProperty;

  function lang() { return (KC.i18n && KC.i18n.lang) || 'pt-BR'; }

  function byTitle(a, b) {
    return String(a.title || '').localeCompare(String(b.title || ''), lang(), { sensitivity: 'base', numeric: true });
  }

  var CMP = {
    dateDesc: function (a, b) { return (b.dateMs || 0) - (a.dateMs || 0); },
    dateAsc: function (a, b) { return (a.dateMs || 0) - (b.dateMs || 0); },
    book: function (a, b) { return byTitle(a, b) || (a.dateMs || 0) - (b.dateMs || 0); },
    // ignorePunctuation so an opening quote mark does not file every such highlight together
    text: function (a, b) {
      return String(a.text || '').localeCompare(String(b.text || ''), lang(), { sensitivity: 'base', ignorePunctuation: true });
    },
    long: function (a, b) { return String(b.text || '').length - String(a.text || '').length; }
  };

  // Decorate / sort / undecorate: the incoming index is the tiebreak, so equal keys keep their order.
  function stable(list, mode) {
    var cmp = CMP[own.call(CMP, mode) ? mode : 'dateDesc'], deco = [], out = [], i;
    for (i = 0; i < list.length; i++) { deco.push([list[i], i]); }
    deco.sort(function (a, b) { return cmp(a[0], b[0]) || a[1] - b[1]; });
    for (i = 0; i < deco.length; i++) { out.push(deco[i][0]); }
    return out;
  }

  KC.quotesort = {
    MODES: MODES,

    // Every quotable record in the chosen source ('fav' keeps the user's own starred sequence).
    pool: function (records, source) {
      var list = [], all = records || [], i, r;
      for (i = 0; i < all.length; i++) {
        r = all[i];
        if ((r.type === 'highlight' || r.type === 'clipping') && r.text) { list.push(r); }
      }
      return source === 'fav' ? KC.favorites.pick(list) : list;
    },

    // [{ key, title, n }] A→Z — only books that actually have quotes in this pool.
    books: function (pool) {
      var seen = {}, out = [], i, k, title;
      for (i = 0; i < pool.length; i++) {
        k = pool[i].bookKey;
        title = String(pool[i].title || '');
        if (!own.call(seen, k)) {
          seen[k] = { key: k, title: title, n: 0 };
          out.push(seen[k]);
        }
        // the longest raw variant wins, exactly as clean.buildBooks picks a display title
        if (title.length > seen[k].title.length) { seen[k].title = title; }
        seen[k].n++;
      }
      out.sort(byTitle);
      return out;
    },

    apply: function (pool, opts) {
      var list = pool, q;
      if (opts.bookKey && opts.bookKey !== 'all') {
        list = list.filter(function (r) { return r.bookKey === opts.bookKey; });
      }
      if (opts.query) {
        q = KC.i18n.fold(opts.query);
        list = list.filter(function (r) {
          return KC.i18n.fold(r.text + ' ' + r.title).indexOf(q) !== -1;
        });
      }
      return stable(list, opts.mode);
    }
  };
})(window.KC = window.KC || {});
