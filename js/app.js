// ---
// purpose: App entry — state, file loading, drag & drop, and every event wiring
// exports: KC.state, KC.app.load(text)
// depends: every other js/ module (incl. js/persist.js); loaded last by index.html
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
        KC.persist.save(text, file.name).then(function (ok) {
          if (ok) { KC.store.hadFile.set(); KC.persist.requestDurable(); }
          KC.ui.toast(KC.i18n.t(ok ? 'restore.saved' : 'restore.failed'));
        });
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
      if (kind === 'obsidian') {
        KC.obsidian.run(s.filtered, { lib: s.lib, callout: true });
        KC.ui.toast(KC.i18n.t('export.done'));
        return;
      }
      var single = kind === 'mdBook';
      // What you see is what you export: s.filtered already reflects book and query.
      KC.exports.run(single ? 'md' : kind, s.filtered, single ? { bookTitle: KC.app.activeBookTitle() } : {});
      KC.ui.toast(KC.i18n.t('export.done'));
    }
  };

  // Forget the saved file and go back to the dropzone, ready for a different one.
  function resetFile() {
    KC.persist.clear();
    KC.store.session.clear();
    KC.store.hadFile.clear();
    byIdMap = {};
    KC.search.index([]);

    var s = KC.state;
    s.visible = []; s.hidden = []; s.books = []; s.tagByBook = {};
    s.stats = null; s.filtered = []; s.rendered = 0;
    s.activeBook = null; s.activeTopic = null; s.query = '';

    byId('q').value = '';
    byId('file').value = '';  // same file must fire `change` again
    byId('restore-pending').hidden = true;
    byId('dropzone').hidden = false;

    KC.ui.render();
    KC.ui.toast(KC.i18n.t('reset.done'));
  }

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

    // The markup for this button may land after this module — wire it only if it is there.
    var rb = byId('btn-reset');
    if (rb) {
      rb.addEventListener('click', function () {
        if (window.confirm(KC.i18n.t('reset.confirm'))) resetFile();
      });
    }

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
      var favId = e.target.getAttribute && e.target.getAttribute('data-fav');
      if (favId) {
        var favRec = byIdMap[favId];
        var on = KC.favorites.toggle(favRec);
        e.target.className = on ? 'fav is-on' : 'fav';
        e.target.setAttribute('aria-pressed', on ? 'true' : 'false');
        var card = e.target.closest ? e.target.closest('.entry') : null;
        if (card) card.className = on ? card.className + ' is-fav' : card.className.replace(/\s*is-fav/g, '');
        return;
      }
      var id = e.target.getAttribute && e.target.getAttribute('data-copy');
      if (!id) return;
      var rec = byIdMap[id];
      var text = rec.text + (rec.note && rec.note.text ? '\n\n' + rec.note.text : '') + '\n\n' + rec.tag;
      KC.clipboard.copyText(text).then(function (okCopy) {
        KC.ui.toast(KC.i18n.t(okCopy ? 'card.copied' : 'error.read'));
      });
    });

    byId('nav-stats').addEventListener('click', function () { KC.statsview.open(); });
    byId('nav-quotes').addEventListener('click', function () { KC.quoteview.open(); });

    // A book name in the stats panel is a shortcut back into the reader, filtered to that book.
    byId('stats-body').addEventListener('click', function (e) {
      var key = e.target.getAttribute && e.target.getAttribute('data-book');
      if (!key) return;
      KC.statsview.close();
      KC.state.activeBook = key;
      KC.state.rendered = 0;
      KC.ui.render();
      byId('main').scrollTop = 0;
    });

    var qcModal = byId('quotes-modal');
    qcModal.addEventListener('click', function (e) {
      var el = e.target, get = function (a) { return el.getAttribute && el.getAttribute(a); };
      if (get('data-qc-src')) { KC.quoteview.set({ source: get('data-qc-src') }); return; }
      if (get('data-qc-theme')) { KC.quoteview.set({ theme: get('data-qc-theme') }); return; }
      if (get('data-qc-more')) { KC.quoteview.set({ shown: KC.quoteview.state.shown + 18 }); return; }
      if (get('data-qc-dlall')) { KC.quoteview.downloadVisible(); return; }
      if (get('data-qc-dl')) { KC.quoteview.downloadOne(KC.quoteview.recById(get('data-qc-dl'))); return; }
      if (get('data-qc-fav')) {
        KC.favorites.toggle(KC.quoteview.recById(get('data-qc-fav')));
        KC.quoteview.set({ shown: KC.quoteview.state.shown });
      }
    });
    byId('qc-q').addEventListener('input', function (e) { KC.quoteview.set({ query: e.target.value }); });
    byId('qc-size').addEventListener('change', function (e) { KC.quoteview.set({ sizeId: e.target.value }); });

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
      if (KC.modal.isOpen('stats-modal')) KC.statsview.render();
      if (KC.modal.isOpen('quotes-modal')) KC.quoteview.render();
      if (KC.modal.isOpen('help-modal')) KC.helpview.render();
      if (KC.modal.isOpen('about-modal')) KC.aboutview.render();
    };
  }

  function fillSizes() {
    var sel = byId('qc-size'), list = KC.quotecard.SIZES, i;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    for (i = 0; i < list.length; i++) {
      var o = document.createElement('option');
      o.value = list[i].id;
      o.textContent = list[i].label + ' · ' + list[i].w + '×' + list[i].h;
      sel.appendChild(o);
    }
    sel.value = KC.quoteview.state.sizeId;
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
    KC.modal.install();
    wire();
    fillSizes();
    KC.sidebar.installResizer();
    KC.ui.applyStrings();

    var hint = byId('restore-pending');

    // Until 'restore.evicted' lands in the catalogs, KC.i18n.t echoes the key back — fall back then.
    function evictedText() {
      var s = KC.i18n.t('restore.evicted');
      return s === 'restore.evicted' ? KC.i18n.t('restore.failed') : s;
    }

    function showDropzone(evicted) {
      byId('dropzone').hidden = false;
      if (evicted) { hint.hidden = false; hint.textContent = evictedText(); return; }
      hint.hidden = !pendingBook;
      if (pendingBook) hint.textContent = KC.i18n.t('restore.pending', { book: decodeURIComponent(pendingBook) });
    }

    // Stars must be back in memory before anything renders a card, or a session that lost its
    // localStorage would paint every highlight unstarred and then overwrite the mirror.
    KC.favorites.hydrate().then(function () {
      var savedText = KC.store.session.load();
      if (savedText) {
        KC.app.load(savedText);          // instant same-tab restore
        return;
      }

      KC.ui.render();
      if (!KC.persist.available) { showDropzone(); return; }

      // Durable restore is async: keep the dropzone out of the way instead of flashing it.
      byId('dropzone').hidden = true;
      hint.hidden = false;
      hint.textContent = KC.i18n.t('restore.loading');
      KC.persist.load().then(function (rec) {
        if (rec && rec.text) {
          KC.store.session.save(rec.text);
          KC.app.load(rec.text);
          KC.ui.toast(KC.i18n.t('restore.loaded'));
        } else {
          showDropzone(KC.store.hadFile.get() > 0);  // marker without a record = the browser evicted it
        }
      });
    });
  });
})(window.KC = window.KC || {});
