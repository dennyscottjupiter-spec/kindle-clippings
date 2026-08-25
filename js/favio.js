// ---
// purpose: Manual backup of the starred highlights — download the favourites as JSON, read one back
// exports: KC.favio.build(), KC.favio.save(), KC.favio.read(file)
// depends: js/favorites.js, js/exports.js (reuses its blob download)
// gotcha: read() unions, never replaces — importing a backup can only add stars, never drop one
// gotcha: the file holds content-derived keys, not highlight text; it is useless without the
//   matching My Clippings.txt, which is exactly why it is safe to keep in a cloud folder
// ---
(function (KC) {
  'use strict';

  var FORMAT = 'kindle-clippings.favorites';
  var FORMAT_VERSION = 1;

  function build() {
    var keys = KC.favorites.list();
    return {
      name: 'favoritos-' + new Date().toISOString().slice(0, 10) + '.json',
      mime: 'application/json',
      text: JSON.stringify({
        format: FORMAT,
        formatVersion: FORMAT_VERSION,
        exported: new Date().toISOString(),
        count: keys.length,
        keys: keys
      }, null, 2)
    };
  }

  KC.favio = {
    build: build,

    save: function () {
      var out = build();
      if (!out.count && !KC.favorites.count()) return 0;
      KC.exports.download(out.name, out.text, out.mime);
      return KC.favorites.count();
    },

    // Resolves { ok, added, total } — never rejects, so a mistyped file only shows a toast.
    read: function (file) {
      return new Promise(function (resolve) {
        if (!file) { resolve({ ok: false, added: 0, total: KC.favorites.count() }); return; }
        var reader = new FileReader();
        reader.onload = function () {
          var data = null;
          try { data = JSON.parse(String(reader.result || '')); } catch (e) { data = null; }
          var keys = data && data.keys;
          if (!data || data.format !== FORMAT ||
              Object.prototype.toString.call(keys) !== '[object Array]') {
            resolve({ ok: false, added: 0, total: KC.favorites.count() });
            return;
          }
          var added = KC.favorites.merge(keys);
          resolve({ ok: true, added: added, total: KC.favorites.count() });
        };
        reader.onerror = function () { resolve({ ok: false, added: 0, total: KC.favorites.count() }); };
        reader.readAsText(file, 'utf-8');
      });
    }
  };
})(window.KC = window.KC || {});
