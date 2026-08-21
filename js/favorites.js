// ---
// purpose: Persistent set of hand-picked favourite highlights, stored in localStorage
// exports: KC.favorites.keyOf/has/toggle/add/remove/list/count/pick/clear
// depends: js/store.js
// gotcha: rec.id is 'r' + index and shifts on every append — the key is content-derived, not the id
// ---
(function (KC) {
  'use strict';

  var KEY = 'kc.favorites.v1';
  var cache = null;

  function load() {
    if (cache) return cache;
    var v = KC.store.get(KEY, []);
    cache = Object.prototype.toString.call(v) === '[object Array]' ? v : [];
    return cache;
  }

  function save() {
    KC.store.set(KEY, load());
  }

  function keyOf(rec) {
    var cmp = rec._cmp;
    if (!cmp) cmp = String(rec.text || '').toLowerCase().replace(/\s+/g, ' ').replace(/^ | $/g, '');
    return rec.bookKey + '|' + cmp.slice(0, 120);
  }

  function indexOf(rec) {
    var list = load(), k = keyOf(rec);
    for (var i = 0; i < list.length; i++) if (list[i] === k) return i;
    return -1;
  }

  KC.favorites = {
    keyOf: keyOf,

    has: function (rec) { return indexOf(rec) !== -1; },

    add: function (rec) {
      if (indexOf(rec) !== -1) return false;
      load().push(keyOf(rec));
      save();
      return true;
    },

    remove: function (rec) {
      var i = indexOf(rec);
      if (i === -1) return false;
      load().splice(i, 1);
      save();
      return true;
    },

    toggle: function (rec) {
      if (indexOf(rec) === -1) {
        KC.favorites.add(rec);
        return true;
      }
      KC.favorites.remove(rec);
      return false;
    },

    list: function () { return load().slice(); },

    count: function () { return load().length; },

    // Starred order, not source order: the stored array is the user's own sequence.
    pick: function (records) {
      var byKey = {}, i;
      for (i = 0; i < records.length; i++) {
        var k = keyOf(records[i]);
        if (!byKey[k]) byKey[k] = records[i];
      }
      var stored = load(), out = [];
      for (i = 0; i < stored.length; i++) if (byKey[stored[i]]) out.push(byKey[stored[i]]);
      return out;
    },

    clear: function () {
      cache = [];
      save();
    }
  };
})(window.KC = window.KC || {});
