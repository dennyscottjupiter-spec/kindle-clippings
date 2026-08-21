// ---
// purpose: Render the sidebar (sort control, topic chips, book rows) and the drag resizer
// exports: KC.sidebar.render(), KC.sidebar.sortBooks(books, mode), KC.sidebar.installResizer()
// depends: js/i18n.js, js/topics.js, js/covers.js (cached thumb), js/store.js (width pref)
// gotcha: topic-row stays hidden until at least one book resolves to a real topic
// ---
(function (KC) {
  'use strict';

  var MIN_W = 200, MAX_W = 560;

  function byId(id) { return document.getElementById(id); }

  function topicOfBook(book) {
    var entry = KC.state.lib[book.key];
    return (entry && entry.topic) || 'uncategorized';
  }

  function sortBooks(books, mode) {
    var lang = KC.i18n.lang;
    var out = books.slice();
    if (mode === 'count') {
      out.sort(function (a, b) {
        return b.count - a.count || a.title.localeCompare(b.title, lang, { sensitivity: 'base', numeric: true });
      });
    } else if (mode === 'recent') {
      out.sort(function (a, b) {
        return (b.lastMs || 0) - (a.lastMs || 0) || a.title.localeCompare(b.title, lang, { sensitivity: 'base', numeric: true });
      });
    } else {
      out.sort(function (a, b) { return a.title.localeCompare(b.title, lang, { sensitivity: 'base', numeric: true }); });
    }
    return out;
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function renderSideHead(host) {
    var head = el('div', 'side-head');
    var title = el('span', 'side-title');
    title.textContent = KC.i18n.t('sidebar.heading');
    head.appendChild(title);

    var seg = el('div', 'seg');
    seg.id = 'sidebar-sort-seg';
    seg.setAttribute('role', 'group');
    var modes = ['title', 'count', 'recent'];
    for (var i = 0; i < modes.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-sort', modes[i]);
      b.setAttribute('aria-pressed', KC.state.sidebarSort === modes[i] ? 'true' : 'false');
      b.textContent = KC.i18n.t('sidebar.sort.' + modes[i]);
      seg.appendChild(b);
    }
    head.appendChild(seg);
    host.appendChild(head);
  }

  function renderTopicRow(host, books) {
    var row = el('div', 'topic-row');
    row.hidden = true;

    var counts = {}, anyReal = false;
    for (var i = 0; i < books.length; i++) {
      var t = topicOfBook(books[i]);
      if (t !== 'uncategorized') anyReal = true;
      counts[t] = (counts[t] || 0) + 1;
    }

    if (anyReal) {
      row.hidden = false;
      var all = el('button', 'chip');
      all.type = 'button';
      all.setAttribute('data-topic', 'all');
      all.setAttribute('aria-pressed', KC.state.activeTopic === null ? 'true' : 'false');
      all.textContent = KC.i18n.t('topic.all');
      row.appendChild(all);

      for (i = 0; i < KC.topics.list.length; i++) {
        var id = KC.topics.list[i].id;
        if (!counts[id]) continue;
        var chip = el('button', 'chip');
        chip.type = 'button';
        chip.setAttribute('data-topic', id);
        chip.style.setProperty('--h', String(KC.topics.list[i].h));
        chip.setAttribute('aria-pressed', KC.state.activeTopic === id ? 'true' : 'false');
        chip.textContent = KC.topics.label(id) + ' (' + KC.i18n.num(counts[id]) + ')';
        row.appendChild(chip);
      }
    }
    host.appendChild(row);
  }

  function bookRow(key, title, count, topic, hue, thumb) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'book-item' + (KC.state.activeBook === key ? ' is-active' : '') +
      (count === 0 ? ' is-empty' : '') +
      (KC.state.activeTopic && topic !== KC.state.activeTopic ? ' is-off-topic' : '');
    b.setAttribute('data-book', key === null ? '' : key);
    b.setAttribute('data-topic', topic);
    if (hue !== null && hue !== undefined) b.style.setProperty('--h', String(hue));

    b.appendChild(el('span', 'spine'));
    if (thumb) {
      var img = document.createElement('img');
      img.className = 'book-thumb';
      img.alt = '';
      img.src = thumb;
      b.appendChild(img);
    }
    var tt = el('span', 'book-title');
    tt.textContent = title;
    b.appendChild(tt);
    var c = el('span', 'badge');
    c.textContent = KC.i18n.num(count);
    b.appendChild(c);
    return b;
  }

  KC.sidebar = {
    sortBooks: sortBooks,

    render: function () {
      var host = byId('sidebar'), s = KC.state, i;
      while (host.firstChild) host.removeChild(host.firstChild);
      if (!s.books.length) return;

      renderSideHead(host);
      renderTopicRow(host, s.books);

      var list = el('div', 'book-list');
      var total = 0;
      for (i = 0; i < s.books.length; i++) total += s.books[i].count;
      list.appendChild(bookRow(null, KC.i18n.t('sidebar.all'), total, 'uncategorized', null, null));

      var sorted = sortBooks(s.books, s.sidebarSort);
      for (i = 0; i < sorted.length; i++) {
        var book = sorted[i];
        var entry = KC.state.lib[book.key];
        var topic = (entry && entry.topic) || 'uncategorized';
        var hue = KC.topics.hueOf(topic);
        var thumb = entry && entry.cover ? entry.cover : null;
        list.appendChild(bookRow(book.key, book.title, book.count, topic, hue, thumb));
      }
      host.appendChild(list);
    },

    installResizer: function () {
      var node = byId('resizer');
      if (!node) return;

      function currentWidth() {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w');
        return parseInt(v, 10) || 264;
      }
      function setW(px) {
        var w = Math.max(MIN_W, Math.min(MAX_W, px));
        document.documentElement.style.setProperty('--sidebar-w', w + 'px');
        return w;
      }
      function savePref(key, value) {
        var patch = {};
        patch[key] = value;
        KC.store.prefs.set(patch);
      }

      node.addEventListener('pointerdown', function (e) {
        node.setPointerCapture(e.pointerId);
        document.body.classList.add('is-resizing');
      });
      node.addEventListener('pointermove', function (e) {
        if (!node.hasPointerCapture(e.pointerId)) return;
        setW(e.clientX - byId('sidebar').getBoundingClientRect().left);
      });
      node.addEventListener('pointerup', function (e) {
        node.releasePointerCapture(e.pointerId);
        document.body.classList.remove('is-resizing');
        savePref('sidebarW', currentWidth());
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        savePref('sidebarW', setW(currentWidth() + (e.key === 'ArrowRight' ? 16 : -16)));
      });
    }
  };
})(window.KC = window.KC || {});
