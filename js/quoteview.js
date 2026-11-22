// ---
// purpose: Quote-card panel — filter and order starred highlights, preview them, download JPEGs
// exports: KC.quoteview.open(), close(), render(), set(), recById(), downloadOne(), downloadVisible()
// depends: js/icons.js, js/quotesort.js, js/quotecard.js, js/favorites.js, js/i18n.js, js/topics.js, js/modal.js
// gotcha: previews draw at PREVIEW_SCALE to stay cheap; the download always redraws at scale 1
// ---
(function (KC) {
  'use strict';

  var PREVIEW_SCALE = 0.42, PAGE = 18, wired = false;

  var view = {
    source: 'fav', bookKey: 'all', mode: 'dateDesc', query: '',
    sizeId: 'nesthub', theme: 'dark', shown: PAGE
  };

  function byId(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function sizeOf(id) {
    var list = KC.quotecard.SIZES;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function hueOf(rec) {
    var entry = KC.state.lib && KC.state.lib[rec.bookKey];
    var hue = KC.topics.hueOf((entry && entry.topic) || 'uncategorized');
    return (hue === null || hue === undefined) ? null : hue;
  }

  function optsFor(rec, scale) {
    var s = sizeOf(view.sizeId);
    return { w: s.w, h: s.h, theme: view.theme, hue: hueOf(rec), scale: scale };
  }

  function slug(s) {
    return KC.i18n.fold(String(s || 'quote')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'quote';
  }

  // One pass for both numbers the panel shows: everything in this source, and what survives the filters.
  function lists() {
    var pool = KC.quotesort.pool(KC.state.visible || [], view.source);
    return { pool: pool, list: KC.quotesort.apply(pool, view) };
  }

  function cardNode(rec) {
    var wrap = el('figure', 'qc');
    var canvas = document.createElement('canvas');
    canvas.className = 'qc-canvas';
    try { KC.quotecard.draw(canvas, rec, optsFor(rec, PREVIEW_SCALE)); } catch (e) { /* keep the row */ }
    wrap.appendChild(canvas);

    var bar = el('figcaption', 'qc-bar');
    bar.appendChild(el('span', 'qc-title', rec.title));

    var isFav = KC.favorites.has(rec);
    var star = el('button', isFav ? 'qc-btn qc-star is-on' : 'qc-btn qc-star');
    star.appendChild(KC.icons.svg('star'));
    star.type = 'button';
    star.setAttribute('data-qc-fav', rec.id);
    star.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    star.title = KC.i18n.t('fav.toggle');
    star.setAttribute('aria-label', KC.i18n.t('fav.toggle'));
    bar.appendChild(star);

    var dl = el('button', 'qc-btn', 'JPG');
    dl.insertBefore(KC.icons.svg('download'), dl.firstChild);
    dl.type = 'button';
    dl.setAttribute('data-qc-dl', rec.id);
    dl.title = KC.i18n.t('qc.download');
    bar.appendChild(dl);

    wrap.appendChild(bar);
    return wrap;
  }

  function fillSelect(sel, opts, value) {
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    for (var i = 0; i < opts.length; i++) {
      var o = document.createElement('option');
      o.value = opts[i][0];
      o.textContent = opts[i][1];
      sel.appendChild(o);
    }
    sel.value = value;
  }

  function titleOf(key) {
    var books = KC.state.books || [];
    for (var i = 0; i < books.length; i++) if (books[i].key === key) return books[i].title;
    return key;
  }

  // A picked book survives a source switch: it stays listed with its real count, zero included.
  function fillBooks(pool) {
    var t = KC.i18n.t, books = KC.quotesort.books(pool), opts = [['all', t('qc.book.all')]], found = false, i;
    for (i = 0; i < books.length; i++) {
      opts.push([books[i].key, t('qc.book.opt', { title: books[i].title, n: books[i].n })]);
      if (books[i].key === view.bookKey) found = true;
    }
    if (view.bookKey !== 'all' && !found) {
      opts.push([view.bookKey, t('qc.book.opt', { title: titleOf(view.bookKey), n: 0 })]);
    }
    fillSelect(byId('qc-book'), opts, view.bookKey);
  }

  function fillSorts() {
    var t = KC.i18n.t, modes = KC.quotesort.MODES, opts = [], i;
    for (i = 0; i < modes.length; i++) opts.push([modes[i], t('qc.sort.' + modes[i])]);
    fillSelect(byId('qc-sort'), opts, view.mode);
  }

  function paintControls(res) {
    var t = KC.i18n.t, m = byId('quotes-modal'), i, nodes;
    nodes = m.querySelectorAll('[data-qc-src]');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('aria-pressed', nodes[i].getAttribute('data-qc-src') === view.source ? 'true' : 'false');
    }
    nodes = m.querySelectorAll('[data-qc-theme]');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('aria-pressed', nodes[i].getAttribute('data-qc-theme') === view.theme ? 'true' : 'false');
    }
    var size = byId('qc-size');
    if (size && size.value !== view.sizeId) size.value = view.sizeId;
    var q = byId('qc-q');
    if (q && q.value !== view.query) q.value = view.query;
    fillSorts();
    fillBooks(res.pool);

    var narrowed = view.bookKey !== 'all' || !!view.query;
    var count = byId('qc-count');
    count.textContent = t('qc.count', { n: res.list.length, total: res.pool.length });
    count.className = narrowed ? 'qc-count is-narrow' : 'qc-count';
    byId('qc-clear').hidden = !narrowed;
  }

  function emptyNode(res) {
    var t = KC.i18n.t, box = el('div', 'qc-empty');
    if (!res.pool.length && view.source === 'fav') {
      box.appendChild(el('p', 'qc-empty-t', t('qc.emptyFav')));
      return box;
    }
    box.appendChild(el('p', 'qc-empty-t', t('qc.empty.title')));
    box.appendChild(el('p', 'qc-empty-h', t('qc.empty.hint')));
    return box;
  }

  // The source/theme segments already ride app.js's delegated handler — these controls are ours.
  function wire() {
    if (wired) return;
    wired = true;
    byId('qc-sort').addEventListener('change', function (e) { KC.quoteview.set({ mode: e.target.value }); });
    byId('qc-book').addEventListener('change', function (e) { KC.quoteview.set({ bookKey: e.target.value }); });
    byId('qc-clear').addEventListener('click', function () { KC.quoteview.set({ bookKey: 'all', query: '' }); });
  }

  KC.quoteview = {
    state: view,

    recById: function (id) {
      var all = KC.state.visible || [];
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return null;
    },

    set: function (patch) {
      for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) view[k] = patch[k];
      if (!patch || patch.shown === undefined) view.shown = PAGE;
      KC.quoteview.render();
    },

    render: function () {
      var host = byId('quotes-grid'), foot = byId('quotes-foot'), t = KC.i18n.t;
      if (!host) return;
      while (host.firstChild) host.removeChild(host.firstChild);
      while (foot.firstChild) foot.removeChild(foot.firstChild);

      var res = lists();
      paintControls(res);
      if (!res.list.length) { host.appendChild(emptyNode(res)); return; }

      var end = Math.min(view.shown, res.list.length);
      for (var i = 0; i < end; i++) host.appendChild(cardNode(res.list[i]));

      if (end < res.list.length) {
        var more = el('button', 'btn', t('qc.more', { n: res.list.length - end }));
        more.type = 'button';
        more.setAttribute('data-qc-more', '1');
        foot.appendChild(more);
      }
      var all = el('button', 'btn primary', t('qc.downloadAll', { n: end }));
      all.type = 'button';
      all.setAttribute('data-qc-dlall', '1');
      foot.appendChild(all);
      foot.appendChild(el('span', 'qc-note', t('qc.note')));
    },

    downloadOne: function (rec) {
      var s = sizeOf(view.sizeId);
      var name = slug(rec.title) + '-' + s.w + 'x' + s.h + '.jpg';
      return KC.quotecard.download(rec, optsFor(rec, 1), name);
    },

    // Browsers throttle a burst of downloads, so they are chained one after the other.
    downloadVisible: function () {
      var list = lists().list.slice(0, view.shown), i = 0;
      if (!list.length) return;
      KC.ui.toast(KC.i18n.t('qc.downloadAll', { n: list.length }));
      (function next() {
        if (i >= list.length) { KC.ui.toast(KC.i18n.t('export.done')); return; }
        var rec = list[i++];
        KC.quoteview.downloadOne(rec).then(function () {
          setTimeout(next, 350);
        }, function () { setTimeout(next, 350); });
      })();
    },

    open: function () {
      wire();
      KC.quoteview.render();
      KC.modal.open('quotes-modal');
    },

    close: function () { KC.modal.close('quotes-modal'); }
  };
})(window.KC = window.KC || {});
