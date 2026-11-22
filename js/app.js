// ---
// purpose: App entry — state, file loading, drag & drop, and every event wiring
// exports: KC.state, KC.app.load(text)
// depends: every other js/ module (incl. js/persist.js, js/backnav.js, js/cardactions.js); loaded last by index.html
// gotcha: highlight data never leaves the device unless the user opts into covers (js/covers.js) —
//   even then, only title/author are sent, never highlight text
// ---
(function (KC) {
  'use strict';

  var DEBOUNCE = 120;
  var searchTimer = null;
  var searchPushed = false;  // one history entry per search, not one per keystroke
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

      if (KC.backnav) KC.backnav.clear();  // saved spots belong to the previous file's books
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
    KC.backnav.clear();       // every saved spot pointed into the file that just went away
    byId('restore-pending').hidden = true;
    byId('dropzone').hidden = false;

    KC.ui.render();
    KC.ui.toast(KC.i18n.t('reset.done'));
  }

  function setQuery(value) {
    // Starting a search from an empty box is a move you can go back from; refining it is not.
    if (value && !KC.state.query && !searchPushed) { KC.backnav.push('nav'); searchPushed = true; }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      searchPushed = false;
      KC.state.query = value;
      KC.state.rendered = 0;
      KC.ui.render();
    }, DEBOUNCE);
  }

  function closeExportMenu() {
    byId('export-list').hidden = true;
    byId('export-btn').setAttribute('aria-expanded', 'false');
  }

  function drawerIsOpen() { return byId('sidebar').className.indexOf('is-open') !== -1; }

  function toggleDrawer(open) {
    var side = byId('sidebar');
    var on = open === undefined ? !drawerIsOpen() : open;
    side.className = on ? 'sidebar is-open' : 'sidebar';
    byId('scrim').hidden = !on;
    byId('drawer-toggle').setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  // A user-initiated open is a history step (the phone's back gesture closes it again); a
  // user-initiated close walks that step back instead of leaving a stale entry behind.
  function userDrawer(open) {
    if (open && !drawerIsOpen()) { KC.backnav.push('drawer'); toggleDrawer(true); return; }
    if (!open && drawerIsOpen()) KC.backnav.requestCloseDrawer();
  }

  // Any filter change is a step back-able to — unless it is made from inside the open drawer,
  // whose own entry already holds the "before" state.
  function pushNav() {
    if (!KC.backnav.adoptDrawer()) KC.backnav.push('nav');
  }

  function paintFav(btn, on, animate) {
    btn.className = btn.className.replace(/\s*(is-on|is-pop|is-unpop)/g, '') + (on ? ' is-on' : '');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var lbl = btn.querySelector('.act-lbl');
    if (lbl) lbl.textContent = KC.i18n.t(on ? 'card.starred' : 'card.star');
    if (!animate) return;
    void btn.offsetWidth;  // restart the keyframes on a quick re-tap
    btn.className += on ? ' is-pop' : ' is-unpop';
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
        var nextTopic = topic === 'all' ? null : (KC.state.activeTopic === topic ? null : topic);
        if (nextTopic === KC.state.activeTopic) return;
        pushNav();
        KC.state.activeTopic = nextTopic;
        KC.state.rendered = 0;
        KC.ui.render();
        return;
      }
      var btn = e.target.closest ? e.target.closest('.book-item') : null;
      if (!btn) return;
      var nextBook = btn.getAttribute('data-book') || null;
      if (nextBook !== KC.state.activeBook) {
        pushNav();
        KC.state.activeBook = nextBook;
        KC.state.rendered = 0;
        KC.ui.render();
        byId('main').scrollTop = 0;
      }
      toggleDrawer(false);  // direct: the step is already recorded (or there was nothing to record)
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
      var ico = byId('theme-ico');
      if (ico) { ico.className = 'mp-ico is-spin'; setTimeout(function () { ico.className = 'mp-ico'; }, 450); }
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

    // closest(), never e.target: the buttons hold an <svg> and a label, and a tap lands on those.
    byId('cards').addEventListener('click', function (e) {
      var favBtn = e.target.closest ? e.target.closest('[data-fav]') : null;
      if (favBtn) {
        var on = KC.favorites.toggle(byIdMap[favBtn.getAttribute('data-fav')]);
        paintFav(favBtn, on, true);
        var card = favBtn.closest('.entry');
        if (card) card.className = card.className.replace(/\s*is-fav/g, '') + (on ? ' is-fav' : '');
        return;
      }
      var copyBtn = e.target.closest ? e.target.closest('[data-copy]') : null;
      if (!copyBtn) return;
      var rec = byIdMap[copyBtn.getAttribute('data-copy')];
      if (!rec) return;
      var text = rec.text + (rec.note && rec.note.text ? '\n\n' + rec.note.text : '') + '\n\n' + rec.tag;
      KC.clipboard.copyText(text).then(function (okCopy) {
        KC.ui.toast(KC.i18n.t(okCopy ? 'card.copied' : 'error.read'));
        if (okCopy) KC.cardactions.flash(copyBtn, 'card.copyDone');
      });
    });

    byId('fav-export').addEventListener('click', function () {
      var n = KC.favio.save();
      KC.ui.toast(n ? KC.i18n.t('favio.saved', { n: n }) : KC.i18n.t('favio.empty'));
    });
    byId('fav-import-btn').addEventListener('click', function () { byId('fav-import').click(); });
    byId('fav-import').addEventListener('change', function (e) {
      var input = e.target;
      KC.favio.read(input.files[0]).then(function (r) {
        input.value = '';  // same file must fire `change` again
        if (!r.ok) { KC.ui.toast(KC.i18n.t('favio.badFile')); return; }
        KC.ui.toast(r.added
          ? KC.i18n.t('favio.restored', { n: r.added, total: r.total })
          : KC.i18n.t('favio.nothingNew'));
        if (r.added) { KC.state.rendered = 0; KC.ui.render(); }
      });
    });

    byId('nav-stats').addEventListener('click', function () { KC.statsview.open(); });
    byId('nav-quotes').addEventListener('click', function () { KC.quoteview.open(); });

    // Desktop topbar shortcuts forward to the real controls inside the ⋯ panel.
    document.querySelector('.topnav').addEventListener('click', function (e) {
      var px = e.target.closest ? e.target.closest('[data-proxy]') : null;
      if (px) byId(px.getAttribute('data-proxy')).click();
    });

    // A book in the stats panel is a shortcut into the reader, filtered to that book; back returns
    // to the very stats view it was tapped in (the entry is pushed while the panel is still open).
    byId('stats-body').addEventListener('click', function (e) {
      var hit = e.target.closest ? e.target.closest('[data-book]') : null;
      if (!hit) return;
      KC.backnav.push('nav');
      KC.statsview.close();
      KC.state.activeBook = hit.getAttribute('data-book');
      KC.state.rendered = 0;
      KC.ui.render();
      byId('main').scrollTop = 0;
    });

    var qcModal = byId('quotes-modal');
    qcModal.addEventListener('click', function (e) {
      // the gallery's buttons hold an <svg> now — resolve the tap to the button that owns it
      var el = (e.target.closest && e.target.closest(
        '[data-qc-src],[data-qc-theme],[data-qc-more],[data-qc-dlall],[data-qc-dl],[data-qc-fav]')) || e.target;
      var get = function (a) { return el.getAttribute && el.getAttribute(a); };
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

    byId('drawer-toggle').addEventListener('click', function () { userDrawer(!drawerIsOpen()); });
    byId('scrim').addEventListener('click', function () { userDrawer(false); });

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && e.target.tagName !== 'INPUT') { e.preventDefault(); byId('q').focus(); }
      if (e.key === 'Escape') { closeExportMenu(); userDrawer(false); }
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

  // Read straight from localStorage so the theme is right on the first painted frame; the
  // IndexedDB mirror can only add what localStorage lost, so a second pass after hydrate is safe.
  function applyPrefs() {
    var prefs = KC.store.prefs.get();
    if (prefs.theme) KC.ui.setTheme(prefs.theme);
    if (prefs.lang) KC.i18n.setLang(prefs.lang);
    if (prefs.sidebarW) document.documentElement.style.setProperty('--sidebar-w', prefs.sidebarW + 'px');
    KC.state.sidebarSort = prefs.sidebarSort || 'title';
    KC.state.sortMode = prefs.sortMode || 'order';
    KC.state.showHidden = !!prefs.showHidden;
    KC.state.coversOn = !!prefs.coversOn;
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyPrefs();

    var params = new URLSearchParams(location.search);
    pendingBook = params.get('book');

    KC.clipboard.install();
    KC.modal.install();
    KC.backnav.install();
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
    // localStorage would paint every highlight unstarred and then overwrite the mirror. Prefs ride
    // the same barrier: a restored theme/language must land before the first render, not after it.
    Promise.all([KC.favorites.hydrate(), KC.store.prefs.hydrate()]).then(function (done) {
      if (done[1]) applyPrefs();  // a restored lang re-runs applyStrings through KC.i18n.onChange
      if (KC.store.hadFile.get() > 0) KC.persist.requestDurable();  // re-ask every visit; Chrome grants by engagement
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
