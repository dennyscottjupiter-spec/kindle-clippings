// ---
// purpose: Shared topic-chip row for sidebar + shelf — counts, "all" chip, per-topic chips, and the
//   discovery prompt shown while no book has a resolved topic yet
// exports: KC.topicfilter.render(host, books, lib, activeTopic)
// depends: js/topics.js, js/i18n.js, js/i18n-topics.js, js/covers.js (isOn)
// gotcha: only builds DOM into host, incl. host.hidden — chip CLICK handling stays per page
//   (sidebar's lives in js/app.js, shelf's in js/shelf.js), this module never attaches one to a chip
// ---
(function (KC) {
  'use strict';

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function countTopics(books, lib) {
    var counts = {}, anyReal = false;
    for (var i = 0; i < books.length; i++) {
      var entry = lib[books[i].key];
      var t = (entry && entry.topic) || 'uncategorized';
      if (t !== 'uncategorized') anyReal = true;
      counts[t] = (counts[t] || 0) + 1;
    }
    return { counts: counts, anyReal: anyReal };
  }

  function chip(topicId, hue, isActive, label) {
    var c = el('button', 'chip');
    c.type = 'button';
    c.setAttribute('data-topic', topicId);
    if (hue !== null && hue !== undefined) c.style.setProperty('--h', String(hue));
    c.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    c.textContent = label;
    return c;
  }

  // Never enables covers on its own — the button only forwards a real, user-initiated click to the
  // switch that already owns that decision (and its first-run privacy toast).
  function renderDiscover(host) {
    var wrap = el('div', 'topic-discover');
    var p = el('p', 'topic-discover-text');
    p.textContent = KC.i18n.t('topic.discover.text');
    wrap.appendChild(p);

    var btn = el('button', 'btn topic-discover-cta');
    btn.type = 'button';
    btn.textContent = KC.i18n.t('topic.discover.cta');
    btn.addEventListener('click', function () {
      var real = document.getElementById('toggle-covers');
      if (real) real.click();
    });
    wrap.appendChild(btn);
    host.appendChild(wrap);
  }

  KC.topicfilter = {
    render: function (host, books, lib, activeTopic) {
      while (host.firstChild) host.removeChild(host.firstChild);
      var r = countTopics(books, lib || {});

      if (!r.anyReal) {
        // Covers on but nothing resolved yet (still fetching, or no book matched anything real) —
        // the switch itself already shows fetch progress, so stay quiet instead of guessing.
        if (KC.covers && KC.covers.isOn && KC.covers.isOn()) { host.hidden = true; return; }
        host.hidden = false;
        renderDiscover(host);
        return;
      }

      host.hidden = false;
      host.appendChild(chip('all', null, activeTopic === null, KC.i18n.t('topic.all')));
      for (var i = 0; i < KC.topics.list.length; i++) {
        var id = KC.topics.list[i].id;
        if (!r.counts[id]) continue;
        var label = KC.topics.label(id) + ' (' + KC.i18n.num(r.counts[id]) + ')';
        host.appendChild(chip(id, KC.topics.list[i].h, activeTopic === id, label));
      }
    }
  };
})(window.KC = window.KC || {});
