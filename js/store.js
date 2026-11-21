// ---
// purpose: localStorage prefs + library cache + sessionStorage raw-text cache, all failure-tolerant
// exports: KC.store.get/set, prefs (incl. hydrate), lib, books, session, hadFile, libFull
// depends: js/profile.js (key namespacing), js/persist.js at call time only — index.html loads it after this file, never before
// gotcha: private windows, disabled site data and quota all throw — every access is try/catch guarded
// gotcha: `session` is only the fast same-tab cache; the durable copy lives in js/persist.js (IndexedDB)
// gotcha: prefs are mirrored to IndexedDB on every write and hydrate() unions them back at boot —
//   localStorage wins key by key, the mirror only fills in what is missing
// ---
(function (KC) {
  'use strict';

  var PREFS_KEY = 'kc.prefs.v1';
  var LIB_KEY = 'kc.library.v1';
  var BOOKS_KEY = 'kc.books.v1';
  var SESSION_KEY = 'kc.session.text';
  var HADFILE_KEY = 'kc.hadFile';
  var SESSION_MAX = 4e6;

  // Per-person key when two-person mode is on (js/profile.js); bare key otherwise.
  function K(k) { return KC.profile ? KC.profile.key(k) : k; }

  function get(key, fallback) {
    try {
      var v = localStorage.getItem(K(key));
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(K(key), JSON.stringify(value));
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
        var ok = set(PREFS_KEY, cur);
        if (KC.persist && KC.persist.savePrefs) KC.persist.savePrefs(cur);
        return ok;
      },

      // Call once at boot. Refills a cleared localStorage from the durable mirror; a key that
      // still exists locally is the fresher one and is never overwritten. Resolves true when
      // something was restored, so the caller can re-apply theme/language.
      hydrate: function () {
        if (!KC.persist || !KC.persist.loadPrefs) return Promise.resolve(false);
        return KC.persist.loadPrefs().then(function (mirrored) {
          var cur = get(PREFS_KEY, {}), restored = false, k;
          if (!mirrored) { KC.persist.savePrefs(cur); return false; }
          for (k in mirrored) {
            if (!Object.prototype.hasOwnProperty.call(mirrored, k)) continue;
            if (Object.prototype.hasOwnProperty.call(cur, k)) continue;
            cur[k] = mirrored[k];
            restored = true;
          }
          set(PREFS_KEY, cur);
          KC.persist.savePrefs(cur);
          return restored;
        })['catch'](function () { return false; });
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
        try { sessionStorage.setItem(K(SESSION_KEY), text); return true; } catch (e) { return false; }
      },
      load: function () {
        try { return sessionStorage.getItem(K(SESSION_KEY)); } catch (e) { return null; }
      },
      clear: function () {
        try { sessionStorage.removeItem(K(SESSION_KEY)); } catch (e) { /* ignore */ }
      }
    },

    // Outliving the IndexedDB record is the only signal that the browser evicted the saved file.
    hadFile: {
      get: function () { return get(HADFILE_KEY, 0); },
      set: function () { return set(HADFILE_KEY, Date.now()); },
      clear: function () {
        try { localStorage.removeItem(K(HADFILE_KEY)); } catch (e) { /* ignore */ }
      }
    }
  };
})(window.KC = window.KC || {});
