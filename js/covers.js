// ---
// purpose: Opt-in Open Library cover + subject fetch, sequential throttled queue, SVG placeholders
// exports: KC.covers.isOn/enable/disable/fetchAll/entry/placeholder
// depends: js/topics.js (classify), js/store.js (lib cache), js/state.js (coversOn), js/i18n.js
// gotcha: nothing fetches until the user opts in — isOn() gates every network call
// ---
(function (KC) {
  'use strict';

  var GAP_MS = 260;
  var COVER_MAX_BYTES = 120000;
  var queue = [], running = false, failStreak = 0;

  function cleanTitle(title) {
    var t = String(title || '')
      .replace(/\s*\([^()]*\)/g, '')
      .replace(/\s+-\s+[^-]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return encodeURIComponent(t);
  }

  function cleanAuthor(author) {
    var a = String(author || '').split(';')[0].trim();
    if (!a) return '';
    if (a.indexOf(',') !== -1) {
      var parts = a.split(',');
      a = (parts[1] || '').trim() + ' ' + parts[0].trim();
      a = a.trim();
    }
    return encodeURIComponent(a);
  }

  function searchUrl(book) {
    var t = cleanTitle(book.title);
    var a = cleanAuthor(book.author);
    var base = 'https://openlibrary.org/search.json?limit=1&fields=key,title,author_name,cover_i,subject';
    if (a) return base + '&title=' + t + '&author=' + a;
    return base + '&q=' + t;
  }

  function coverToDataUrl(coverId) {
    if (!coverId) return Promise.resolve(null);
    var url = 'https://covers.openlibrary.org/b/id/' + coverId + '-M.jpg';
    return fetch(url).then(function (r) { return r.ok ? r.blob() : null; })
      .then(function (blob) {
        if (!blob || blob.size > COVER_MAX_BYTES) return url;
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { res(String(fr.result)); };
          fr.onerror = function () { res(url); };
          fr.readAsDataURL(blob);
        });
      })
      .catch(function () { return url; });
  }

  function fetchOne(book) {
    return fetch(searchUrl(book)).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (json) {
      var doc = json && json.docs && json.docs[0];
      if (!doc) return { miss: true, ts: Date.now() };
      var topic = KC.topics.classify(doc.subject);
      return coverToDataUrl(doc.cover_i).then(function (cover) {
        return {
          olKey: doc.key || null,
          cover: cover || null,
          topic: topic,
          subjects: (doc.subject || []).slice(0, 3),
          miss: false,
          ts: Date.now()
        };
      });
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
      if (lib[book.key]) { done++; setTimeout(step, 0); return; }
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
        if (failStreak >= 3) {
          queue.length = 0;
          running = false;
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

  KC.covers = {
    isOn: function () { return !!KC.state.coversOn; },

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
        if (!lib[books[i].key]) queue.push(books[i]);
      }
      failStreak = 0;
      runQueue(onProgress);
    },

    entry: function (bookKey) {
      var lib = KC.state.lib || {};
      return lib[bookKey] || null;
    },

    placeholder: placeholder
  };
})(window.KC = window.KC || {});
