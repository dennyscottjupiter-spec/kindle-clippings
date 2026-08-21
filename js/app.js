// ---
// purpose: App entry — state, file loading, drag & drop, and every event wiring
// exports: KC.state, KC.app.load(text)
// depends: every other js/ module; loaded last by index.html
// gotcha: highlight data never leaves the device unless the user opts into covers (js/covers.js) —
//   even then, only title/author are sent, never highlight text
// ---
(function (KC) {
  'use strict';

  var DEBOUNCE = 120;
  var searchTimer = null;
  var byIdMap = {};
  var pendingBook = null;

  KC.state = {
    visible: [], hidden: [], books: [], tagByBook: {},
    activeBook: null, query: '', showHidden: false,
    filtered: [], rendered: 0, stats: null,
    activeTopic: null,
    sortMode: 'order',
    sidebarSort: 'title',
    coversOn: false,
    lib: {}
  };

  function byId(id) { return document.getElementById(id); }

  function snapshotOf(books) {
    var out = [];
    for (var i = 0; i < books.length; i++) {
      out.push({ key: books[i].key, title: books[i].title, author: books[i].author,
        count: books[i].count, lastMs: books[i].lastMs || 0 });
    }
    return out;
  }

  function onCoverProgress(done, total) {
    if (done < total) {
      KC.ui.updateCoversButton(KC.i18n.t('covers.progress', { done: done, total: total }), total ? done / total : 0);
    } else {
      KC.ui.updateCoversButton();
      KC.ui.toast(total ? KC.i18n.t('covers.done', { n: total }) : KC.i18n.t('covers.cached'));
    }
    KC.ui.renderSidebar();
    KC.ui.renderBookBanner();
  }

  KC.app = {
    load: function (text) {
      var parsed = KC.parse(text);
      var out = KC.clean.process(parsed);
      var tags = KC.tags.build(out.books);
      var all = out.visible.concat(out.hidden), i;

      for (i = 0; i < all.length; i++) {
        all[i].tag = tags[all[i].bookKey] || '';
        byIdMap[all[i].id] = all[i];
      }
      KC.search.index(all);

      KC.state.visible = out.visible;
      KC.state.hidden = out.hidden;
      KC.state.books = out.books;
      KC.state.tagByBook = tags;
      KC.state.stats = out.stats;
      KC.state.rendered = 0;
      KC.state.lib = KC.store.lib.get() || {};

      KC.state.activeBook = null;
      if (pendingBook && out.books.some(function (b) { return b.key === pendingBook; })) {
        KC.state.activeBook = pendingBook;
      }
      pendingBook = null;
      byId('restore-pending').hidden = true;

      KC.store.books.set(snapshotOf(out.books));
      if (KC.state.coversOn) KC.covers.fetchAll(out.books, onCoverProgress);

      byId('dropzone').hidden = true;
      KC.ui.render();
      return out;
    },

    readFile: function (file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        if (!text.trim()) { KC.ui.toast(KC.i18n.t('error.empty')); return; }
        KC.store.session.save(text);
        KC.app.load(text);
      };
      reader.onerror = function () { KC.ui.toast(KC.i18n.t('error.read')); };
      reader.readAsText(file, 'utf-8');
    },

    activeBookTitle: function () {
      var s = KC.state, i;
      for (i = 0; i < s.books.length; i++) if (s.books[i].key === s.activeBook) return s.books[i].title;
      return null;
    },

    exportAs: function (kind) {
      var s = KC.state;
      var single = kind === 'mdBook';
      // What you see is what you export: s.filtered already reflects book and query.
      KC.exports.run(single ? 'md' : kind, s.filtered, single ? { bookTitle: KC.app.activeBookTitle() } : {});
      KC.ui.toast(KC.i18n.t('export.done'));
    }
  };

  function setQuery(value) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      KC.state.query = value;
      KC.state.rendered = 0;
      KC.ui.render();
    }, DEBOUNCE);
  }

  function closeExportMenu() {
    byId('export-list').hidden = true;
    byId('export-btn').setAttribute('aria-expanded', 'false');
  }

  function toggleDrawer(open) {
    var side = byId('sidebar');
    var on = open === undefined ? side.className.indexOf('is-open') === -1 : open;
    side.className = on ? 'sidebar is-open' : 'sidebar';
    byId('scrim').hidden = !on;
    byId('drawer-toggle').setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function wire() {
    byId('file').addEventListener('change', function (e) { KC.app.readFile(e.target.files[0]); });

    var dz = byId('dropzone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); dz.className = 'dropzone is-over'; });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); dz.className = 'dropzone'; });
    });
    document.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        KC.app.readFile(e.dataTransfer.files[0]);
      }
    });

    byId('q').addEventListener('input', function (e) { setQuery(e.target.value); });

    byId('sidebar').addEventListener('click', function (e) {
      var segBtn = e.target.closest ? e.target.closest('#sidebar-sort-seg [data-sort]') : null;
      if (segBtn) {
        KC.state.sidebarSort = segBtn.getAttribute('data-sort');
        KC.store.prefs.set({ sidebarSort: KC.state.sidebarSort });
        KC.sidebar.render();
        return;
      }
      var chip = e.target.closest ? e.target.closest('.chip') : null;
      if (chip) {
        var topic = chip.getAttribute('data-topic');
        if (topic === 'all') { KC.state.activeTopic = null; }
        else { KC.state.activeTopic = (KC.state.activeTopic === topic) ? null : topic; }
        KC.state.rendered = 0;
        KC.ui.render();
        return;
      }
      var btn = e.target.closest ? e.target.closest('.book-item') : null;
      if (!btn) return;
      KC.state.activeBook = btn.getAttribute('data-book') || null;
      KC.state.rendered = 0;
      KC.ui.render();
      toggleDrawer(false);
      byId('main').scrollTop = 0;
    });

    byId('sort-seg').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-sort]') : null;
      if (!btn) return;
      KC.state.sortMode = btn.getAttribute('data-sort');
      KC.store.prefs.set({ sortMode: KC.state.sortMode });
      KC.state.rendered = 0;
      KC.ui.render();
      byId('main').scrollTop = 0;
    });

    byId('toggle-covers').addEventListener('click', function () {
      if (KC.state.coversOn) {
        KC.covers.disable();
        KC.ui.updateCoversButton();
      } else {
        KC.covers.enable(onCoverProgress);
        KC.ui.updateCoversButton();
      }
    });

    byId('toggle-hidden').addEventListener('click', function () {
      KC.state.showHidden = !KC.state.showHidden;
      KC.state.rendered = 0;
      KC.store.prefs.set({ showHidden: KC.state.showHidden });
      KC.ui.applyStrings();
      KC.ui.render();
    });

    byId('toggle-theme').addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      if (!current) {
        current = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      var next = current === 'dark' ? 'light' : 'dark';
      KC.ui.setTheme(next);
      KC.store.prefs.set({ theme: next });
    });

    byId('toggle-lang').addEventListener('click', function () {
      var next = KC.i18n.lang === 'en' ? 'pt-BR' : 'en';
      KC.i18n.setLang(next);
      KC.store.prefs.set({ lang: next });
    });

    byId('export-btn').addEventListener('click', function () {
      var list = byId('export-list');
      list.hidden = !list.hidden;
      byId('export-btn').setAttribute('aria-expanded', list.hidden ? 'false' : 'true');
    });
    byId('export-list').addEventListener('click', function (e) {
      var kind = e.target.getAttribute && e.target.getAttribute('data-export');
      if (!kind) return;
      closeExportMenu();
      KC.app.exportAs(kind);
    });
    document.addEventListener('click', function (e) {
      if (!byId('export-menu').contains(e.target)) closeExportMenu();
    });

    byId('cards').addEventListener('click', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-copy');
      if (!id) return;
      var rec = byIdMap[id];
      var text = rec.text + (rec.note && rec.note.text ? '\n\n' + rec.note.text : '') + '\n\n' + rec.tag;
      KC.clipboard.copyText(text).then(function (okCopy) {
        KC.ui.toast(KC.i18n.t(okCopy ? 'card.copied' : 'error.read'));
      });
    });

    byId('drawer-toggle').addEventListener('click', function () { toggleDrawer(); });
    byId('scrim').addEventListener('click', function () { toggleDrawer(false); });

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && e.target.tagName !== 'INPUT') { e.preventDefault(); byId('q').focus(); }
      if (e.key === 'Escape') { closeExportMenu(); toggleDrawer(false); }
    });

    KC.i18n.onChange = function () {
      KC.state.books = KC.clean.buildBooks(KC.state.visible, KC.state.hidden);
      KC.ui.applyStrings();
      KC.ui.render();
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    var prefs = KC.store.prefs.get();
    if (prefs.theme) KC.ui.setTheme(prefs.theme);
    if (prefs.lang) KC.i18n.setLang(prefs.lang);
    if (prefs.sidebarW) document.documentElement.style.setProperty('--sidebar-w', prefs.sidebarW + 'px');
    KC.state.sidebarSort = prefs.sidebarSort || 'title';
    KC.state.sortMode = prefs.sortMode || 'order';
    KC.state.showHidden = !!prefs.showHidden;
    KC.state.coversOn = !!prefs.coversOn;

    var params = new URLSearchParams(location.search);
    pendingBook = params.get('book');

    KC.clipboard.install();
    wire();
    KC.sidebar.installResizer();
    KC.ui.applyStrings();

    var savedText = KC.store.session.load();
    if (savedText) {
      KC.app.load(savedText);
    } else {
      KC.ui.render();
      if (pendingBook) {
        var hint = byId('restore-pending');
        hint.hidden = false;
        hint.textContent = KC.i18n.t('restore.pending', { book: decodeURIComponent(pendingBook) });
      }
    }
  });
})(window.KC = window.KC || {});
