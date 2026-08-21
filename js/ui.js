// ---
// purpose: Render the chrome — strings, sidebar, stat line, empty state, toast — and drive render()
// exports: KC.ui.applyStrings(), renderSidebar(), render(), toast(), setTheme(), fillPane()
// depends: js/i18n.js, js/search.js, js/cards.js
// gotcha: the pagination reset key is activeBook | query | showHidden — all three resize the list
// ---
(function (KC) {
  'use strict';

  var toastTimer = null;

  function byId(id) { return document.getElementById(id); }

  KC.ui = {
    applyStrings: function () {
      var t = KC.i18n.t, i, n;
      var nodes = document.querySelectorAll('[data-i18n]');
      for (i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
      nodes = document.querySelectorAll('[data-i18n-ph]');
      for (i = 0; i < nodes.length; i++) nodes[i].placeholder = t(nodes[i].getAttribute('data-i18n-ph'));
      nodes = document.querySelectorAll('[data-i18n-label]');
      for (i = 0; i < nodes.length; i++) nodes[i].setAttribute('aria-label', t(nodes[i].getAttribute('data-i18n-label')));

      document.documentElement.lang = KC.i18n.lang;
      byId('skip-link').textContent = KC.i18n.lang === 'en' ? 'Skip to highlights' : 'Ir para os destaques';
      byId('toggle-lang').textContent = t(KC.i18n.lang === 'en' ? 'lang.pt' : 'lang.en');
      n = byId('toggle-hidden');
      n.textContent = t(KC.state.showHidden ? 'toggle.hidden.hide' : 'toggle.hidden.show');
      n.setAttribute('aria-pressed', KC.state.showHidden ? 'true' : 'false');
    },

    renderSidebar: function () {
      var host = byId('sidebar'), s = KC.state, i;
      while (host.firstChild) host.removeChild(host.firstChild);
      if (!s.books.length) return;

      function item(key, title, count) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'book-item' + (s.activeBook === key ? ' is-active' : '') +
          (count === 0 ? ' is-empty' : '');
        b.setAttribute('data-book', key === null ? '' : key);
        var tt = document.createElement('span');
        tt.className = 'book-title';
        tt.textContent = title;
        var c = document.createElement('span');
        c.className = 'book-count';
        c.textContent = KC.i18n.num(count);
        b.appendChild(tt);
        b.appendChild(c);
        host.appendChild(b);
      }

      var total = 0;
      for (i = 0; i < s.books.length; i++) total += s.books[i].count;
      item(null, KC.i18n.t('sidebar.all'), total);
      for (i = 0; i < s.books.length; i++) item(s.books[i].key, s.books[i].title, s.books[i].count);
    },

    renderStats: function () {
      var s = KC.state, line = byId('statline'), st = s.stats;
      if (!st) { line.hidden = true; return; }
      while (line.firstChild) line.removeChild(line.firstChild);
      line.hidden = false;

      var main = document.createTextNode(KC.i18n.t('stats.line', { records: s.visible.length, books: st.books }));
      line.appendChild(main);

      var extras = [];
      if (st.duplicates) extras.push(KC.i18n.t('stats.duplicates', { n: st.duplicates }));
      if (st.bookmarks) extras.push(KC.i18n.t('stats.bookmarks', { n: st.bookmarks }));
      if (st.clipLimit) extras.push(KC.i18n.t('stats.clipLimit', { n: st.clipLimit }));
      if (st.unparsed) extras.push(KC.i18n.t('stats.unparsed', { n: st.unparsed }));
      if (!extras.length) return;
      var span = document.createElement('span');
      span.className = 'stat-extra';
      span.textContent = ' · ' + extras.join(' · ');
      line.appendChild(span);
    },

    render: function () {
      var s = KC.state, pool = s.showHidden ? s.visible.concat(s.hidden) : s.visible, i, out = [];
      if (s.showHidden) pool.sort(function (a, b) { return a.order - b.order; });

      for (i = 0; i < pool.length; i++) {
        if (s.activeBook && pool[i].bookKey !== s.activeBook) continue;
        out.push(pool[i]);
      }
      s.filtered = KC.search.filter(out, s.query);

      KC.cards.reset();
      KC.cards.appendPage();
      KC.cards.observe();
      KC.ui.fillPane();

      var empty = byId('empty');
      empty.textContent = KC.i18n.t(s.visible.length ? 'empty.noResults' : 'empty.noFile');
      empty.hidden = s.filtered.length > 0 || !s.stats;
      KC.ui.renderSidebar();
      KC.ui.renderStats();
    },

    // A short list never re-triggers the observer, so top up until the pane can scroll.
    fillPane: function () {
      var pane = byId('main'), guard = 0;
      while (guard++ < 5 && KC.state.rendered < KC.state.filtered.length &&
             pane.scrollHeight <= pane.clientHeight + 40) {
        if (!KC.cards.appendPage()) break;
      }
    },

    toast: function (msg) {
      var n = byId('toast');
      n.textContent = msg;
      n.hidden = false;
      n.className = 'toast is-on';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        n.className = 'toast';
        n.hidden = true;
      }, 2000);
    },

    setTheme: function (theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  };
})(window.KC = window.KC || {});
