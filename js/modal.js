// ---
// purpose: Generic overlay dialog — open/close, Esc, backdrop click, focus return, body scroll lock
// exports: KC.modal.open(id), close(id), closeAll(), isOpen(id)
// depends: nothing
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

    closeAll: function () {
      var open = document.querySelectorAll('.modal:not([hidden])');
      for (var i = 0; i < open.length; i++) KC.modal.close(open[i].id);
    },

    // One delegated wiring pass for every modal on the page.
    install: function () {
      document.addEventListener('click', function (e) {
        var closer = e.target.closest ? e.target.closest('[data-close]') : null;
        if (closer) { KC.modal.close(closer.getAttribute('data-close')); return; }
        if (e.target.className && String(e.target.className).indexOf('modal') === 0 &&
            e.target.id) {
          KC.modal.close(e.target.id);
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && anyOpen()) KC.modal.closeAll();
      });
    }
  };
})(window.KC = window.KC || {});
