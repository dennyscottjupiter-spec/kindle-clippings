// ---
// purpose: Render the statistics panel — KPI tiles, timeline, years, top books, topics, rhythm, extremes
// exports: KC.statsview.open(), close(), render()
// depends: js/stats.js, js/i18n.js, js/topics.js, js/modal.js, js/statsyears.js
// gotcha: every bar is a plain div sized in %, so there is no chart library and no canvas here
// gotcha: the timeline's bucketing and tick labels come from js/statsyears.js + js/stats.js, not here
// ---
(function (KC) {
  'use strict';

  // Max columns the timeline will ever draw — the bucketing rule (KC.stats.bucketMonths) coarsens
  // months -> quarters -> years to stay within this, tuned so it never overflows a 320px viewport
  // given the CSS floor `.col { min-width: 3px }` plus its 2px gap.
  var COLUMN_BUDGET = 48;
  var TOP_BOOKS = 12;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function tile(value, label, accent) {
    var n = el('div', 'kpi' + (accent ? ' kpi-' + accent : ''));
    n.appendChild(el('strong', 'kpi-v', value));
    n.appendChild(el('span', 'kpi-l', label));
    return n;
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
    if (opts && opts.book) { lab.className += ' is-link'; lab.setAttribute('data-book', opts.book); }
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

  KC.statsview = {
    render: function () {
      var host = document.getElementById('stats-body');
      var t = KC.i18n.t, i;
      while (host.firstChild) host.removeChild(host.firstChild);
      if (!KC.state.stats) { host.appendChild(el('p', 'stat-empty', t('empty.noFile'))); return; }

      var st = KC.stats.compute(KC.state.visible, KC.state.books, KC.state.lib || {});

      var kpis = el('div', 'kpis');
      kpis.appendChild(tile(KC.i18n.num(st.highlights), t('st.highlights'), 'a'));
      kpis.appendChild(tile(KC.i18n.num(st.books), t('st.books'), 'b'));
      kpis.appendChild(tile(KC.i18n.num(st.notes), t('st.notes'), 'c'));
      kpis.appendChild(tile(KC.i18n.num(st.words), t('st.words'), 'd'));
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
      KC.statsview.render();
      KC.modal.open('stats-modal');
    },

    close: function () { KC.modal.close('stats-modal'); }
  };
})(window.KC = window.KC || {});
