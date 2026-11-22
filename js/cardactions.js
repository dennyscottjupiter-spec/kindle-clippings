// ---
// purpose: Per-card actions beside the star/copy buttons — save one highlight as a JPEG quote card,
//   or export just that one record (md/json/txt/anki)
// exports: KC.cardactions.flash(btn, i18nKey) — the "done" morph, reused by js/app.js's copy button;
//   otherwise wires itself onto #cards and wraps KC.cards.appendPage
// depends: js/cards.js (wrapped, never edited inline — its KC.cards.actBtn builds every tray button),
//   js/icons.js, js/quotecard.js, js/exports.js, js/topics.js, js/i18n-cardactions.js,
//   css/chrome.css (.menu/.menu-list — reused verbatim for the dropdown)
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
  function saveImage(id, btn) {
    var rec = recById(id);
    if (!rec) return;
    if (btn && btn.className.indexOf('is-busy') !== -1) return;  // a double tap must not save twice
    var s = KC.quotecard.SIZES[0];
    var opts = { w: s.w, h: s.h, theme: 'dark', hue: hueOf(rec), scale: 1 };
    var name = slug(rec.title) + '-' + s.w + 'x' + s.h + '.jpg';
    if (btn) btn.className += ' is-busy';
    KC.quotecard.download(rec, opts, name).then(function () {
      KC.ui.toast(KC.i18n.t('ca.img.done'));
      if (btn) KC.cardactions.flash(btn, 'card.imageDone');
    }, function () {
      KC.ui.toast(KC.i18n.t('ca.img.failed'));
      if (btn) btn.className = btn.className.replace(/\s*is-busy/g, '');
    });
  }

  // Brief success morph shared with the copy button (js/app.js): icon → check, label → "Done",
  // then back. The original label is read from the DOM so a language switch mid-flash is harmless.
  function flash(btn, key) {
    var lbl = btn.querySelector('.act-lbl');
    // Remember the resting state only once: a second tap mid-flash must not capture the check mark.
    if (!btn._kcRest) {
      var icon = btn.querySelector('svg.ico');
      btn._kcRest = {
        name: icon ? (icon.getAttribute('class').match(/ico-([a-z]+)/) || [])[1] : null,
        text: lbl ? lbl.textContent : ''
      };
    }
    clearTimeout(btn._kcFlash);
    btn.className = btn.className.replace(/\s*is-busy/g, '').replace(/\s*is-done/g, '') + ' is-done';
    KC.icons.swap(btn, 'check');
    if (lbl) lbl.textContent = KC.i18n.t(key);
    btn._kcFlash = setTimeout(function () {
      var rest = btn._kcRest;
      btn._kcRest = null;
      btn.className = btn.className.replace(/\s*is-done/g, '');
      if (rest && rest.name) KC.icons.swap(btn, rest.name);
      if (lbl && rest) lbl.textContent = rest.text;
    }, 1600);
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
    var b = KC.cards.actBtn('ca-btn ca-img', 'image', KC.i18n.t('card.image'));
    b.setAttribute('data-ca-img', id);
    b.setAttribute('aria-label', KC.i18n.t('ca.img.aria'));
    b.title = KC.i18n.t('ca.img.aria');
    return b;
  }

  function buildExportMenu(id) {
    var wrap = el('span', 'menu ca-menu');
    var trigger = KC.cards.actBtn('ca-btn ca-export', 'share', KC.i18n.t('export.menu'));
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
      var tray = art.querySelector('.meta-actions') || art.querySelector('.meta');
      var id = art.getAttribute('data-id');
      if (!tray || !id) continue;
      tray.appendChild(buildImgBtn(id));
      tray.appendChild(buildExportMenu(id));
    }
  }

  // js/cards.js is never edited — every path that adds cards funnels through KC.cards.appendPage
  // (the initial render, fillPane's top-up loop, and the IntersectionObserver), so wrapping the one
  // shared function here means every future batch gets buttons too, not just the first page.
  KC.cardactions = { flash: flash };

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
      if (imgBtn) { saveImage(imgBtn.getAttribute('data-ca-img'), imgBtn); return; }
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
