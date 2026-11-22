// ---
// purpose: Render the in-app Help guide into #help-modal — a didactic walkthrough of every feature
// exports: KC.helpview.render(), open(), close(), install()
// depends: js/i18n.js, js/i18n-help.js + js/i18n-ux.js (strings), js/modal.js
// gotcha: #nav-help does not exist on shelf.html — install() is guarded, same convention as js/anki.js
// ---
(function (KC) {
  'use strict';

  // [termKey, descKey, kbdText] — pass kbdText instead of a termKey to render a .doc-kbd glyph as the term.
  var SECTIONS = [
    { code: 'load', h: 'help.load.h', lead: 'help.load.lead', note: 'help.load.note', items: [
      ['help.load.open.t', 'help.load.open.d'],
      ['help.load.remember.t', 'help.load.remember.d']
    ] },
    { code: 'books', h: 'help.books.h', note: 'help.books.note', items: [
      ['help.books.list.t', 'help.books.list.d'],
      ['help.books.chips.t', 'help.books.chips.d']
    ] },
    { code: 'search', h: 'help.search.h', items: [
      ['help.search.find.t', 'help.search.find.d'],
      ['help.search.sort.t', 'help.search.sort.d'],
      ['help.search.back.t', 'help.search.back.d']
    ] },
    { code: 'dup', h: 'help.dup.h', lead: 'help.dup.lead', items: [
      ['help.dup.what.t', 'help.dup.what.d'],
      ['help.dup.other.t', 'help.dup.other.d'],
      ['help.dup.flagtrunc.t', 'help.dup.flagtrunc.d'],
      ['help.dup.flagnear.t', 'help.dup.flagnear.d']
    ] },
    { code: 'fav', h: 'help.fav.h', items: [
      ['help.fav.star.t', 'help.fav.star.d'],
      ['help.fav.copy.t', 'help.fav.copy.d'],
      ['help.fav.image.t', 'help.fav.image.d']
    ] },
    { code: 'export', h: 'help.export.h', lead: 'help.export.lead', items: [
      ['help.export.md.t', 'help.export.md.d'],
      ['help.export.mdbook.t', 'help.export.mdbook.d'],
      ['help.export.json.t', 'help.export.json.d'],
      ['help.export.csv.t', 'help.export.csv.d'],
      ['help.export.txt.t', 'help.export.txt.d'],
      ['help.export.anki.t', 'help.export.anki.d'],
      ['help.export.obsidian.t', 'help.export.obsidian.d']
    ] },
    { code: 'stats', h: 'help.stats.h', items: [
      ['help.stats.totals.t', 'help.stats.totals.d'],
      ['help.stats.drill.t', 'help.stats.drill.d'],
      ['help.stats.timeline.t', 'help.stats.timeline.d'],
      ['help.stats.rank.t', 'help.stats.rank.d'],
      ['help.stats.rhythm.t', 'help.stats.rhythm.d'],
      ['help.stats.extremes.t', 'help.stats.extremes.d']
    ] },
    { code: 'quotes', h: 'help.quotes.h', items: [
      ['help.quotes.source.t', 'help.quotes.source.d'],
      ['help.quotes.size.t', 'help.quotes.size.d'],
      ['help.quotes.download.t', 'help.quotes.download.d']
    ] },
    { code: 'shelf', h: 'help.shelf.h', items: [
      ['help.shelf.what.t', 'help.shelf.what.d'],
      ['help.shelf.fetch.t', 'help.shelf.fetch.d']
    ] },
    { code: 'keys', h: 'help.keys.h', items: [
      [null, 'help.keys.slash.d', '/'],
      [null, 'help.keys.esc.d', 'Esc']
    ] }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function itemRow(spec) {
    var row = el('div', 'doc-item');
    var term = el('span', 'doc-term');
    if (spec[2]) { term.appendChild(el('span', 'doc-kbd', spec[2])); }
    else { term.textContent = KC.i18n.t(spec[0]); }
    row.appendChild(term);
    row.appendChild(el('p', 'doc-desc', KC.i18n.t(spec[1])));
    return row;
  }

  function tocLink(sec, targetId) {
    var link = el('button', 'doc-toc-link', KC.i18n.t(sec.h));
    link.type = 'button';
    link.addEventListener('click', function () {
      var target = document.getElementById(targetId);
      if (target && target.scrollIntoView) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    return link;
  }

  function sectionNode(sec, targetId) {
    var node = el('section', 'doc-section');
    node.id = targetId;
    node.appendChild(el('h3', 'doc-h', KC.i18n.t(sec.h)));
    if (sec.lead) { node.appendChild(el('p', 'doc-lead', KC.i18n.t(sec.lead))); }
    for (var i = 0; i < sec.items.length; i++) { node.appendChild(itemRow(sec.items[i])); }
    if (sec.note) { node.appendChild(el('p', 'doc-note', KC.i18n.t(sec.note))); }
    return node;
  }

  function render() {
    var host = document.getElementById('help-body');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    var body = el('div', 'doc-body');
    body.appendChild(el('p', 'doc-lead', KC.i18n.t('help.intro')));

    var toc = el('div', 'doc-toc');
    body.appendChild(toc);

    for (var i = 0; i < SECTIONS.length; i++) {
      var sec = SECTIONS[i], targetId = 'help-sec-' + sec.code;
      toc.appendChild(tocLink(sec, targetId));
      body.appendChild(sectionNode(sec, targetId));
    }
    host.appendChild(body);
  }

  function open() {
    render();
    KC.modal.open('help-modal');
  }

  function close() {
    KC.modal.close('help-modal');
  }

  function install() {
    var btn = document.getElementById('nav-help');
    if (btn) { btn.addEventListener('click', open); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

  KC.helpview = { render: render, open: open, close: close, install: install };
})(window.KC = window.KC || {});
