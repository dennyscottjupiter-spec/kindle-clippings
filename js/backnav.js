// ---
// purpose: "Go back to where I was" — a ← button in the topbar plus the phone's back gesture, both
//   undoing the last move: opening a book, a topic, a search, a panel, a stats detail, the drawer
// exports: KC.backnav.push(kind), back(), canBack(), clear(), requestCloseModal(id), requestCloseDrawer(),
//   restoring()
// depends: js/modal.js (wrapped: KC.modal.open + KC.modal.requestClose), js/ui.js, js/cards.js,
//   js/statsview.js / quoteview.js / helpview.js / aboutview.js (re-openers) — all at call time
// gotcha: a snapshot is taken BEFORE a move changes anything; stack[d] is the state to return to
//   when the browser lands on the history entry whose state is {kc: d}
// gotcha: KC.modal.open is wrapped here (same trick as js/cardactions.js on appendPage) so every
//   panel opener pushes without being edited; restore() sets `restoring` so it never re-pushes
// gotcha: pushState can throw on some file:// setups — then the stack still works in memory and the
//   ← button pops it directly; only the hardware back gesture is lost
// ---
(function (KC) {
  'use strict';

  var stack = [];
  var restoring = false;
  var useHistory = true;

  function byId(id) { return document.getElementById(id); }

  function openModalId() {
    var open = document.querySelectorAll('.modal:not([hidden])');
    return open.length ? open[open.length - 1].id : null;
  }

  function drawerOpen() {
    var side = byId('sidebar');
    return !!side && side.className.indexOf('is-open') !== -1;
  }

  function setDrawer(on) {
    var side = byId('sidebar');
    if (!side) return;
    side.className = on ? 'sidebar is-open' : 'sidebar';
    byId('scrim').hidden = !on;
    byId('drawer-toggle').setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function snapshot(kind) {
    var s = KC.state, pane = byId('main');
    return {
      kind: kind || 'nav',
      book: s.activeBook, topic: s.activeTopic, query: s.query,
      modal: openModalId(),
      statsMode: KC.statsview && KC.statsview.mode ? KC.statsview.mode() : 'overview',
      drawer: drawerOpen(),
      scroll: pane ? pane.scrollTop : 0
    };
  }

  function paint() {
    var btn = byId('nav-back');
    if (btn) btn.hidden = stack.length === 0;
  }

  var OPENERS = {
    'stats-modal': function () { return KC.statsview && KC.statsview.open; },
    'quotes-modal': function () { return KC.quoteview && KC.quoteview.open; },
    'help-modal': function () { return KC.helpview && KC.helpview.open; },
    'about-modal': function () { return KC.aboutview && KC.aboutview.open; }
  };

  // Paginated list: draw pages until the saved offset exists, then jump to it.
  function restoreScroll(top) {
    var pane = byId('main'), guard = 0;
    if (!pane) return;
    while (guard++ < 60 && pane.scrollHeight < top + pane.clientHeight &&
           KC.state.rendered < KC.state.filtered.length) {
      if (!KC.cards.appendPage()) break;
    }
    pane.scrollTop = top;
  }

  function restore(snap) {
    restoring = true;
    try {
      var s = KC.state;
      var changed = s.activeBook !== snap.book || s.activeTopic !== snap.topic || s.query !== snap.query;
      s.activeBook = snap.book;
      s.activeTopic = snap.topic;
      s.query = snap.query;
      var q = byId('q');
      if (q && q.value !== snap.query) q.value = snap.query;
      if (changed) { s.rendered = 0; KC.ui.render(); }

      // Panels: close whatever is open that should not be, then (re)open the one that should.
      var open = document.querySelectorAll('.modal:not([hidden])'), i;
      for (i = 0; i < open.length; i++) if (open[i].id !== snap.modal) KC.modal.close(open[i].id);
      if (snap.modal) {
        if (snap.modal === 'stats-modal' && KC.statsview && KC.statsview.setMode) {
          KC.statsview.setMode(snap.statsMode || 'overview');
        }
        if (!KC.modal.isOpen(snap.modal)) {
          var opener = OPENERS[snap.modal] && OPENERS[snap.modal]();
          if (opener) opener(); else KC.modal.open(snap.modal);
        } else if (snap.modal === 'stats-modal') {
          KC.statsview.render();
        }
      }

      setDrawer(snap.drawer);
      restoreScroll(snap.scroll || 0);
    } finally {
      restoring = false;
    }
  }

  // Land on depth d: restore stack[d] and forget everything above it.
  function popTo(d) {
    if (d < 0 || d >= stack.length) return;
    var snap = stack[d];
    stack.length = d;
    restore(snap);
    paint();
  }

  function go(n) {
    if (n <= 0) return;
    if (useHistory) {
      try { history.go(-n); return; } catch (e) { useHistory = false; }
    }
    popTo(stack.length - n);
  }

  KC.backnav = {
    restoring: function () { return restoring; },
    canBack: function () { return stack.length > 0; },

    // Call BEFORE the move. kind tags the entry so a later close can find it: 'modal', 'drawer', 'nav'.
    push: function (kind) {
      if (restoring || !KC.state) return;
      stack.push(snapshot(kind));
      if (useHistory) {
        try { history.pushState({ kc: stack.length }, ''); } catch (e) { useHistory = false; }
      }
      paint();
    },

    back: function () { go(1); },

    // The open drawer already owns the top entry (its "before" state): reuse it for the move made
    // from inside the drawer instead of stacking a second one, so one back undoes both.
    adoptDrawer: function () {
      var top = stack[stack.length - 1];
      if (top && top.kind === 'drawer' && drawerOpen()) { top.kind = 'nav'; return true; }
      return false;
    },

    clear: function () {
      stack.length = 0;
      if (useHistory) { try { history.replaceState({ kc: 0 }, ''); } catch (e) { /* ignore */ } }
      paint();
    },

    // ×, Esc and the backdrop come here instead of closing directly: when the panel was opened
    // through history, step back past every entry recorded while it was open (its detail views
    // included), so the gesture stack and the screen stay in step.
    requestCloseModal: function (id) {
      // Entries taken while this panel was open (detail views, a book tapped inside it) sit on top;
      // just below them is the entry its own opening pushed — the state to return to.
      var t = stack.length - 1;
      while (t >= 0 && stack[t].modal === id) t--;
      if (t >= 0 && stack[t].kind === 'modal') { go(stack.length - t); return; }
      KC.modal.close(id);
    },

    requestCloseDrawer: function () {
      var top = stack[stack.length - 1];
      if (top && top.kind === 'drawer' && drawerOpen()) { go(1); return; }
      setDrawer(false);
    },

    install: function () {
      if (useHistory) {
        try { history.replaceState({ kc: 0 }, ''); } catch (e) { useHistory = false; }
      }
      window.addEventListener('popstate', function (e) {
        var d = e.state && typeof e.state.kc === 'number' ? e.state.kc : 0;
        // Forward navigation, or an entry left over from before a reload: nothing to restore.
        if (d >= stack.length) return;
        popTo(d);
      });

      var btn = byId('nav-back');
      if (btn) btn.addEventListener('click', function () { KC.backnav.back(); });

      // Every panel opener funnels through KC.modal.open — wrap it once instead of editing each.
      if (KC.modal && typeof KC.modal.open === 'function') {
        var origOpen = KC.modal.open;
        KC.modal.open = function (id) {
          if (!restoring && !KC.modal.isOpen(id)) KC.backnav.push('modal');
          return origOpen.apply(KC.modal, arguments);
        };
        KC.modal.requestClose = KC.backnav.requestCloseModal;
      }
      paint();
    }
  };
})(window.KC = window.KC || {});
