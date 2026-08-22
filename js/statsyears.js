// ---
// purpose: Year filter chips for the statistics timeline, and the month window they drive
// exports: KC.statsyears.state, chips(byYear, onChange), months(byMonth, windowSize), refresh()
// depends: js/i18n.js, js/statsview.js (refresh() re-renders the panel)
// gotcha: the selection is memory-only by design — reopening the panel must start at "all years"
// ---
(function (KC) {
  'use strict';

  var state = { years: [] };

  function fmt(key, opt) {
    var d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
    try { return new Intl.DateTimeFormat(KC.i18n.lang, opt).format(d); } catch (e) { return key; }
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

    // byMonth is already dense — pick whole years out of it, or fall back to the trailing window.
    months: function (byMonth, windowSize) {
      var out = [], i;
      if (state.years.length) {
        for (i = 0; i < byMonth.length; i++) {
          if (state.years.indexOf(Number(byMonth[i].key.slice(0, 4))) >= 0) out.push(byMonth[i]);
        }
      } else {
        out = byMonth.slice(-windowSize);
      }
      // One year holds one January, so year ticks would leave a single lonely label — use months.
      var narrow = state.years.length === 1;
      return out.map(function (m, k) {
        return {
          label: fmt(m.key, { month: 'short', year: 'numeric' }),
          count: m.count,
          tick: narrow ? fmt(m.key, { month: 'narrow' })
            : (k === 0 || m.key.slice(5, 7) === '01') ? m.key.slice(0, 4) : ''
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
