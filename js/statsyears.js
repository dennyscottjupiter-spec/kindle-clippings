// ---
// purpose: Year filter chips for the statistics timeline, and the adaptive column list they drive
// exports: KC.statsyears.state, chips(byYear, onChange), timeline(byMonth, budget), refresh()
// depends: js/i18n.js, js/stats.js (bucketMonths), js/statsview.js (refresh() re-renders the panel)
// gotcha: the selection is memory-only by design — reopening the panel must start at "all years"
// gotcha: granularity (month/quarter/year) comes from KC.stats.bucketMonths, not decided here
// ---
(function (KC) {
  'use strict';

  var state = { years: [] };
  var YEAR_TICK_MAX = 10; // caps how many year-granularity labels can be on screen at once

  function fmt(key, opt) {
    var d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
    try { return new Intl.DateTimeFormat(KC.i18n.lang, opt).format(d); } catch (e) { return key; }
  }

  // Tooltip text (the full "label: count" shown on hover) — one form per granularity.
  function labelOf(key, granularity) {
    if (granularity === 'month') return fmt(key, { month: 'short', year: 'numeric' });
    if (granularity === 'quarter') return 'Q' + key.slice(6) + ' ' + key.slice(0, 4);
    return key; // year bucket key IS the year
  }

  // Short axis tick — sparse by design, so labels never sit closer than they can be read.
  function tickOf(bucket, k, total, granularity, narrow) {
    if (granularity === 'month') {
      if (narrow) return fmt(bucket.key, { month: 'narrow' });
      return (k === 0 || bucket.key.slice(5, 7) === '01') ? bucket.key.slice(0, 4) : '';
    }
    if (granularity === 'quarter') {
      return (k === 0 || bucket.key.slice(5) === 'Q1') ? bucket.key.slice(0, 4) : '';
    }
    var stride = Math.max(1, Math.ceil(total / YEAR_TICK_MAX));
    return (k % stride === 0) ? bucket.key : '';
  }

  // `year` null is the "all" chip — it clears the selection instead of toggling one year.
  function chip(label, year, on, onChange) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip yr-chip';
    b.textContent = label;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', function () {
      var k = state.years.indexOf(year);
      if (year === null) state.years.length = 0;
      else if (k >= 0) state.years.splice(k, 1);
      else state.years.push(year);
      onChange();
    });
    return b;
  }

  KC.statsyears = {
    state: state,

    chips: function (byYear, onChange) {
      var wrap = document.createElement('div');
      wrap.className = 'stat-years';
      wrap.appendChild(chip(KC.i18n.t('st.allYears'), null, !state.years.length, onChange));
      for (var i = 0; i < byYear.length; i++) {
        wrap.appendChild(chip(String(byYear[i].year), byYear[i].year,
          state.years.indexOf(byYear[i].year) >= 0, onChange));
      }
      return wrap;
    },

    // byMonth is already dense — narrow it to the selected years (if any), then hand the whole
    // remaining span to KC.stats.bucketMonths so it renders in full at whatever granularity
    // keeps it within `budget` columns. A short selection naturally stays monthly.
    timeline: function (byMonth, budget) {
      var picked = byMonth;
      if (state.years.length) {
        picked = [];
        for (var i = 0; i < byMonth.length; i++) {
          if (state.years.indexOf(Number(byMonth[i].key.slice(0, 4))) >= 0) picked.push(byMonth[i]);
        }
      }
      var b = KC.stats.bucketMonths(picked, budget);
      // One selected year holds one January, so a year tick would be a single lonely label —
      // only possible at month granularity, since a coarser one already spans multiple years.
      var narrow = b.granularity === 'month' && state.years.length === 1;
      return b.buckets.map(function (bucket, k) {
        return {
          label: labelOf(bucket.key, b.granularity),
          count: bucket.count,
          tick: tickOf(bucket, k, b.buckets.length, b.granularity, narrow)
        };
      });
    },

    // render() rebuilds #stats-body wholesale, and #stats-body is itself the scrolling .modal-body,
    // so a chip click would jump the panel back to the top without holding its scroll position.
    refresh: function () {
      var host = document.getElementById('stats-body');
      var top = host.scrollTop;
      KC.statsview.render();
      host.scrollTop = top;
    }
  };
})(window.KC = window.KC || {});
