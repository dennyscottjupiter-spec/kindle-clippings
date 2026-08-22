// ---
// purpose: Topbar overflow menu (⋯) on narrow screens + the always-available brand home link
// exports: KC.nav.install(), KC.nav.closeMore()
// depends: js/modal.js, js/ui.js (both optional — every hook is existence-guarded)
// gotcha: loaded by index.html AND shelf.html; self-installs, nothing wires it from app.js.
//   Above 860px chrome.css renders the panel with display:contents, which outranks [hidden] — so
//   the attribute must be cleared there too, or the DOM and aria-expanded desync on resize.
// ---
(function (KC) {
  'use strict';

  var NARROW = '(max-width: 860px)';

  function byId(id) { return document.getElementById(id); }

  function isNarrow() {
    return !window.matchMedia || window.matchMedia(NARROW).matches;
  }

  function setMore(open) {
    var panel = byId('more-panel'), btn = byId('more-btn');
    if (!panel || !btn) return;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function moreOpen() {
    var panel = byId('more-panel');
    return !!panel && !panel.hidden;
  }

  // Wide screens paint the panel unconditionally; keep the attribute in step with what is on screen.
  function syncBreakpoint() {
    setMore(!isNarrow());
  }

  // In-page "go home": drop every filter and repaint, instead of reloading the file.
  function goHome() {
    var s = KC.state;
    if (!s) return false;
    s.activeBook = null;
    s.activeTopic = null;
    s.query = '';
    s.rendered = 0;
    var q = byId('q');
    if (q) q.value = '';
    if (KC.modal) { KC.modal.close('stats-modal'); KC.modal.close('quotes-modal'); }
    var side = byId('sidebar');
    if (side) side.className = 'sidebar';
    var scrim = byId('scrim');
    if (scrim) scrim.hidden = true;
    var drawer = byId('drawer-toggle');
    if (drawer) drawer.setAttribute('aria-expanded', 'false');
    if (KC.ui && KC.ui.render) KC.ui.render();
    var main = byId('main');
    if (main) main.scrollTop = 0;
    return true;
  }

  KC.nav = {
    closeMore: function () { if (isNarrow()) setMore(false); },

    install: function () {
      var more = byId('more'), btn = byId('more-btn');

      if (more && btn) {
        syncBreakpoint();
        if (window.matchMedia) {
          var mq = window.matchMedia(NARROW);
          if (mq.addEventListener) mq.addEventListener('change', syncBreakpoint);
          else if (mq.addListener) mq.addListener(syncBreakpoint);
        }

        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          setMore(!moreOpen());
        });

        // Any control inside closes the panel — except the export button, which opens its own list.
        more.addEventListener('click', function (e) {
          if (!isNarrow()) return;
          var hit = e.target.closest ? e.target.closest('button, a') : null;
          if (!hit || hit === btn || hit.id === 'export-btn') return;
          setMore(false);
        });

        document.addEventListener('click', function (e) {
          if (isNarrow() && moreOpen() && !more.contains(e.target)) setMore(false);
        });

        // Disclosure, not a modal: Tab moves out freely, and leaving closes it.
        more.addEventListener('focusout', function (e) {
          if (isNarrow() && moreOpen() && e.relatedTarget && !more.contains(e.relatedTarget)) setMore(false);
        });

        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && isNarrow() && moreOpen()) { setMore(false); btn.focus(); }
        });
      }

      var home = byId('nav-home');
      if (home) {
        home.addEventListener('click', function (e) {
          if (goHome()) e.preventDefault();   // href="index.html" stays the no-JS fallback
        });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', KC.nav.install);
  } else {
    KC.nav.install();
  }
})(window.KC = window.KC || {});
