// ---
// purpose: localStorage prefs + library cache + sessionStorage raw-text cache, all failure-tolerant
// exports: KC.store.get/set, prefs, lib, books, session, libFull
// gotcha: private windows, disabled site data and quota all throw — every access is try/catch guarded
// ---
(function (KC) {
  'use strict';

  var PREFS_KEY = 'kc.prefs.v1';
  var LIB_KEY = 'kc.library.v1';
  var BOOKS_KEY = 'kc.books.v1';
  var SESSION_KEY = 'kc.session.text';
  var SESSION_MAX = 4e6;

  function get(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function trimOldestCovers(lib) {
    var keys = Object.keys(lib);
    keys.sort(function (a, b) { return (lib[a].ts || 0) - (lib[b].ts || 0); });
    var cut = Math.ceil(keys.length * 0.25);
    for (var i = 0; i < cut; i++) delete lib[keys[i]].cover;
  }

  KC.store = {
    get: get,
    set: set,
    libFull: false,

    prefs: {
      get: function () { return get(PREFS_KEY, {}); },
      set: function (patch) {
        var cur = get(PREFS_KEY, {});
        for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
        return set(PREFS_KEY, cur);
      }
    },

    lib: {
      get: function () { return get(LIB_KEY, {}); },
      set: function (lib) {
        if (set(LIB_KEY, lib)) return true;
        trimOldestCovers(lib);
        if (set(LIB_KEY, lib)) return true;
        KC.store.libFull = true;
        return false;
      }
    },

    books: {
      get: function () { return get(BOOKS_KEY, []); },
      set: function (books) { return set(BOOKS_KEY, books); }
    },

    session: {
      save: function (text) {
        if (text.length > SESSION_MAX) return false;
        try { sessionStorage.setItem(SESSION_KEY, text); return true; } catch (e) { return false; }
      },
      load: function () {
        try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; }
      },
      clear: function () {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
      }
    }
  };
})(window.KC = window.KC || {});
