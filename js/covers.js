// ---
// purpose: Opt-in Open Library cover + subject fetch, sequential throttled queue, SVG placeholders
// exports: KC.covers.isOn/paintSwitch/enable/disable/fetchAll/refetchMissing/entry/placeholder
// depends: js/topics.js (classify), js/store.js (lib cache), js/i18n.js; KC.state.coversOn/lib
// gotcha: only the cover URL is cached, never the image bytes — data URLs blew the localStorage quota
//   after ~40 books, which silently killed the cache and stalled the whole queue. Candidates are
//   title-checked before they are believed: doc[0] is routinely the wrong book.
// ---
(function (KC) {
  'use strict';

  // shelf.html loads this module without js/app.js, so KC.state may not exist yet.
  KC.state = KC.state || { coversOn: false, books: [], lib: {} };

  var GAP_MS = 260;
  var MAX_FAILS = 5;
  var MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var queue = [], running = false, failStreak = 0;

  // A miss is cached so a bad run does not re-hammer Open Library, but caching it forever is what
  // made every later run report "0 covers loaded": the queue found an entry for every book and
  // skipped them all. Misses expire; real hits stay cached.
  function isFresh(entry) {
    if (!entry) return false;
    if (!entry.miss) return true;
    return typeof entry.ts === 'number' && (Date.now() - entry.ts) < MISS_TTL_MS;
  }

  function cleanTitle(title) {
    var t = String(title || '').trim();
    // Sideloaded files keep their slug filename ("rapido-e-devagar-...-pt") — spell it back out.
    if (t.indexOf(' ') === -1 && t.indexOf('-') !== -1) {
      t = t.replace(/-(pt|en|es|br|fr|de)$/i, '').replace(/-/g, ' ');
    }
    return t
      .replace(/\s*\([^()]*\)/g, '')
      .replace(/\s+-\s+[^-]+$/, '')
      .replace(/,?\s+(volume|vol\.?|tomo|livro)\s+[ivxlcdm\d]+$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanAuthor(author) {
    var a = String(author || '').split(';')[0].trim();
    if (a.indexOf(',') !== -1) {
      var parts = a.split(',');
      a = ((parts[1] || '').trim() + ' ' + parts[0].trim()).trim();
    }
    return a;
  }

  // A Kindle library is full of PDFs and saved web pages. Open Library has none of them, and asking
  // anyway is what produced nonsense matches (a forum thread classified from a treaty record).
  function looksLikeBook(title, author) {
    var t = cleanTitle(title);
    if (t.length < 3) return false;
    if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(t)) return false;                    // arXiv identifier
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return false;                         // dated download
    if (/\.(pdf|epub|mobi|docx?|html?|txt)$/i.test(t)) return false;
    if (/^(www\.|https?:)|\.(com|org|net|io|ai|dev|gov|edu|br)(\/|$)/i.test(author)) return false;
    return true;
  }

  // Accepting doc[0] blindly is how a wrong book supplies the topic — the candidate has to actually
  // look like the book we asked for, and a candidate that carries subjects beats one that doesn't.
  function titleMatches(query, candidate) {
    var q = KC.i18n.fold(query), c = KC.i18n.fold(candidate || '');
    if (!c) return false;
    if (c.indexOf(q) !== -1 || q.indexOf(c) !== -1) return true;
    var words = q.split(/[^a-z0-9]+/).filter(function (w) { return w.length > 3; });
    if (!words.length) return false;
    var hits = 0;
    for (var i = 0; i < words.length; i++) if (c.indexOf(words[i]) !== -1) hits++;
    return hits / words.length >= 0.6;
  }

  function pickDoc(docs, title) {
    var best = null;
    for (var i = 0; i < (docs || []).length; i++) {
      var d = docs[i];
      if (!titleMatches(title, d.title)) continue;
      if (d.subject && d.subject.length) return d;
      if (!best) best = d;
    }
    return best;
  }

  var SEARCH = 'https://openlibrary.org/search.json?limit=5&fields=key,title,author_name,cover_i,subject';

  function wait(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  function ask(url, title) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (json) {
      return pickDoc(json && json.docs, title);
    });
  }

  function fetchOne(book) {
    var t = cleanTitle(book.title);
    var a = cleanAuthor(book.author);
    if (!looksLikeBook(book.title, book.author)) return Promise.resolve({ miss: true, ts: Date.now() });

    var first = a ? SEARCH + '&title=' + encodeURIComponent(t) + '&author=' + encodeURIComponent(a)
                  : SEARCH + '&q=' + encodeURIComponent(t);

    return ask(first, t).then(function (doc) {
      // Kindle author strings are often annotated, reversed or plain wrong — one looser title-only
      // retry recovers most of the misses the strict title+author query produces.
      if ((doc && doc.subject && doc.subject.length) || !a) return doc;
      return wait(GAP_MS).then(function () {
        return ask(SEARCH + '&q=' + encodeURIComponent(t), t).then(function (loose) {
          return (loose && loose.subject && loose.subject.length) ? loose : (doc || loose);
        });
      });
    }).then(function (doc) {
      if (!doc) return { miss: true, ts: Date.now() };
      return {
        olKey: doc.key || null,
        cover: doc.cover_i ? 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-M.jpg' : null,
        topic: KC.topics.classify(doc.subject),
        subjects: (doc.subject || []).slice(0, 3),
        miss: false,
        ts: Date.now()
      };
    });
  }

  function runQueue(onProgress) {
    if (running) return;
    running = true;
    var lib = KC.store.lib.get();
    var total = queue.length, done = 0;

    function step() {
      if (!queue.length || !KC.state.coversOn) { running = false; if (onProgress) onProgress(done, total); return; }
      var book = queue.shift();
      if (isFresh(lib[book.key])) { done++; setTimeout(step, 0); return; }
      fetchOne(book).then(function (entry) {
        failStreak = 0;
        lib[book.key] = entry;
        KC.store.lib.set(lib);
        done++;
        if (onProgress && (done % 5 === 0 || !queue.length)) onProgress(done, total);
        if (KC.state.lib) KC.state.lib[book.key] = entry;
        setTimeout(step, GAP_MS);
      }).catch(function () {
        failStreak++;
        done++;
        if (failStreak >= MAX_FAILS) {
          queue.length = 0;
          running = false;
          if (onProgress) onProgress(done, total);
          if (typeof KC.ui !== 'undefined' && KC.ui.toast) KC.ui.toast(KC.i18n.t('covers.failed'));
          return;
        }
        setTimeout(step, GAP_MS);
      });
    }
    step();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function wrap(text, maxChars, maxLines) {
    var words = text.split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length && lines.length < maxLines; i++) {
      var w = words[i];
      var trial = cur ? cur + ' ' + w : w;
      if (trial.length > maxChars) {
        if (cur) lines.push(cur);
        cur = w.length > maxChars ? w.slice(0, maxChars - 1) + '…' : w;
      } else {
        cur = trial;
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines && (words.join(' ').length > lines.join(' ').length)) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/…?$/, '…');
    }
    return lines;
  }

  function shortAuthor(author) {
    var a = String(author || '').split(';')[0].trim();
    if (a.indexOf(',') !== -1) {
      var parts = a.split(',');
      a = (parts[1] || '').trim() + ' ' + parts[0].trim();
    }
    a = a.trim();
    return a.length > 22 ? a.slice(0, 21) + '…' : a;
  }

  function placeholder(title, author, hue) {
    var h = (hue === null || hue === undefined) ? 220 : hue;
    var lines = wrap(String(title || ''), 16, 4);
    var tspans = '';
    for (var i = 0; i < lines.length; i++) {
      tspans += '<tspan x="24" dy="' + (i === 0 ? 0 : 30) + '">' + esc(lines[i]) + '</tspan>';
    }
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ',62%,42%)"/>' +
      '<stop offset="1" stop-color="hsl(' + ((h + 28) % 360) + ',70%,26%)"/>' +
      '</linearGradient></defs>' +
      '<rect width="240" height="360" fill="url(#g)"/>' +
      '<rect width="10" height="360" fill="rgba(0,0,0,.28)"/>' +
      '<text x="24" y="120" fill="#fff" font-family="Georgia,serif" font-size="26">' + tspans + '</text>' +
      '<text x="24" y="330" fill="rgba(255,255,255,.72)" font-family="monospace" ' +
      'font-size="13" letter-spacing="1.5">' + esc(shortAuthor(author)) + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Both pages carry the same switch markup, so the painting lives here rather than twice in the UI.
  function paintSwitch(progressText, pct) {
    var btn = document.getElementById('toggle-covers');
    if (!btn) return;
    btn.setAttribute('aria-checked', KC.state.coversOn ? 'true' : 'false');
    var label = btn.querySelector('.sw-text');
    if (label) label.textContent = progressText || KC.i18n.t('switch.covers');

    var ring = document.getElementById('covers-ring');
    var fill = document.getElementById('covers-ring-fill');
    if (!ring || !fill) return;
    if (typeof pct !== 'number') { ring.setAttribute('hidden', ''); return; }
    ring.removeAttribute('hidden');
    var C = 2 * Math.PI * 8;
    fill.style.strokeDasharray = String(C);
    fill.style.strokeDashoffset = String(C * (1 - pct));
  }

  KC.covers = {
    isOn: function () { return !!KC.state.coversOn; },
    paintSwitch: paintSwitch,

    enable: function (onProgress) {
      KC.state.coversOn = true;
      KC.store.prefs.set({ coversOn: true });
      var prefs = KC.store.prefs.get();
      if (!prefs.coversAck) {
        KC.store.prefs.set({ coversAck: true });
        if (KC.ui && KC.ui.toast) KC.ui.toast(KC.i18n.t('covers.privacy'));
      }
      KC.covers.fetchAll(KC.state.books, onProgress);
    },

    disable: function () {
      KC.state.coversOn = false;
      KC.store.prefs.set({ coversOn: false });
      queue.length = 0;
      running = false;
    },

    fetchAll: function (books, onProgress) {
      if (!KC.state.coversOn) return;
      var lib = KC.store.lib.get();
      queue = [];
      for (var i = 0; i < books.length; i++) {
        if (!isFresh(lib[books[i].key])) queue.push(books[i]);
      }
      failStreak = 0;
      runQueue(onProgress);
    },

    // Manual "download thumbnails": forget every cached entry that produced no image (a miss, or a
    // match whose Open Library record carried no cover_i) and ask again. Books that already have a
    // cover are left alone, so this is cheap to press twice and never re-downloads what worked.
    refetchMissing: function (books, onProgress) {
      if (!KC.state.coversOn) {
        KC.state.coversOn = true;
        KC.store.prefs.set({ coversOn: true });
        if (!KC.store.prefs.get().coversAck) {
          KC.store.prefs.set({ coversAck: true });
          if (KC.ui && KC.ui.toast) KC.ui.toast(KC.i18n.t('covers.privacy'));
        }
      }
      var lib = KC.store.lib.get();
      for (var i = 0; i < books.length; i++) {
        var e = lib[books[i].key];
        if (e && !e.cover) {
          delete lib[books[i].key];
          if (KC.state.lib) delete KC.state.lib[books[i].key];
        }
      }
      KC.store.lib.set(lib);
      KC.covers.fetchAll(books, onProgress);
    },

    entry: function (bookKey) {
      var lib = KC.state.lib || {};
      return lib[bookKey] || null;
    },

    placeholder: placeholder
  };
})(window.KC = window.KC || {});
