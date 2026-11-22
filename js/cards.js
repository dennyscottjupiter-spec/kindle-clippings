// ---
// purpose: Build one highlight card + group header, and paginate the list behind an IntersectionObserver
// exports: KC.cards.build(rec), groupHead(rec), reset(), appendPage(), observe(), actBtn(cls, icon, label)
// depends: js/i18n.js, js/icons.js, js/clean.js (record shape), js/topics.js (group header label/hue), js/favorites.js
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

  function locRange(rec) {
    if (rec.locStart === null || rec.locStart === undefined) return '';
    return rec.locEnd && rec.locEnd !== rec.locStart ? rec.locStart + '–' + rec.locEnd : String(rec.locStart);
  }

  // An icon + text pill for the info row (page, location).
  function chip(cls, icon, text) {
    var n = el('span', cls);
    n.appendChild(KC.icons.svg(icon));
    n.appendChild(el('span', null, text));
    return n;
  }

  // One action-tray button: icon over (phone) or beside (desktop) a short label. Shared shape with
  // js/cardactions.js, which builds the same structure for its own buttons.
  function actBtn(cls, icon, label) {
    var b = el('button', 'act ' + cls);
    b.type = 'button';
    b.appendChild(KC.icons.svg(icon));
    b.appendChild(el('span', 'act-lbl', label));
    return b;
  }

  // "23 mar 2015, 00:22" — the long form (KC.i18n.date) wraps badly in a phone-width chip, so it
  // moves to the tooltip and the chip keeps the medium one.
  function shortDate(ms) {
    try {
      return new Intl.DateTimeFormat(KC.i18n.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
    } catch (e) { return KC.i18n.date(ms); }
  }

  // "3 months ago" for the date's tooltip — Intl.RelativeTimeFormat, absent on very old browsers.
  var REL_STEPS = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30.44, 'day'], [12, 'month'], [Infinity, 'year']];
  function relative(ms) {
    if (typeof Intl === 'undefined' || !Intl.RelativeTimeFormat) return '';
    var v = (ms - Date.now()) / 1000, i;
    for (i = 0; i < REL_STEPS.length; i++) {
      if (Math.abs(v) < REL_STEPS[i][0]) break;
      v /= REL_STEPS[i][0];
    }
    try {
      return new Intl.RelativeTimeFormat(KC.i18n.lang, { numeric: 'auto' }).format(Math.round(v), REL_STEPS[i][1]);
    } catch (e) { return ''; }
  }

  function flag(cls, text) {
    return el('span', 'card-flag ' + cls, text);
  }

  // Shared by build() and groupHead() — a record's topic comes from its book, not itself.
  function topicOf(rec) {
    return (KC.state.lib[rec.bookKey] && KC.state.lib[rec.bookKey].topic) || 'uncategorized';
  }

  KC.cards = {
    actBtn: actBtn,

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
        var nl = el('span', 'note-label');
        nl.appendChild(KC.icons.svg('note'));
        nl.appendChild(el('span', null, KC.i18n.t('card.noteLabel').replace(/:$/, '')));
        wrap.appendChild(nl);
        wrap.appendChild(el('p', 'note-text', rec.note.text));
        art.appendChild(wrap);
      }

      // Footer = an info row (where + when) over an action tray. js/cardactions.js appends its JPG +
      // export buttons into .meta-actions, so the tray must exist before appendPage returns.
      var meta = el('div', 'meta');
      var info = el('div', 'meta-info');
      info.appendChild(el('span', 'book', rec.title));
      if (rec.page) info.appendChild(chip('loc loc-page', 'page', KC.i18n.t('meta.page', { n: rec.page })));
      var range = locRange(rec);
      if (range) info.appendChild(chip('loc loc-pos', 'pin', KC.i18n.t('meta.loc', { range: range })));

      if (rec.dateMs || rec.dateRaw) {
        var t = el('time', 'when');
        t.appendChild(KC.icons.svg('calendar'));
        t.appendChild(el('span', null, rec.dateMs ? shortDate(rec.dateMs) : rec.dateRaw));
        if (rec.dateMs) {
          t.setAttribute('datetime', new Date(rec.dateMs).toISOString());
          var ago = relative(rec.dateMs);
          t.title = KC.i18n.date(rec.dateMs) + (ago ? ' · ' + ago : '');
        }
        info.appendChild(t);
      }

      if (rec.duplicates && rec.duplicates.length) {
        info.appendChild(flag('flag-dup', KC.i18n.t('card.duplicatesHidden', { n: rec.duplicates.length })));
      }
      if (rec.hiddenReason === 'duplicate') info.appendChild(flag('flag-dup', KC.i18n.t('card.possibleDuplicate')));
      if (rec.truncated) info.appendChild(flag('flag-trunc', KC.i18n.t('card.truncated')));
      if (rec.noteMatch === 'near') info.appendChild(flag('flag-near', '≈ ' + KC.i18n.t('card.noteNear')));
      meta.appendChild(info);

      var acts = el('div', 'meta-actions');
      var isFav = KC.favorites.has(rec);
      var fav = actBtn('fav', 'star', KC.i18n.t(isFav ? 'card.starred' : 'card.star'));
      if (isFav) fav.className += ' is-on';
      fav.setAttribute('data-fav', rec.id);
      fav.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      fav.setAttribute('aria-label', KC.i18n.t('fav.toggle'));
      fav.title = KC.i18n.t('fav.toggle');
      acts.appendChild(fav);

      var copy = actBtn('copy', 'copy', KC.i18n.t('card.copy'));
      copy.setAttribute('data-copy', rec.id);
      acts.appendChild(copy);
      meta.appendChild(acts);

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
