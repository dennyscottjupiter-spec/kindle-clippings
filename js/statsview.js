// ---
// purpose: Render the statistics panel — KPI tiles, timeline, years, top books, topics, rhythm, extremes;
//   each KPI tile opens a drill-down (highlights / books / notes / words) inside the same panel
// exports: KC.statsview.open(), close(), render(), mode(), setMode(m), showDetail(m)
// depends: js/stats.js, js/i18n.js, js/i18n-ux.js, js/icons.js, js/topics.js, js/modal.js, js/statsyears.js,
//   js/backnav.js (at call time — a detail view is a history step, so the phone's back returns to the overview)
// gotcha: every bar is a plain div sized in %, so there is no chart library and no canvas here
// gotcha: the timeline's bucketing and tick labels come from js/statsyears.js + js/stats.js, not here
// gotcha: the view mode is memory-only; open() always starts at the overview, like the year chips
// gotcha: anything carrying [data-book] is a jump into the reader — js/app.js handles that click
// ---
(function (KC) {
  'use strict';

  // Max columns the timeline will ever draw — the bucketing rule (KC.stats.bucketMonths) coarsens
  // months -> quarters -> years to stay within this, tuned so it never overflows a 320px viewport
  // given the CSS floor `.col { min-width: 3px }` plus its 2px gap.
  var COLUMN_BUDGET = 48;
  var TOP_BOOKS = 12;
  var MODES = ['highlights', 'books', 'notes', 'words'];
  var view = { mode: 'overview', bookSort: 'count' };
  var LATEST_NOTES = 12;
  var MONTHS_LISTED = 36;
  var WORDS_PER_PAGE = 250;  // a typical printed paperback page

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  // Overview tiles are buttons: each opens its drill-down. Detail-view tiles (mini) are plain divs.
  function tile(value, label, accent, mode, icon) {
    var n = el(mode ? 'button' : 'div', 'kpi' + (accent ? ' kpi-' + accent : '') + (mode ? ' kpi-link' : ''));
    if (mode) {
      n.type = 'button';
      n.setAttribute('data-kpi', mode);
      n.setAttribute('aria-label', label + ': ' + value + ' — ' + KC.i18n.t('st.open'));
    }
    if (icon) { var ic = el('span', 'kpi-ico'); ic.appendChild(KC.icons.svg(icon)); n.appendChild(ic); }
    n.appendChild(el('strong', 'kpi-v', value));
    n.appendChild(el('span', 'kpi-l', label));
    if (mode) {
      var go = el('span', 'kpi-go');
      go.appendChild(el('span', null, KC.i18n.t('st.open')));
      go.appendChild(KC.icons.svg('chevron'));
      n.appendChild(go);
    }
    return n;
  }

  function miniTiles(list) {
    var wrap = el('div', 'kpis kpis-mini');
    for (var i = 0; i < list.length; i++) {
      if (list[i]) wrap.appendChild(tile(list[i][0], list[i][1], list[i][2], null, list[i][3]));
    }
    return wrap;
  }

  function section(title, hint) {
    var s = el('section', 'stat-sec');
    var h = el('h3', 'stat-h', title);
    s.appendChild(h);
    if (hint) s.appendChild(el('p', 'stat-hint', hint));
    return s;
  }

  // One shared bar primitive: a labelled row whose fill is a percentage of the max.
  function barRow(label, count, max, opts) {
    var row = el('div', 'bar-row');
    var lab = el('span', 'bar-label', label);
    // The whole row is the tap target for a book (a phone thumb misses a 0.85rem label).
    if (opts && opts.book) { lab.className += ' is-link'; row.className += ' is-link'; row.setAttribute('data-book', opts.book); }
    row.appendChild(lab);
    var track = el('div', 'bar-track');
    var fill = el('div', 'bar-fill');
    fill.style.width = (max ? Math.max(2, (count / max) * 100) : 0) + '%';
    if (opts && opts.topic) {
      track.setAttribute('data-topic', opts.topic);
      var hue = KC.topics.hueOf(opts.topic);
      if (hue !== null && hue !== undefined) track.style.setProperty('--h', String(hue));
      fill.className += ' is-topic';
    }
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('span', 'bar-n', KC.i18n.num(count)));
    return row;
  }

  // A column histogram — used for months, weekdays and hours alike.
  function columns(items, max, cls) {
    var wrap = el('div', 'cols ' + (cls || ''));
    for (var i = 0; i < items.length; i++) {
      var c = el('div', 'col');
      c.title = items[i].label + ': ' + KC.i18n.num(items[i].count);
      var b = el('div', 'col-bar');
      b.style.height = (max ? Math.max(2, (items[i].count / max) * 100) : 0) + '%';
      if (!items[i].count) b.className += ' is-zero';
      c.appendChild(b);
      c.appendChild(el('span', 'col-l', items[i].tick || ''));
      wrap.appendChild(c);
    }
    return wrap;
  }

  function maxOf(list, get) {
    var m = 0;
    for (var i = 0; i < list.length; i++) m = Math.max(m, get(list[i]));
    return m;
  }

  function weekdayNames() {
    var out = [], i;
    for (i = 0; i < 7; i++) {
      var d = new Date(2024, 0, 7 + i); // 2024-01-07 is a Sunday, so i lines up with getDay()
      try {
        out.push(new Intl.DateTimeFormat(KC.i18n.lang, { weekday: 'short' }).format(d));
      } catch (e) { out.push(String(i)); }
    }
    return out;
  }

  function dayOnly(ms) {
    try {
      return new Intl.DateTimeFormat(KC.i18n.lang, { dateStyle: 'medium' }).format(new Date(ms));
    } catch (e) { return ''; }
  }

  function monthLabel(key) {
    var d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
    try { return new Intl.DateTimeFormat(KC.i18n.lang, { month: 'short', year: 'numeric' }).format(d); }
    catch (e) { return key; }
  }

  function excerpt(text, max) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
  }

  // A tappable quote/note row: excerpt, then "book · detail". The whole row jumps to the book.
  function quoteRow(text, title, bookKey, detail) {
    var row = el('button', 'st-quote');
    row.type = 'button';
    row.setAttribute('data-book', bookKey);
    row.appendChild(el('span', 'st-quote-t', excerpt(text, 220)));
    var m = el('span', 'st-quote-m');
    m.appendChild(el('span', 'st-quote-b', title));
    if (detail) m.appendChild(el('span', 'st-quote-d', detail));
    row.appendChild(m);
    return row;
  }

  function bookMetaIndex() {
    var out = {}, b = KC.state.books || [], i;
    for (i = 0; i < b.length; i++) out[b[i].key] = b[i];
    return out;
  }

  function detailHead(host, mode) {
    var t = KC.i18n.t;
    var head = el('div', 'st-dhead');
    var back = el('button', 'btn st-back');
    back.type = 'button';
    back.setAttribute('data-st-back', '1');
    back.appendChild(KC.icons.svg('back'));
    back.appendChild(el('span', 'lbl', t('st.overview')));
    head.appendChild(back);
    head.appendChild(el('h3', 'st-dtitle', t('st.' + mode)));
    host.appendChild(head);
  }

  // ---- drill-down renderers ------------------------------------------------------------------

  function renderHighlights(host, st, det) {
    var t = KC.i18n.t, i;
    host.appendChild(miniTiles([
      [KC.i18n.num(det.last30), t('st.last30'), 'a', 'calendar'],
      [KC.i18n.num(det.thisYear), t('st.thisYear'), 'b', 'stats'],
      [KC.i18n.num(st.activeDays ? Math.round((st.highlights / st.activeDays) * 10) / 10 : 0), t('st.perActiveDay'), 'c', 'clock'],
      [t('st.days', { n: st.longestStreak }), t('st.streak'), 'd', 'flame']
    ]));

    if (st.byYear.length) {
      var sy = section(t('st.byYear'), t('st.byYearHint'));
      var maxY = maxOf(st.byYear, function (y) { return y.count; });
      for (i = st.byYear.length - 1; i >= 0; i--) {
        var yr = st.byYear[i];
        var row = barRow(String(yr.year), yr.count, maxY);
        row.appendChild(el('span', 'bar-sub', t('st.yearBooks', { n: yr.books }) + ' · ' + t('st.yearWords', { n: yr.words }) +
          ' · ' + t('st.yearShare', { n: st.highlights ? Math.round((yr.count / st.highlights) * 100) : 0 })));
        sy.appendChild(row);
      }
      host.appendChild(sy);
    }

    var months = st.byMonth.filter(function (m) { return m.count > 0; }).reverse().slice(0, MONTHS_LISTED);
    if (months.length) {
      var sm = section(t('st.byMonth'), t('st.byMonthHint', { n: MONTHS_LISTED }));
      var maxM = maxOf(months, function (m) { return m.count; });
      for (i = 0; i < months.length; i++) sm.appendChild(barRow(monthLabel(months[i].key), months[i].count, maxM));
      host.appendChild(sm);
    }

    if (det.topDays.length) {
      var sd = section(t('st.topDays'));
      var maxD = det.topDays[0].count;
      for (i = 0; i < det.topDays.length; i++) sd.appendChild(barRow(dayOnly(det.topDays[i].ms), det.topDays[i].count, maxD));
      host.appendChild(sd);
    }
  }

  function renderBooks(host, st) {
    var t = KC.i18n.t, i, meta = bookMetaIndex();
    var list = st.topBooks.slice();
    if (view.bookSort === 'title') list.sort(function (a, b) { return a.title.localeCompare(b.title, KC.i18n.lang); });
    if (view.bookSort === 'recent') {
      list.sort(function (a, b) {
        return ((meta[b.key] && meta[b.key].lastMs) || 0) - ((meta[a.key] && meta[a.key].lastMs) || 0);
      });
    }
    host.appendChild(miniTiles([
      [KC.i18n.num(st.books), t('st.books'), 'a', 'books'],
      [KC.i18n.num(st.perBookAvg), t('st.perBookAvg'), 'b', 'stats'],
      st.topBooks.length ? [KC.i18n.num(st.topBooks[0].count), t('st.topBookCount'), 'c', 'trophy'] : null
    ]));

    var sec = section(t('st.allBooks'), t('st.tapBook'));
    var seg = el('div', 'seg st-seg');
    seg.setAttribute('role', 'group');
    [['count', 'st.sortCount'], ['title', 'st.sortTitle'], ['recent', 'st.sortRecent']].forEach(function (o) {
      var b = el('button', null, t(o[1]));
      b.type = 'button';
      b.setAttribute('data-st-sort', o[0]);
      b.setAttribute('aria-pressed', view.bookSort === o[0] ? 'true' : 'false');
      seg.appendChild(b);
    });
    sec.appendChild(seg);

    var maxB = maxOf(list, function (b) { return b.count; });
    for (i = 0; i < list.length; i++) {
      var bk = list[i];
      var row = barRow(bk.title, bk.count, maxB, { book: bk.key, topic: bk.topic });
      var bits = [];
      if (bk.author) bits.push(bk.author);
      if (bk.notes) bits.push(t('st.bookNotes', { n: bk.notes }));
      bits.push(t('st.yearWords', { n: bk.words }));
      if (meta[bk.key] && meta[bk.key].lastMs) bits.push(t('st.bookLast', { d: dayOnly(meta[bk.key].lastMs) }));
      row.appendChild(el('span', 'bar-sub', bits.join(' · ')));
      sec.appendChild(row);
    }
    host.appendChild(sec);
  }

  function renderNotes(host, st, det) {
    var t = KC.i18n.t, i;
    var withNotes = st.topBooks.filter(function (b) { return b.notes > 0; })
      .sort(function (a, b) { return b.notes - a.notes; });
    host.appendChild(miniTiles([
      [KC.i18n.num(st.notes), t('st.notes'), 'a', 'note'],
      [KC.i18n.num(withNotes.length), t('st.withNotes'), 'b', 'books'],
      [(st.highlights ? Math.round((det.withNote / st.highlights) * 100) : 0) + '%', t('st.noteShare'), 'c', 'quote']
    ]));
    if (!det.notes.length) { host.appendChild(el('p', 'stat-empty', t('st.noNotes'))); return; }

    if (withNotes.length) {
      var sb = section(t('st.notesPerBook'), t('st.tapBook'));
      for (i = 0; i < withNotes.length; i++) {
        sb.appendChild(barRow(withNotes[i].title, withNotes[i].notes, withNotes[0].notes,
          { book: withNotes[i].key, topic: withNotes[i].topic }));
      }
      host.appendChild(sb);
    }

    var sl = section(t('st.latestNotes'));
    var list = el('div', 'st-quotes');
    for (i = 0; i < Math.min(LATEST_NOTES, det.notes.length); i++) {
      var n = det.notes[i];
      list.appendChild(quoteRow(n.text, n.title, n.bookKey, n.dateMs ? dayOnly(n.dateMs) : ''));
    }
    sl.appendChild(list);
    host.appendChild(sl);
  }

  function renderWords(host, st, det) {
    var t = KC.i18n.t, i;
    host.appendChild(miniTiles([
      [KC.i18n.num(st.words), t('st.words'), 'a', 'words'],
      [KC.i18n.num(st.avgWords), t('st.avgWords'), 'b', 'quote'],
      [KC.i18n.num(Math.max(1, Math.round(st.words / WORDS_PER_PAGE))), t('st.pages'), 'c', 'book']
    ]));

    var sl = section(t('st.lengths'), t('st.lengthsHint'));
    var maxL = maxOf(det.lengths, function (l) { return l.count; });
    for (i = 0; i < det.lengths.length; i++) {
      sl.appendChild(barRow(t('st.len.' + det.lengths[i].id), det.lengths[i].count, maxL));
    }
    host.appendChild(sl);

    var byWords = st.topBooks.slice().sort(function (a, b) { return b.words - a.words; }).slice(0, TOP_BOOKS);
    if (byWords.length) {
      var sb = section(t('st.wordsPerBook'), t('st.tapBook'));
      for (i = 0; i < byWords.length; i++) {
        sb.appendChild(barRow(byWords[i].title, byWords[i].words, byWords[0].words,
          { book: byWords[i].key, topic: byWords[i].topic }));
      }
      host.appendChild(sb);
    }

    if (det.longest.length) {
      var sq = section(t('st.longestN'));
      var list = el('div', 'st-quotes');
      for (i = 0; i < det.longest.length; i++) {
        var h = det.longest[i];
        list.appendChild(quoteRow(h.text, h.title, h.bookKey, t('st.yearWords', { n: h.words })));
      }
      sq.appendChild(list);
      host.appendChild(sq);
    }
  }

  KC.statsview = {
    render: function () {
      var host = document.getElementById('stats-body');
      var t = KC.i18n.t, i;
      while (host.firstChild) host.removeChild(host.firstChild);
      if (!KC.state.stats) { host.appendChild(el('p', 'stat-empty', t('empty.noFile'))); return; }

      var st = KC.stats.compute(KC.state.visible, KC.state.books, KC.state.lib || {});

      if (view.mode !== 'overview') {
        var det = KC.stats.details(KC.state.visible, Date.now());
        var wrapD = el('div', 'st-detail st-detail-' + view.mode);
        detailHead(wrapD, view.mode);
        if (view.mode === 'highlights') renderHighlights(wrapD, st, det);
        if (view.mode === 'books') renderBooks(wrapD, st);
        if (view.mode === 'notes') renderNotes(wrapD, st, det);
        if (view.mode === 'words') renderWords(wrapD, st, det);
        host.appendChild(wrapD);
        return;
      }

      var kpis = el('div', 'kpis');
      kpis.appendChild(tile(KC.i18n.num(st.highlights), t('st.highlights'), 'a', 'highlights', 'quote'));
      kpis.appendChild(tile(KC.i18n.num(st.books), t('st.books'), 'b', 'books', 'books'));
      kpis.appendChild(tile(KC.i18n.num(st.notes), t('st.notes'), 'c', 'notes', 'note'));
      kpis.appendChild(tile(KC.i18n.num(st.words), t('st.words'), 'd', 'words', 'words'));
      host.appendChild(kpis);

      if (st.byMonth.length) {
        var sec = section(t('st.timeline'), t('st.timelineHint'));
        sec.appendChild(el('h4', 'stat-sub', t('st.years')));
        sec.appendChild(el('p', 'stat-hint', t('st.yearsHint')));
        sec.appendChild(KC.statsyears.chips(st.byYear, KC.statsyears.refresh));
        var timeline = KC.statsyears.timeline(st.byMonth, COLUMN_BUDGET);
        sec.appendChild(columns(timeline, maxOf(timeline, function (m) { return m.count; }), 'cols-months'));
        host.appendChild(sec);
      }

      if (st.byYear.length > 1) {
        var sy = section(t('st.byYear'), t('st.byYearHint'));
        var maxY = maxOf(st.byYear, function (y) { return y.count; });
        for (i = st.byYear.length - 1; i >= 0; i--) {
          var yr = st.byYear[i];
          var yrow = barRow(String(yr.year), yr.count, maxY);
          yrow.title = t('st.yearBooks', { n: yr.books }) + ' · ' + t('st.yearWords', { n: yr.words }) +
            ' · ' + t('st.yearShare', { n: st.highlights ? Math.round((yr.count / st.highlights) * 100) : 0 });
          sy.appendChild(yrow);
        }
        host.appendChild(sy);
      }

      if (st.topBooks.length) {
        var sb = section(t('st.topBooks'));
        var maxB = st.topBooks[0].count;
        for (i = 0; i < Math.min(TOP_BOOKS, st.topBooks.length); i++) {
          sb.appendChild(barRow(st.topBooks[i].title, st.topBooks[i].count, maxB,
            { book: st.topBooks[i].key, topic: st.topBooks[i].topic }));
        }
        host.appendChild(sb);
      }

      if (st.topics.length > 1) {
        var sto = section(t('st.topics'), t('st.topicsHint'));
        var maxT = st.topics[0].count;
        for (i = 0; i < st.topics.length; i++) {
          sto.appendChild(barRow(KC.topics.label(st.topics[i].topic), st.topics[i].count, maxT,
            { topic: st.topics[i].topic }));
        }
        host.appendChild(sto);
      }

      var rhythm = section(t('st.rhythm'), t('st.rhythmHint'));
      var names = weekdayNames();
      var wd = st.byWeekday.map(function (n, k) { return { label: names[k], count: n, tick: names[k].slice(0, 2) }; });
      rhythm.appendChild(el('h4', 'stat-sub', t('st.weekday')));
      rhythm.appendChild(columns(wd, maxOf(wd, function (m) { return m.count; }), 'cols-week'));
      var hrs = st.byHour.map(function (n, k) {
        return { label: (k < 10 ? '0' + k : k) + 'h', count: n, tick: k % 6 === 0 ? String(k) : '' };
      });
      rhythm.appendChild(el('h4', 'stat-sub', t('st.hour')));
      rhythm.appendChild(columns(hrs, maxOf(hrs, function (m) { return m.count; }), 'cols-hours'));
      host.appendChild(rhythm);

      var facts = section(t('st.extremes'));
      var dl = el('dl', 'facts');
      function fact(k, v) {
        if (!v) return;
        dl.appendChild(el('dt', null, k));
        dl.appendChild(el('dd', null, v));
      }
      fact(t('st.avgWords'), KC.i18n.num(st.avgWords));
      fact(t('st.perBookAvg'), KC.i18n.num(st.perBookAvg));
      if (st.longest) fact(t('st.longest'), KC.i18n.num(st.longest.words) + ' — ' + st.longest.title);
      if (st.busiestDay) fact(t('st.busiestDay'), dayOnly(st.busiestDay.ms) + ' (' + KC.i18n.num(st.busiestDay.count) + ')');
      if (st.longestStreak) fact(t('st.streak'), t('st.days', { n: st.longestStreak }));
      if (st.activeDays) fact(t('st.activeDays'), t('st.days', { n: st.activeDays }));
      if (st.firstMs) fact(t('st.first'), dayOnly(st.firstMs));
      if (st.lastMs) fact(t('st.last'), dayOnly(st.lastMs));
      facts.appendChild(dl);
      host.appendChild(facts);
    },

    open: function () {
      // A fresh open starts at the overview; js/backnav.js sets the mode first when it re-opens.
      if (!(KC.backnav && KC.backnav.restoring())) view.mode = 'overview';
      KC.statsview.render();
      KC.modal.open('stats-modal');
    },

    close: function () { KC.modal.close('stats-modal'); },

    mode: function () { return view.mode; },
    setMode: function (m) { view.mode = (m === 'overview' || MODES.indexOf(m) !== -1) ? m : 'overview'; },

    // A tile tap: record where we are (so back returns to it), then switch and repaint from the top.
    showDetail: function (m) {
      if (MODES.indexOf(m) === -1 || view.mode === m) return;
      if (KC.backnav) KC.backnav.push('nav');
      view.mode = m;
      KC.statsview.render();
      var body = document.getElementById('stats-body');
      if (body) body.scrollTop = 0;
    },

    // Wired once from here, not app.js: tiles, the detail ← button and the books sort live only in
    // this panel. [data-book] taps fall through to js/app.js's own stats-body listener.
    install: function () {
      var body = document.getElementById('stats-body');
      if (!body) return;
      body.addEventListener('click', function (e) {
        var hit = e.target.closest ? e.target.closest('[data-kpi],[data-st-back],[data-st-sort]') : null;
        if (!hit) return;
        if (hit.hasAttribute('data-kpi')) { KC.statsview.showDetail(hit.getAttribute('data-kpi')); return; }
        if (hit.hasAttribute('data-st-sort')) {
          view.bookSort = hit.getAttribute('data-st-sort');
          KC.statsview.render();
          return;
        }
        // ← overview: walk the history step back when there is one, else just switch
        if (KC.backnav && KC.backnav.canBack()) KC.backnav.back();
        else { view.mode = 'overview'; KC.statsview.render(); }
      });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', KC.statsview.install);
  else KC.statsview.install();
})(window.KC = window.KC || {});
