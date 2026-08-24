// ---
// purpose: One-click Anki export — wires #nav-anki to the shared TSV builder in js/exports.js
// exports: KC.anki.run()
// depends: js/exports.js (build + download), js/i18n-anki.js (strings), KC.state at click time
// gotcha: #nav-anki does not exist on shelf.html — the wiring is guarded, never assume it is there
// ---
(function (KC) {
  'use strict';

  function t(k) { return (KC.i18n && KC.i18n.t) ? KC.i18n.t(k) : k; }
  function toast(msg) { if (KC.ui && KC.ui.toast) { KC.ui.toast(msg); } }

  // What you see is what you export: KC.state.filtered already reflects the active book,
  // the topic chip, the search query and the show-hidden switch — same source as the menu.
  function run() {
    var recs = (KC.state && KC.state.filtered) || [];
    if (!recs.length) { toast(t('anki.empty')); return null; }
    var built = KC.exports.run('anki', recs, {});
    toast(t('anki.done'));
    return built;
  }

  function wire() {
    var btn = document.getElementById('nav-anki');
    if (btn) { btn.addEventListener('click', run); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  KC.anki = { run: run };
})(window.KC = window.KC || {});
