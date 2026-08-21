// ---
// purpose: Turn each book into a stable, Obsidian-safe #PascalCase hashtag
// exports: KC.tags.build(books), KC.tags.slug(title)
// gotcha: always accent-stripped ASCII in BOTH UI languages — tag safety beats localisation
// ---
(function (KC) {
  'use strict';

  var MAX = 40;

  function asciiFold(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u0111\u0110]/g, 'd')
      .replace(/\u00df/g, 'ss')
      .replace(/[\u00f8\u00d8]/g, 'o')
      .replace(/[\u00e6\u00c6]/g, 'ae');
  }

  function pascal(s) {
    var words = asciiFold(s).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/);
    var out = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w) continue;
      out += w.charAt(0).toUpperCase() + w.slice(1);
      if (out.length >= MAX) break;
    }
    return out.slice(0, MAX);
  }

  // "Atomic Habits: An Easy Way (2nd ed.)" -> "AtomicHabits"
  function slug(title) {
    var s = String(title || '').split(':')[0];
    s = s.replace(/\s*\([^()]*\)\s*$/, '');
    var t = pascal(s);
    return t || pascal(String(title || '')) || 'Livro';
  }

  // "Devine, Megan" -> Devine · "Mel Robbins;Sawyer Robbins" -> Robbins
  function surname(author) {
    var first = String(author || '').split(';')[0].trim();
    if (!first) return '';
    if (first.indexOf(',') !== -1) return pascal(first.split(',')[0]);
    var parts = first.replace(/\s+/g, ' ').split(' ');
    return pascal(parts[parts.length - 1]);
  }

  function hash3(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36).slice(-3);
  }

  KC.tags = {
    slug: slug,
    surname: surname,

    build: function (books) {
      var taken = {}, byKey = {}, i, base, tag;

      for (i = 0; i < books.length; i++) {
        base = slug(books[i].title);
        tag = base;
        if (taken[tag]) {
          var sn = surname(books[i].author);
          if (sn) tag = (base + '_' + sn).slice(0, MAX);
        }
        if (taken[tag]) tag = (base.slice(0, MAX - 4) + '_' + hash3(books[i].key));
        taken[tag] = true;
        byKey[books[i].key] = '#' + tag;
      }
      return byKey;
    }
  };
})(window.KC = window.KC || {});
