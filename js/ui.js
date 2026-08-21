// ---
// purpose: Render the chrome — strings, sidebar delegate, book banner, sort bar, stat line, toast
// exports: KC.ui.applyStrings(), renderSidebar(), renderBookBanner(), render(), toast(), setTheme(),
//   fillPane(), updateCoversButton()
// depends: js/i18n.js, js/search.js, js/sort.js, js/cards.js, js/sidebar.js, js/covers.js, js/topics.js
// gotcha: the pagination reset key is activeBook | activeTopic | query | showHidden | sortMode — all five
// ---
(function (KC) {
  'use strict';

  var toastTimer = null;

  function byId(id) { return document.getElementById(id); }

  function activeBookRecord() {
    var s = KC.state;
    for (var i = 0; i < s.books.length; i++) if (s.books[i].key === s.activeBook) return s.books[i];
    return null;
  }

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

      // The flag pictures the language you would switch TO, so it always shows the other one.
      var toPt = KC.i18n.lang === 'en';
      byId('lang-flag').src = toPt ? 'assets/flags/br.svg' : 'assets/flags/gb.svg';
      byId('toggle-lang').setAttribute('aria-label', t('toggle.lang') + ': ' + t(toPt ? 'lang.pt' : 'lang.en'));

      n = byId('toggle-hidden');
      n.setAttribute('aria-checked', KC.state.showHidden ? 'true' : 'false');

      KC.ui.updateCoversButton();

      var footer = document.querySelector('.footer-note');
      if (footer) footer.textContent = t(KC.state.coversOn ? 'footer.privacyCovers' : 'footer.privacy');
    },

    updateCoversButton: function (progressText, pct) {
      KC.covers.paintSwitch(progressText, pct);
    },

    renderSidebar: function () {
      KC.sidebar.render();
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

    renderSortBar: function () {
      var bar = byId('sortbar');
      if (!bar) return;
      bar.hidden = !KC.state.stats;
      var buttons = bar.querySelectorAll('[data-sort]');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-sort') === KC.state.sortMode ? 'true' : 'false');
      }
    },

    renderBookBanner: function () {
      var host = byId('book-banner');
      if (!host) return;
      while (host.firstChild) host.removeChild(host.firstChild);
      var book = activeBookRecord();
      if (!book) { host.hidden = true; host.removeAttribute('style'); return; }
      host.hidden = false;

      var entry = KC.covers.entry(book.key);
      var topic = (entry && entry.topic) || 'uncategorized';
      var hue = KC.topics.hueOf(topic);
      host.setAttribute('data-topic', topic);
      if (hue !== null && hue !== undefined) host.style.setProperty('--h', String(hue));
      else host.style.removeProperty('--h');

      var fig = document.createElement('figure');
      fig.className = 'bb-cover';
      var img = document.createElement('img');
      img.alt = '';
      img.src = (entry && entry.cover) ? entry.cover : KC.covers.placeholder(book.title, book.author, hue);
      fig.appendChild(img);
      host.appendChild(fig);

      var meta = document.createElement('div');
      meta.className = 'bb-meta';
      var eyebrow = document.createElement('span');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = KC.topics.label(topic);
      var h2 = document.createElement('h2');
      h2.className = 'bb-title';
      h2.textContent = book.title;
      var author = document.createElement('p');
      author.className = 'bb-author';
      author.textContent = book.author;
      var stats = document.createElement('div');
      stats.className = 'bb-stats';
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = KC.i18n.num(book.count);
      stats.appendChild(badge);
      stats.appendChild(document.createTextNode(' ' + KC.i18n.t('book.highlights', { n: book.count })));
      meta.appendChild(eyebrow);
      meta.appendChild(h2);
      meta.appendChild(author);
      meta.appendChild(stats);
      host.appendChild(meta);
    },

    render: function () {
      var s = KC.state, pool = s.showHidden ? s.visible.concat(s.hidden) : s.visible, i, out = [];
      if (s.showHidden) pool.sort(function (a, b) { return a.order - b.order; });

      function topicOf(rec) { return (s.lib[rec.bookKey] && s.lib[rec.bookKey].topic) || 'uncategorized'; }

      for (i = 0; i < pool.length; i++) {
        if (s.activeBook && pool[i].bookKey !== s.activeBook) continue;
        if (s.activeTopic && topicOf(pool[i]) !== s.activeTopic) continue;
        out.push(pool[i]);
      }
      s.filtered = KC.sort.apply(KC.search.filter(out, s.query), s.sortMode, s.lib);

      KC.cards.reset();
      KC.cards.appendPage();
      KC.cards.observe();
      KC.ui.fillPane();

      var empty = byId('empty');
      empty.textContent = KC.i18n.t(s.visible.length ? 'empty.noResults' : 'empty.noFile');
      empty.hidden = s.filtered.length > 0 || !s.stats;
      KC.ui.renderSidebar();
      KC.ui.renderStats();
      KC.ui.renderBookBanner();
      KC.ui.renderSortBar();
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
