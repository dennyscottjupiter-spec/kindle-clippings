// ---
// purpose: Build one highlight card + group header, and paginate the list behind an IntersectionObserver
// exports: KC.cards.build(rec), KC.cards.groupHead(rec), KC.cards.reset(), KC.cards.appendPage(), KC.cards.observe()
// depends: js/i18n.js, js/clean.js (record shape), js/topics.js (group header label/hue), js/favorites.js
// gotcha: DOM is built with createElement + textContent only — highlight text is untrusted input
// ---
(function (KC) {
  'use strict';

  var PAGE = 200;
  var observer = null;
  var sentinelNode = null;
  var lastGroup = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function locLabel(rec) {
    var out = [];
    if (rec.page) out.push(KC.i18n.t('meta.page', { n: rec.page }));
    if (rec.locStart !== null && rec.locStart !== undefined) {
      var range = rec.locEnd && rec.locEnd !== rec.locStart ? rec.locStart + '–' + rec.locEnd : String(rec.locStart);
      out.push(KC.i18n.t('meta.loc', { range: range }));
    }
    return out.join(' · ');
  }

  function flag(cls, text) {
    return el('span', 'card-flag ' + cls, text);
  }

  // Shared by build() and groupHead() — a record's topic comes from its book, not itself.
  function topicOf(rec) {
    return (KC.state.lib[rec.bookKey] && KC.state.lib[rec.bookKey].topic) || 'uncategorized';
  }

  KC.cards = {
    build: function (rec) {
      var art = el('article', 'entry');
      art.setAttribute('data-id', rec.id);
      art.setAttribute('data-type', rec.type);
      if (rec.tag) art.setAttribute('data-tag', rec.tag);
      if (rec.hiddenReason) art.className += ' is-hidden-record';
      if (KC.favorites.has(rec)) art.className += ' is-fav';

      // Drives the topic rail in reader.css (var(--topic-edge) is only defined under [data-topic]).
      var topicId = topicOf(rec);
      art.setAttribute('data-topic', topicId);
      var hue = KC.topics.hueOf(topicId);
      if (hue !== null && hue !== undefined) art.style.setProperty('--h', String(hue));

      var q = el('p', 'q');
      q.appendChild(el('span', 'q-text', rec.text || KC.i18n.t('type.' + rec.type)));
      // In the DOM, invisible, no layout — but it rides along with a selection copy.
      if (rec.tag) q.appendChild(el('span', 'sr-only', ' ' + rec.tag));
      art.appendChild(q);

      if (rec.note && rec.note.text) {
        var wrap = el('div', 'note-attached');
        wrap.appendChild(el('p', 'note-text', rec.note.text));
        art.appendChild(wrap);
      }

      var meta = el('div', 'meta');
      meta.appendChild(el('span', 'book', rec.title));
      var loc = locLabel(rec);
      if (loc) meta.appendChild(el('span', 'loc', loc));

      var t = el('time', null, rec.dateMs ? KC.i18n.date(rec.dateMs) : rec.dateRaw);
      if (rec.dateMs) t.setAttribute('datetime', new Date(rec.dateMs).toISOString());
      meta.appendChild(t);

      if (rec.duplicates && rec.duplicates.length) {
        meta.appendChild(flag('flag-dup', KC.i18n.t('card.duplicatesHidden', { n: rec.duplicates.length })));
      }
      if (rec.hiddenReason === 'duplicate') meta.appendChild(flag('flag-dup', KC.i18n.t('card.possibleDuplicate')));
      if (rec.truncated) meta.appendChild(flag('flag-trunc', KC.i18n.t('card.truncated')));
      if (rec.noteMatch === 'near') meta.appendChild(flag('flag-near', '≈ ' + KC.i18n.t('card.noteNear')));

      var isFav = KC.favorites.has(rec);
      var fav = el('button', isFav ? 'fav is-on' : 'fav', '★');
      fav.type = 'button';
      fav.setAttribute('data-fav', rec.id);
      fav.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      fav.setAttribute('aria-label', KC.i18n.t('fav.toggle'));
      fav.title = KC.i18n.t('fav.toggle');
      meta.appendChild(fav);

      var copy = el('button', 'copy', KC.i18n.t('card.copy'));
      copy.type = 'button';
      copy.setAttribute('data-copy', rec.id);
      meta.appendChild(copy);

      art.appendChild(meta);
      return art;
    },

    groupHead: function (rec) {
      var mode = KC.state.sortMode;
      var isTopic = mode === 'topic';
      var topicId = isTopic ? rec._group : topicOf(rec);
      var h = el('h3', 'group-head');
      h.setAttribute('data-topic', topicId);
      var hue = KC.topics.hueOf(topicId);
      if (hue !== null && hue !== undefined) h.style.setProperty('--h', String(hue));
      h.appendChild(el('span', 'gh-dot'));
      h.appendChild(el('span', 'gh-label', isTopic ? KC.topics.label(topicId) : rec.title));
      return h;
    },

    reset: function () {
      var host = document.getElementById('cards');
      while (host.firstChild) host.removeChild(host.firstChild);
      KC.state.rendered = 0;
      lastGroup = null;
    },

    appendPage: function () {
      var s = KC.state;
      if (s.rendered >= s.filtered.length) return 0;
      var host = document.getElementById('cards');
      var frag = document.createDocumentFragment();
      var end = Math.min(s.rendered + PAGE, s.filtered.length);

      for (var i = s.rendered; i < end; i++) {
        var rec = s.filtered[i];
        if (rec._group && rec._group !== lastGroup) {
          frag.appendChild(KC.cards.groupHead(rec));
          lastGroup = rec._group;
        }
        frag.appendChild(KC.cards.build(rec));
      }
      host.appendChild(frag);
      var drawn = s.rendered;
      s.rendered = end;
      return end - drawn;
    },

    // The root MUST be the scrolling pane: with a null root in a two-pane layout the
    // sentinel either never fires or fires forever. Reconnect only when the node changed.
    observe: function () {
      var node = document.getElementById('sentinel');
      if (observer && node === sentinelNode) return;
      if (observer) observer.disconnect();
      sentinelNode = node;
      observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) KC.cards.appendPage();
      }, { root: document.getElementById('main'), rootMargin: '400px' });
      observer.observe(node);
    }
  };
})(window.KC = window.KC || {});
