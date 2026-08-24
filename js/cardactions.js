// ---
// purpose: Per-card actions beside the star/copy buttons — save one highlight as a JPEG quote card,
//   or export just that one record (md/json/txt/anki)
// exports: nothing — wires itself onto #cards and wraps KC.cards.appendPage
// depends: js/cards.js (wrapped, never edited), js/quotecard.js, js/exports.js, js/topics.js,
//   js/i18n-cardactions.js, css/chrome.css (.menu/.menu-list — reused verbatim for the dropdown)
// gotcha: js/cards.js paginates in batches of 200 via an IntersectionObserver, so buttons cannot be
//   built once at install time — KC.cards.appendPage is wrapped so every batch gets augmented, and
//   each processed .entry is marked [data-ca-done] so a later batch never re-processes it
// ---
(function (KC) {
  'use strict';

  var openMenu = null; // { list, trigger } — at most one card export menu open at a time

  // Sensible for ONE record: md/json/txt/anki. csv is an inherently tabular multi-row format (a
  // single-row CSV adds nothing over the text itself) and the Obsidian export is a whole-book note
  // (frontmatter + every highlight) — wrong grain for one highlight. Both are left out on purpose.
  var FORMATS = ['md', 'json', 'txt', 'anki'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function recById(id) {
    var list = KC.state.filtered || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // Mirrors js/quotecard.js's own slug() exactly, so a card-saved filename matches a gallery one.
  function slug(s) {
    return KC.i18n.fold(String(s || 'quote')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'quote';
  }

  // Mirrors js/quoteview.js's private hueOf() — not exported there, so duplicated here.
  function hueOf(rec) {
    var entry = KC.state.lib && KC.state.lib[rec.bookKey];
    var hue = KC.topics.hueOf((entry && entry.topic) || 'uncategorized');
    return (hue === null || hue === undefined) ? null : hue;
  }

  // Same call shape as js/quoteview.js#downloadOne: SIZES[0] and the gallery's own default theme
  // ('dark'), never the gallery's live (possibly user-changed) selection — so a card-saved image is
  // identical to one saved from the gallery with default settings.
  function saveImage(id) {
    var rec = recById(id);
    if (!rec) return;
    var s = KC.quotecard.SIZES[0];
    var opts = { w: s.w, h: s.h, theme: 'dark', hue: hueOf(rec), scale: 1 };
    var name = slug(rec.title) + '-' + s.w + 'x' + s.h + '.jpg';
    KC.quotecard.download(rec, opts, name).then(function () {
      KC.ui.toast(KC.i18n.t('ca.img.done'));
    }, function () {
      KC.ui.toast(KC.i18n.t('ca.img.failed'));
    });
  }

  function exportOne(kind, id) {
    var rec = recById(id);
    if (!rec) return;
    var built = KC.exports.build(kind, [rec], { bookTitle: rec.title });
    var dot = built.name.lastIndexOf('.');
    var name = built.name.slice(0, dot) + '-highlight' + built.name.slice(dot);
    KC.exports.download(name, built.text, built.mime);
    KC.ui.toast(KC.i18n.t('export.done'));
  }

  function closeMenu() {
    if (!openMenu) return;
    openMenu.list.hidden = true;
    openMenu.trigger.setAttribute('aria-expanded', 'false');
    openMenu = null;
  }

  function openMenuFor(trigger) {
    var list = trigger.parentNode.querySelector('.menu-list');
    if (!list) return;
    if (openMenu && openMenu.list === list) { closeMenu(); return; }
    closeMenu();
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    openMenu = { list: list, trigger: trigger };
  }

  function buildImgBtn(id) {
    var b = el('button', 'ca-btn ca-img', '↓ JPG'); // matches js/quoteview.js's own '↓ JPG' label
    b.type = 'button';
    b.setAttribute('data-ca-img', id);
    b.setAttribute('aria-label', KC.i18n.t('ca.img.aria'));
    b.title = KC.i18n.t('ca.img.aria');
    return b;
  }

  function buildExportMenu(id) {
    var wrap = el('span', 'menu ca-menu');
    var trigger = el('button', 'ca-btn ca-export', KC.i18n.t('export.menu'));
    trigger.type = 'button';
    trigger.setAttribute('data-ca-export', id);
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', KC.i18n.t('ca.export.aria'));
    trigger.title = KC.i18n.t('ca.export.aria');
    wrap.appendChild(trigger);

    var list = el('ul', 'menu-list');
    list.hidden = true;
    for (var i = 0; i < FORMATS.length; i++) {
      var li = el('li');
      var btn = el('button', null, KC.i18n.t('export.' + FORMATS[i]));
      btn.type = 'button';
      btn.setAttribute('data-ca-run', FORMATS[i]);
      btn.setAttribute('data-id', id);
      li.appendChild(btn);
      list.appendChild(li);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function augmentCards() {
    var host = document.getElementById('cards');
    if (!host) return;
    var arts = host.querySelectorAll('.entry:not([data-ca-done])');
    for (var i = 0; i < arts.length; i++) {
      var art = arts[i];
      art.setAttribute('data-ca-done', '1');
      var meta = art.querySelector('.meta');
      var id = art.getAttribute('data-id');
      if (!meta || !id) continue;
      meta.appendChild(buildImgBtn(id));
      meta.appendChild(buildExportMenu(id));
    }
  }

  // js/cards.js is never edited — every path that adds cards funnels through KC.cards.appendPage
  // (the initial render, fillPane's top-up loop, and the IntersectionObserver), so wrapping the one
  // shared function here means every future batch gets buttons too, not just the first page.
  if (KC.cards && typeof KC.cards.appendPage === 'function') {
    (function () {
      var origAppendPage = KC.cards.appendPage;
      KC.cards.appendPage = function () {
        var n = origAppendPage.apply(KC.cards, arguments);
        augmentCards();
        return n;
      };
    })();
  }

  var cardsHost = document.getElementById('cards');
  if (cardsHost) {
    cardsHost.addEventListener('click', function (e) {
      var t = e.target, closest = function (sel) { return t.closest ? t.closest(sel) : null; };
      var imgBtn = closest('[data-ca-img]');
      if (imgBtn) { saveImage(imgBtn.getAttribute('data-ca-img')); return; }
      var expBtn = closest('[data-ca-export]');
      if (expBtn) { openMenuFor(expBtn); return; }
      var runBtn = closest('[data-ca-run]');
      if (runBtn) { exportOne(runBtn.getAttribute('data-ca-run'), runBtn.getAttribute('data-id')); closeMenu(); }
    });
  }

  document.addEventListener('click', function (e) {
    if (!openMenu) return;
    if (openMenu.list.contains(e.target) || openMenu.trigger.contains(e.target)) return;
    closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openMenu) closeMenu();
  });
})(window.KC = window.KC || {});
