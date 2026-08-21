// ---
// purpose: Standalone shelf page — cover-card grid, topic chips, auto + manual missing-cover fetch
// exports: nothing (wires itself on DOMContentLoaded)
// depends: js/i18n.js, js/store.js, js/topics.js, js/covers.js
// gotcha: this page has no js/app.js, so it seeds KC.state and a minimal KC.ui.toast itself —
//   js/covers.js reads both. It never touches highlight text; none is cached here.
// ---
(function (KC) {
  'use strict';

  var currentTopic = null;
  var toastTimer = null;

  function byId(id) { return document.getElementById(id); }

  KC.ui = KC.ui || {
    toast: function (msg) {
      var n = byId('toast');
      if (!n) return;
      n.textContent = msg;
      n.hidden = false;
      n.className = 'toast is-on';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { n.className = 'toast'; n.hidden = true; }, 2600);
    }
  };

  function applyStrings() {
    var t = KC.i18n.t, i;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    nodes = document.querySelectorAll('[data-i18n-ph]');
    for (i = 0; i < nodes.length; i++) nodes[i].placeholder = t(nodes[i].getAttribute('data-i18n-ph'));
    document.documentElement.lang = KC.i18n.lang;
  }

  function cardFor(book, lib) {
    var entry = lib[book.key];
    var topic = (entry && entry.topic) || 'uncategorized';
    var hue = KC.topics.hueOf(topic);

    var a = document.createElement('a');
    a.className = 'shelf-card';
    a.href = 'index.html?book=' + encodeURIComponent(book.key);
    a.setAttribute('data-key', book.key);
    a.setAttribute('data-title', book.title);
    a.setAttribute('data-author', book.author);
    a.setAttribute('data-topic', topic);
    if (hue !== null && hue !== undefined) a.style.setProperty('--h', String(hue));
    a.setAttribute('data-search', KC.i18n.fold(book.title + ' ' + book.author));

    var art = document.createElement('div');
    art.className = 'sc-art';
    var img = document.createElement('img');
    img.className = 'sc-cover';
    img.alt = '';
    img.src = (entry && entry.cover) ? entry.cover : KC.covers.placeholder(book.title, book.author, hue);
    art.appendChild(img);
    var spine = document.createElement('span');
    spine.className = 'sc-spine';
    art.appendChild(spine);
    var count = document.createElement('span');
    count.className = 'badge sc-count';
    count.textContent = KC.i18n.num(book.count);
    art.appendChild(count);
    a.appendChild(art);

    var title = document.createElement('p');
    title.className = 'sc-title';
    title.textContent = book.title;
    a.appendChild(title);
    var author = document.createElement('p');
    author.className = 'sc-author';
    author.textContent = book.author;
    a.appendChild(author);
    return a;
  }

  function renderTopics(books, lib) {
    var host = byId('shelf-topics');
    while (host.firstChild) host.removeChild(host.firstChild);

    var counts = {}, anyReal = false, i;
    for (i = 0; i < books.length; i++) {
      var t = (lib[books[i].key] && lib[books[i].key].topic) || 'uncategorized';
      if (t !== 'uncategorized') anyReal = true;
      counts[t] = (counts[t] || 0) + 1;
    }
    host.hidden = !anyReal;
    if (!anyReal) return;

    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'chip';
    all.setAttribute('data-topic', 'all');
    all.setAttribute('aria-pressed', currentTopic === null ? 'true' : 'false');
    all.textContent = KC.i18n.t('topic.all');
    host.appendChild(all);

    for (i = 0; i < KC.topics.list.length; i++) {
      var id = KC.topics.list[i].id;
      if (!counts[id]) continue;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.setAttribute('data-topic', id);
      chip.style.setProperty('--h', String(KC.topics.list[i].h));
      chip.setAttribute('aria-pressed', currentTopic === id ? 'true' : 'false');
      chip.textContent = KC.topics.label(id) + ' (' + KC.i18n.num(counts[id]) + ')';
      host.appendChild(chip);
    }
  }

  // Covers arrive one by one — repaint the affected cards in place instead of rebuilding the grid,
  // which would fight the reader's scroll position while they browse.
  function refreshCovers() {
    var lib = KC.state.lib || {};
    var cards = byId('shelf').querySelectorAll('.shelf-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var entry = lib[card.getAttribute('data-key')];
      if (!entry) continue;
      var topic = entry.topic || 'uncategorized';
      var hue = KC.topics.hueOf(topic);
      card.setAttribute('data-topic', topic);
      if (hue !== null && hue !== undefined) card.style.setProperty('--h', String(hue));
      card.querySelector('.sc-cover').src = entry.cover ||
        KC.covers.placeholder(card.getAttribute('data-title'), card.getAttribute('data-author'), hue);
    }
    renderTopics(KC.state.books, lib);
    filterCards();
  }

  function onProgress(done, total) {
    KC.covers.paintSwitch(done < total ? KC.i18n.t('covers.progress', { done: done, total: total }) : null,
      done < total ? (total ? done / total : 0) : undefined);
    if (done >= total) KC.ui.toast(total ? KC.i18n.t('covers.done', { n: total }) : KC.i18n.t('covers.cached'));
    refreshCovers();
  }

  function render() {
    var books = KC.state.books;
    var lib = KC.state.lib;
    var host = byId('shelf');
    var empty = byId('shelf-empty');
    while (host.firstChild) host.removeChild(host.firstChild);

    if (!books.length) {
      empty.hidden = false;
      empty.textContent = KC.i18n.t('shelf.empty');
      byId('shelf-topics').hidden = true;
      return;
    }
    empty.hidden = true;

    renderTopics(books, lib);

    var sorted = books.slice().sort(function (a, b) {
      return a.title.localeCompare(b.title, KC.i18n.lang, { sensitivity: 'base', numeric: true });
    });
    for (var i = 0; i < sorted.length; i++) host.appendChild(cardFor(sorted[i], lib));
    filterCards();
  }

  function filterCards() {
    var q = KC.i18n.fold(byId('shelf-q').value || '');
    var cards = byId('shelf').querySelectorAll('.shelf-card');
    for (var i = 0; i < cards.length; i++) {
      var matchesQ = !q || cards[i].getAttribute('data-search').indexOf(q) !== -1;
      var matchesTopic = !currentTopic || cards[i].getAttribute('data-topic') === currentTopic;
      cards[i].hidden = !(matchesQ && matchesTopic);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var prefs = KC.store.prefs.get();
    if (prefs.theme) document.documentElement.setAttribute('data-theme', prefs.theme);
    if (prefs.lang) KC.i18n.setLang(prefs.lang);

    KC.state.books = KC.store.books.get();
    KC.state.lib = KC.store.lib.get();
    KC.state.coversOn = !!prefs.coversOn;

    applyStrings();
    render();
    KC.covers.paintSwitch();
    if (KC.state.coversOn) KC.covers.fetchAll(KC.state.books, onProgress);

    byId('shelf-q').addEventListener('input', filterCards);

    byId('fetch-covers').addEventListener('click', function () {
      KC.covers.refetchMissing(KC.state.books, onProgress);
      KC.covers.paintSwitch();
    });

    byId('toggle-covers').addEventListener('click', function () {
      if (KC.state.coversOn) KC.covers.disable();
      else KC.covers.enable(onProgress);
      KC.covers.paintSwitch();
    });

    byId('shelf-topics').addEventListener('click', function (e) {
      var chip = e.target.closest ? e.target.closest('.chip') : null;
      if (!chip) return;
      var topic = chip.getAttribute('data-topic');
      currentTopic = (topic === 'all' || currentTopic === topic) ? null : topic;
      var chips = byId('shelf-topics').querySelectorAll('.chip');
      for (var i = 0; i < chips.length; i++) {
        var ct = chips[i].getAttribute('data-topic');
        chips[i].setAttribute('aria-pressed', (currentTopic === null && ct === 'all') || ct === currentTopic ? 'true' : 'false');
      }
      filterCards();
    });

    byId('toggle-theme').addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      if (!current) {
        current = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      KC.store.prefs.set({ theme: next });
    });
  });
})(window.KC = window.KC || {});
