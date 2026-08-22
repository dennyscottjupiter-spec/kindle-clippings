// ---
// purpose: Durable IndexedDB store for the raw clippings text so it survives closing the browser
// exports: KC.persist.available, save(text, name), load(), clear(), requestDurable()
// gotcha: writes settle on tx.oncomplete, NOT req.onsuccess — a readwrite transaction can still
//   abort on quota after the request reported success
// gotcha: every promise resolves — a private window, blocked site data, a quota abort or a hung
//   open (WebKit 226547) yields false/null instead of rejecting, so boot never breaks
// ---
(function (KC) {
  'use strict';

  var DB_NAME = 'kc';
  var DB_VERSION = 1;
  var STORE = 'files';
  var KEY = 'clippings';
  var OPEN_TIMEOUT = 3000;

  var idb = null;
  try { idb = window.indexedDB || null; } catch (e) { idb = null; }

  // Safari can leave open() pending forever, which would freeze the restore hint — time it out.
  function openOnce() {
    return new Promise(function (resolve) {
      if (!idb) { resolve(null); return; }
      var done = false, timer = null, req;
      function settle(v) { if (!done) { done = true; clearTimeout(timer); resolve(v); } }

      try { req = idb.open(DB_NAME, DB_VERSION); } catch (e) { settle(null); return; }
      timer = setTimeout(function () { settle(null); }, OPEN_TIMEOUT);

      req.onupgradeneeded = function () {
        try {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        } catch (e) { /* ignore */ }
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () { db.close(); };  // else another tab's upgrade blocks forever
        if (done) { db.close(); return; }                  // arrived after the timeout — do not leak it
        settle(db);
      };
      req.onerror = function () { settle(null); };
      req.onblocked = function () { settle(null); };
    });
  }

  function openDb() {
    return openOnce().then(function (db) { return db || openOnce(); });
  }

  // One place for the open → transaction → request dance; `run` gets the store and returns a request.
  // Resolves { value } on success and null on any failure, so callers never see a rejection.
  function withStore(mode, run) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        var tx, req;
        try {
          tx = db.transaction(STORE, mode);
          req = run(tx.objectStore(STORE));
        } catch (e) { db.close(); resolve(null); return; }

        function fail() { db.close(); resolve(null); }
        tx.onerror = fail;
        tx.onabort = fail;

        if (mode === 'readwrite') {
          // Only oncomplete proves the write committed; quota aborts the tx after req succeeded.
          tx.oncomplete = function () { db.close(); resolve({ value: req.result }); };
        } else {
          req.onsuccess = function () { db.close(); resolve({ value: req.result }); };
          req.onerror = fail;
        }
      });
    })['catch'](function () { return null; });
  }

  KC.persist = {
    available: !!idb,

    save: function (text, name) {
      var rec = { text: String(text || ''), name: String(name || ''), ts: Date.now() };
      return withStore('readwrite', function (store) {
        return store.put(rec, KEY);
      }).then(function (r) { return r !== null; });
    },

    load: function () {
      return withStore('readonly', function (store) {
        return store.get(KEY);
      }).then(function (r) {
        var rec = r && r.value;
        return (rec && rec.text) ? rec : null;
      });
    },

    clear: function () {
      return withStore('readwrite', function (store) {
        return store['delete'](KEY);
      }).then(function () { /* always resolves */ });
    },

    // Safari drops script-writable storage after 7 days without a visit; persisted storage is the
    // documented exemption. navigator.storage is secure-context only, so it is absent over plain HTTP.
    requestDurable: function () {
      try {
        if (!navigator.storage || !navigator.storage.persist) return;
        navigator.storage.persisted().then(function (ok) {
          if (!ok) navigator.storage.persist()['catch'](function () { /* ignore */ });
        })['catch'](function () { /* ignore */ });
      } catch (e) { /* ignore */ }
    }
  };
})(window.KC = window.KC || {});
