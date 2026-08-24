// ---
// purpose: Render the About panel (what this is, privacy note, version + changelog, credits)
// exports: KC.aboutview.open(), close(), render()
// depends: js/version.js (data), js/i18n-about.js (strings), js/modal.js; reuses css/docs.css .doc-* classes
// gotcha: #nav-about does not exist on shelf.html — wiring is guarded, self-installs, app.js is untouched
// ---
(function (KC) {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  // ISO 'YYYY-MM-DD' parsed as UTC noon so no local timezone can roll it onto the wrong day.
  function formatDate(iso) {
    var parts = String(iso).split('-');
    try {
      var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
      return new Intl.DateTimeFormat(KC.i18n.lang, { dateStyle: 'long', timeZone: 'UTC' }).format(d);
    } catch (e) {
      return iso;
    }
  }

  function introSection() {
    var t = KC.i18n.t;
    var sec = el('section', 'doc-section');
    sec.appendChild(el('h3', 'doc-h', t('about.what.h')));
    sec.appendChild(el('p', 'doc-lead', t('about.what.body')));
    sec.appendChild(el('p', 'doc-note', t('about.privacy.note')));
    return sec;
  }

  function versionRow() {
    var t = KC.i18n.t;
    var row = el('div', 'doc-item');
    row.appendChild(el('span', 'doc-term', t('about.version.term')));
    row.appendChild(el('span', 'doc-desc',
      t('about.version.desc', { v: KC.version.CURRENT, date: formatDate(KC.version.RELEASES[0].date) })));
    return row;
  }

  function releaseNode(rel, isCurrent) {
    var t = KC.i18n.t;
    var art = el('article', isCurrent ? 'about-release is-current' : 'about-release');

    var head = el('header', 'about-release-head');
    head.appendChild(el('span', 'about-release-v', rel.version));
    if (isCurrent) head.appendChild(el('span', 'about-release-badge', t('about.current')));
    head.appendChild(el('time', 'about-release-date', formatDate(rel.date)));
    art.appendChild(head);

    var list = el('ul', 'about-release-list');
    for (var i = 0; i < rel.changes.length; i++) {
      list.appendChild(el('li', 'about-release-item', t(rel.changes[i])));
    }
    art.appendChild(list);
    return art;
  }

  function historySection() {
    var t = KC.i18n.t;
    var sec = el('section', 'doc-section');
    sec.appendChild(el('h3', 'doc-h', t('about.history.h')));
    sec.appendChild(el('p', 'doc-lead', t('about.history.hint')));
    sec.appendChild(versionRow());

    var list = el('div', 'about-releases');
    var releases = KC.version.RELEASES;
    for (var i = 0; i < releases.length; i++) list.appendChild(releaseNode(releases[i], i === 0));
    sec.appendChild(list);
    return sec;
  }

  function creditSection() {
    var t = KC.i18n.t;
    var sec = el('section', 'doc-section');
    sec.appendChild(el('h3', 'doc-h', t('about.credit.h')));
    sec.appendChild(el('p', 'doc-lead', t('about.credit.body')));
    return sec;
  }

  function wire() {
    var btn = byId('nav-about');
    if (btn) { btn.addEventListener('click', KC.aboutview.open); }
  }

  KC.aboutview = {
    render: function () {
      var host = byId('about-body');
      if (!host) return;
      while (host.firstChild) host.removeChild(host.firstChild);
      var body = el('div', 'doc-body');
      body.appendChild(introSection());
      body.appendChild(historySection());
      body.appendChild(creditSection());
      host.appendChild(body);
    },

    open: function () {
      KC.aboutview.render();
      KC.modal.open('about-modal');
    },

    close: function () { KC.modal.close('about-modal'); },

    install: wire
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})(window.KC = window.KC || {});
