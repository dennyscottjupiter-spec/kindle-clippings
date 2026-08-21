// ---
// purpose: Order the filtered highlight list and stamp each record with its group key
// exports: KC.sort.MODES, KC.sort.apply(records, mode, lib)
// depends: js/i18n.js (locale compare), js/topics.js (topic labels)
// gotcha: grouping is done by SORTING so groups stay contiguous — cards.js only compares neighbours
// ---
(function (KC) {
  'use strict';

  function topicOf(rec, lib) {
    return (lib[rec.bookKey] && lib[rec.bookKey].topic) || 'uncategorized';
  }

  KC.sort = {
    MODES: ['order', 'dateDesc', 'dateAsc', 'book', 'topic'],

    apply: function (records, mode, lib) {
      lib = lib || {};
      var out = records.slice(), lang = KC.i18n.lang;
      function byTitle(a, b) { return a.title.localeCompare(b.title, lang, { sensitivity: 'base', numeric: true }); }

      if (mode === 'dateDesc') {
        out.sort(function (a, b) { return (b.dateMs || 0) - (a.dateMs || 0) || a.order - b.order; });
      } else if (mode === 'dateAsc') {
        out.sort(function (a, b) { return (a.dateMs || 0) - (b.dateMs || 0) || a.order - b.order; });
      } else if (mode === 'book') {
        out.sort(function (a, b) { return byTitle(a, b) || a.order - b.order; });
      } else if (mode === 'topic') {
        out.sort(function (a, b) {
          var ta = topicOf(a, lib), tb = topicOf(b, lib);
          if (ta !== tb) {
            if (ta === 'uncategorized') return 1;
            if (tb === 'uncategorized') return -1;
            return KC.topics.byId[ta].i - KC.topics.byId[tb].i;
          }
          return byTitle(a, b) || a.order - b.order;
        });
      } else {
        out.sort(function (a, b) { return a.order - b.order; });
      }

      for (var i = 0; i < out.length; i++) {
        out[i]._group = mode === 'book' ? out[i].bookKey
          : mode === 'topic' ? topicOf(out[i], lib)
          : null;
      }
      return out;
    }
  };
})(window.KC = window.KC || {});
