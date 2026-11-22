// ---
// purpose: Generic overlay dialog — open/close, Esc, backdrop click, focus return, body scroll lock
// exports: KC.modal.open(id), close(id), closeAll(), isOpen(id), requestClose(id)
// depends: nothing (js/backnav.js replaces requestClose + wraps open once it installs)
// gotcha: the show rule must be written .modal:not([hidden]) — a bare display: rule outranks [hidden]
// ---
(function (KC) {
  'use strict';

  var lastFocus = null;

  function byId(id) { return document.getElementById(id); }

  function anyOpen() {
    return document.querySelectorAll('.modal:not([hidden])').length > 0;
  }

  KC.modal = {
    isOpen: function (id) {
      var n = byId(id);
      return !!n && !n.hidden;
    },

    open: function (id) {
      var n = byId(id);
      if (!n) return;
      lastFocus = document.activeElement;
      n.hidden = false;
      document.documentElement.className += ' modal-on';
      var focusable = n.querySelector('.modal-close');
      if (focusable) focusable.focus();
    },

    close: function (id) {
      var n = byId(id);
      if (!n || n.hidden) return;
      n.hidden = true;
      if (!anyOpen()) {
        document.documentElement.className =
          document.documentElement.className.replace(/\s*modal-on/g, '');
      }
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    },

    // What the user's ×, Esc and backdrop tap call. Plain close by default; js/backnav.js swaps in a
    // history-aware version so the phone's back stack stays in step with what is on screen.
    requestClose: function (id) { KC.modal.close(id); },

    closeAll: function () {
      var open = document.querySelectorAll('.modal:not([hidden])');
      for (var i = 0; i < open.length; i++) KC.modal.close(open[i].id);
    },

    // One delegated wiring pass for every modal on the page.
    install: function () {
      document.addEventListener('click', function (e) {
        var closer = e.target.closest ? e.target.closest('[data-close]') : null;
        if (closer) { KC.modal.requestClose(closer.getAttribute('data-close')); return; }
        // Exactly the .modal backdrop — a prefix test also matched .modal-body#stats-body, so a tap
        // on the panel's own padding used to "close" (hide) the body instead of the dialog.
        if (e.target.classList && e.target.classList.contains('modal') && e.target.id) {
          KC.modal.requestClose(e.target.id);
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !anyOpen()) return;
        var open = document.querySelectorAll('.modal:not([hidden])');
        KC.modal.requestClose(open[open.length - 1].id);
      });
    }
  };
})(window.KC = window.KC || {});
