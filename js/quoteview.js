// ---
// purpose: Quote-card panel — pick starred highlights, preview them as images, download PNGs
// exports: KC.quoteview.open(), close(), render(), refreshStars()
// depends: js/quotecard.js, js/favorites.js, js/i18n.js, js/topics.js, js/modal.js
// gotcha: previews draw at PREVIEW_SCALE to stay cheap; the download always redraws at scale 1
// ---
(function (KC) {
  'use strict';

  var PREVIEW_SCALE = 0.42;
  var PAGE = 18;

  var view = { source: 'fav', query: '', sizeId: 'nesthub', theme: 'dark', shown: PAGE };

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

  function pool() {
    var s = KC.state, out = [], i;
    var all = s.visible || [];
    var highlights = [];
    for (i = 0; i < all.length; i++) {
      if ((all[i].type === 'highlight' || all[i].type === 'clipping') && all[i].text) highlights.push(all[i]);
    }
    out = view.source === 'fav' ? KC.favorites.pick(highlights) : highlights;
    if (!view.query) return out;
    var q = KC.i18n.fold(view.query);
    return out.filter(function (r) {
      return KC.i18n.fold(r.text + ' ' + r.title).indexOf(q) !== -1;
    });
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
    var star = el('button', isFav ? 'qc-btn is-on' : 'qc-btn', '★');
    star.type = 'button';
    star.setAttribute('data-qc-fav', rec.id);
    star.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    star.title = KC.i18n.t('fav.toggle');
    bar.appendChild(star);

    var dl = el('button', 'qc-btn', '↓ PNG');
    dl.type = 'button';
    dl.setAttribute('data-qc-dl', rec.id);
    dl.title = KC.i18n.t('qc.download');
    bar.appendChild(dl);

    wrap.appendChild(bar);
    return wrap;
  }

  function paintControls() {
    var m = document.getElementById('quotes-modal');
    var i, nodes = m.querySelectorAll('[data-qc-src]');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('aria-pressed', nodes[i].getAttribute('data-qc-src') === view.source ? 'true' : 'false');
    }
    nodes = m.querySelectorAll('[data-qc-theme]');
    for (i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('aria-pressed', nodes[i].getAttribute('data-qc-theme') === view.theme ? 'true' : 'false');
    }
    var sel = document.getElementById('qc-size');
    if (sel && sel.value !== view.sizeId) sel.value = view.sizeId;
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
      var host = document.getElementById('quotes-grid');
      var foot = document.getElementById('quotes-foot');
      var t = KC.i18n.t;
      if (!host) return;
      while (host.firstChild) host.removeChild(host.firstChild);
      while (foot.firstChild) foot.removeChild(foot.firstChild);
      paintControls();

      var list = pool();
      if (!list.length) {
        host.appendChild(el('p', 'stat-empty',
          t(view.source === 'fav' ? 'qc.emptyFav' : 'empty.noResults')));
        return;
      }

      var end = Math.min(view.shown, list.length);
      for (var i = 0; i < end; i++) host.appendChild(cardNode(list[i]));

      if (end < list.length) {
        var more = el('button', 'btn', t('qc.more', { n: list.length - end }));
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
      var name = slug(rec.title) + '-' + s.w + 'x' + s.h + '.png';
      return KC.quotecard.download(rec, optsFor(rec, 1), name);
    },

    // Browsers throttle a burst of downloads, so they are chained one after the other.
    downloadVisible: function () {
      var list = pool().slice(0, view.shown), i = 0;
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
      KC.quoteview.render();
      KC.modal.open('quotes-modal');
    },

    close: function () { KC.modal.close('quotes-modal'); }
  };
})(window.KC = window.KC || {});
