// ---
// purpose: Topbar overflow menu (⋯) on narrow screens + the always-available brand home link
// exports: KC.nav.install(), KC.nav.closeMore()
// depends: js/modal.js, js/ui.js (both optional — every hook is existence-guarded)
// gotcha: loaded by index.html AND shelf.html; self-installs, nothing wires it from app.js.
//   The ⋯ panel is a dropdown at every width (desktop gets inline .topnav shortcuts beside it).
//   Controls marked [data-keep-open] (switches, theme, language, the export disclosure) keep the
//   panel open so a setting can be flipped and seen; everything else closes it.
// ---
(function (KC) {
  'use strict';

  function byId(id) { return document.getElementById(id); }

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

  // In-page "go home": drop every filter and repaint, instead of reloading the file.
  function goHome() {
    var s = KC.state;
    if (!s) return false;
    if (KC.backnav) KC.backnav.push('nav');  // Home is a move too — back returns to where you were
    s.activeBook = null;
    s.activeTopic = null;
    s.query = '';
    s.rendered = 0;
    var q = byId('q');
    if (q) q.value = '';
    if (KC.modal) KC.modal.closeAll();
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
    closeMore: function () { setMore(false); },

    install: function () {
      var more = byId('more'), btn = byId('more-btn');

      if (more && btn) {
        setMore(false);

        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          setMore(!moreOpen());
        });

        // Any control inside closes the panel — except [data-keep-open] ones (see header).
        more.addEventListener('click', function (e) {
          var hit = e.target.closest ? e.target.closest('button, a') : null;
          if (!hit || hit === btn || hit.hasAttribute('data-keep-open')) return;
          setMore(false);
        });

        document.addEventListener('click', function (e) {
          if (moreOpen() && !more.contains(e.target)) setMore(false);
        });

        // Disclosure, not a modal: Tab moves out freely, and leaving closes it.
        more.addEventListener('focusout', function (e) {
          if (moreOpen() && e.relatedTarget && !more.contains(e.relatedTarget)) setMore(false);
        });

        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && moreOpen()) { setMore(false); btn.focus(); }
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
