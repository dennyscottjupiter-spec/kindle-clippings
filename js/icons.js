// ---
// purpose: One small set of hand-drawn line icons (24×24, 2px stroke, round caps) shared by both pages
// exports: KC.icons.svg(name, cls), hydrate(root), swap(host, name), paintTheme(), effectiveTheme(), NAMES
// depends: js/i18n.js at call time only (paintTheme) — loaded right after the i18n packs on index.html AND shelf.html
// gotcha: markup asks for an icon with an EMPTY <span data-icon="name"></span>; hydrate() fills it once
//   at DOMContentLoaded. Never put data-i18n on the same element — applyStrings() sets textContent,
//   which would wipe the <svg>. Put the label in a sibling <span class="lbl" data-i18n="…">.
// gotcha: built with createElementNS from the constant table below — never innerHTML
// ---
(function (KC) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // Each icon is a list of shapes: p = path d, c = stroked circle "cx cy r", f = filled dot "cx cy r",
  // r = rounded rect "x y w h rx". Kept terse on purpose; every one is drawn on a 24-unit grid.
  var ICONS = {
    back:     [['p', 'M19 12H5'], ['p', 'M11 18l-6-6 6-6']],
    more:     [['f', '5 12 1.7'], ['f', '12 12 1.7'], ['f', '19 12 1.7']],
    books:    [['r', '3.5 4 4 16 1'], ['r', '9.5 4 4 16 1'], ['p', 'M15.6 6.2l3.7-1 3.2 14.3-3.7 1z']],
    stats:    [['p', 'M3 20.5h18'], ['p', 'M6.5 16.5v-5'], ['p', 'M11 16.5V5.5'], ['p', 'M15.5 16.5v-8'], ['p', 'M20 16.5v-3']],
    quote:    [['p', 'M10 11H6.5a.5.5 0 0 1-.5-.5V7.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V12c0 2.5-1.3 4.2-3.8 5'],
               ['p', 'M18.5 11H15a.5.5 0 0 1-.5-.5V7.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V12c0 2.5-1.3 4.2-3.8 5']],
    image:    [['r', '3 4 18 16 2.5'], ['c', '8.5 9.5 1.6'], ['p', 'M21 15.5l-5-5L5.5 20']],
    share:    [['p', 'M4.5 13v5.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V13'], ['p', 'M12 15V3.5'], ['p', 'M7.5 8L12 3.5 16.5 8']],
    download: [['p', 'M12 3.5V15'], ['p', 'M7.5 10.5L12 15l4.5-4.5'], ['p', 'M4.5 20h15']],
    upload:   [['p', 'M12 15V3.5'], ['p', 'M7.5 8L12 3.5 16.5 8'], ['p', 'M4.5 20h15']],
    cards:    [['r', '3 7.5 13 13 2'], ['p', 'M7.5 4h11A2.5 2.5 0 0 1 21 6.5v11']],
    help:     [['c', '12 12 9'], ['p', 'M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4'], ['f', '12 16.9 1.1']],
    info:     [['c', '12 12 9'], ['p', 'M12 11v5.5'], ['f', '12 7.7 1.1']],
    sun:      [['c', '12 12 4'], ['p', 'M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4']],
    moon:     [['p', 'M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z']],
    star:     [['p', 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6-4.5-4.2 6.1-.8z']],
    copy:     [['r', '8.5 8.5 12 12 2'], ['p', 'M15.5 5.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5']],
    check:    [['p', 'M5 12.5l4.5 4.5L19 7.5']],
    calendar: [['r', '3.5 5 17 15.5 2.5'], ['p', 'M3.5 10h17'], ['p', 'M8 3v4M16 3v4']],
    page:     [['p', 'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z'], ['p', 'M13.5 3.5v5h5'], ['p', 'M9 13h6M9 16.5h4']],
    pin:      [['p', 'M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z'], ['c', '12 9.8 2.2']],
    reset:    [['p', 'M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5'], ['p', 'M4 4v4.5h4.5'], ['p', 'M4 12.5a8 8 0 0 0 13.7 5.2l2.3-2.2'], ['p', 'M20 20v-4.5h-4.5']],
    close:    [['p', 'M6 6l12 12M18 6L6 18']],
    chevron:  [['p', 'M9.5 6l6 6-6 6']],
    book:     [['p', 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z'], ['p', 'M5 20.5A2.5 2.5 0 0 0 7.5 21H19']],
    note:     [['p', 'M4 20h4.2L19.5 8.7a2.1 2.1 0 0 0-3-3L5 17.2z'], ['p', 'M14.5 7.5l3 3']],
    words:    [['p', 'M4.5 7V4.5h15V7'], ['p', 'M12 4.5v15'], ['p', 'M9 19.5h6']],
    layers:   [['p', 'M12 3.5l8.5 4.5-8.5 4.5L3.5 8z'], ['p', 'M3.5 12.5l8.5 4.5 8.5-4.5'], ['p', 'M3.5 16.5l8.5 4.5 8.5-4.5']],
    flame:    [['p', 'M12 21a6 6 0 0 1-6-6c0-3.6 3-5.7 3.8-9.5 2.2 1.5 3.4 3.5 3.5 5.8.9-.6 1.5-1.6 1.7-2.8 1.9 1.6 3 3.8 3 6.5a6 6 0 0 1-6 6z']],
    clock:    [['c', '12 12 9'], ['p', 'M12 7v5l3.2 2']],
    trophy:   [['p', 'M8 4.5h8v5a4 4 0 0 1-8 0z'], ['p', 'M8 6.5H4.5v1.5A3 3 0 0 0 8 11M16 6.5h3.5v1.5A3 3 0 0 1 16 11'], ['p', 'M12 13.5v4M8 20.5h8M9.5 20.5v-3h5v3']]
  };

  function nums(s) { return s.split(' ').map(Number); }

  function shape(spec) {
    var kind = spec[0], v = spec[1], n;
    if (kind === 'p') {
      n = document.createElementNS(NS, 'path');
      n.setAttribute('d', v);
    } else if (kind === 'r') {
      var r = nums(v);
      n = document.createElementNS(NS, 'rect');
      n.setAttribute('x', r[0]); n.setAttribute('y', r[1]);
      n.setAttribute('width', r[2]); n.setAttribute('height', r[3]);
      n.setAttribute('rx', r[4]);
    } else {
      var c = nums(v);
      n = document.createElementNS(NS, 'circle');
      n.setAttribute('cx', c[0]); n.setAttribute('cy', c[1]); n.setAttribute('r', c[2]);
      if (kind === 'f') { n.setAttribute('fill', 'currentColor'); n.setAttribute('stroke', 'none'); }
    }
    return n;
  }

  function svg(name, cls) {
    var list = ICONS[name];
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : '') + ' ico-' + name);
    if (!list) return s;
    for (var i = 0; i < list.length; i++) s.appendChild(shape(list[i]));
    return s;
  }

  // Fills every empty [data-icon] placeholder under root; a placeholder that already holds its <svg>
  // is skipped, so calling this again after a partial re-render is harmless.
  function hydrate(root) {
    var nodes = (root || document).querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.firstChild) continue;
      n.appendChild(svg(n.getAttribute('data-icon')));
    }
  }

  // Swaps the icon inside an element in place (star on/off, copy → check), keeping its classes.
  function swap(host, name) {
    var old = host.querySelector('svg.ico');
    var next = svg(name);
    if (old) host.replaceChild(next, old); else host.insertBefore(next, host.firstChild);
  }

  function effectiveTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    if (cur) return cur;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // The theme button pictures where a tap takes you: a moon while light, a sun while dark.
  // #theme-lbl exists only on index.html (the shelf's button is icon-only) — both are optional.
  function paintTheme() {
    var dark = effectiveTheme() === 'dark';
    var ico = document.getElementById('theme-ico');
    if (ico) {
      while (ico.firstChild) ico.removeChild(ico.firstChild);
      ico.setAttribute('data-icon', dark ? 'sun' : 'moon');
      ico.appendChild(svg(dark ? 'sun' : 'moon'));
    }
    var lbl = document.getElementById('theme-lbl');
    if (lbl && KC.i18n) lbl.textContent = KC.i18n.t(dark ? 'theme.toLight' : 'theme.toDark');
  }

  KC.icons = {
    svg: svg, hydrate: hydrate, swap: swap, paintTheme: paintTheme, effectiveTheme: effectiveTheme,
    NAMES: Object.keys(ICONS)
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { hydrate(document); });
    } else {
      hydrate(document);
    }
  }
})(window.KC = window.KC || {});
