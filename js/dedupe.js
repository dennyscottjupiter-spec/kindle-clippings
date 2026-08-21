// ---
// purpose: Collapse Kindle "extended highlight" duplicates into one survivor per book
// exports: KC.dedupe(records, opts)
// depends: nothing (compare text is supplied by clean.js as rec._cmp)
// gotcha: union-find, not pairwise "keep the longer" — A⊂B⊂C must collapse to ONE survivor
// ---
(function (KC) {
  'use strict';

  var WINDOW = 400; // locations; extended highlights always sit adjacent

  function makeUF(n) {
    var parent = new Array(n);
    for (var i = 0; i < n; i++) parent[i] = i;
    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    return {
      find: find,
      union: function (a, b) {
        var ra = find(a), rb = find(b);
        if (ra !== rb) parent[rb] = ra;
      }
    };
  }

  // Longest text wins; ties go to the newest record, then to the latest file position.
  function better(a, b) {
    if (a._cmp.length !== b._cmp.length) return a._cmp.length > b._cmp.length ? a : b;
    var am = a.dateMs || 0, bm = b.dateMs || 0;
    if (am !== bm) return am > bm ? a : b;
    return a.order >= b.order ? a : b;
  }

  function contains(a, b) {
    if (!a || !b) return false;
    return a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  // One book's highlights -> components, plus the pair counts the tests assert on.
  function linkBook(list, uf, offset, stats) {
    var located = [], loose = [], i, j;
    for (i = 0; i < list.length; i++) {
      if (list[i].locStart === null || list[i].locStart === undefined) loose.push(i);
      else located.push(i);
    }
    located.sort(function (a, b) {
      return list[a].locStart - list[b].locStart || list[a].order - list[b].order;
    });

    // 1. Merge-intervals sweep: sorted order + a running max-end yields exactly the
    //    connected components of the pairwise-overlap graph, with no pairwise compare.
    var runEnd = -Infinity;
    for (i = 0; i < located.length; i++) {
      var rec = list[located[i]];
      if (i > 0 && rec.locStart <= runEnd) {
        stats.overlapPairs++;
        uf.union(offset + located[i - 1], offset + located[i]);
      }
      runEnd = i === 0 || rec.locStart > runEnd ? rec.locEnd : Math.max(runEnd, rec.locEnd);
    }

    // 2. Text containment inside a bounded location window, for pairs the sweep missed.
    for (i = 0; i < located.length; i++) {
      var a = list[located[i]];
      if (!a._cmp) continue;
      for (j = i + 1; j < located.length; j++) {
        var b = list[located[j]];
        if (b.locStart - a.locStart > WINDOW) break;
        if (!b._cmp) continue;
        if (a._cmp === b._cmp) stats.exactPairs++;
        if (!contains(a._cmp, b._cmp)) continue;
        stats.containmentPairs++;
        uf.union(offset + located[i], offset + located[j]);
      }
    }

    // 3. Records with no location fall back to a book-local substring pass.
    for (i = 0; i < loose.length; i++) {
      var x = list[loose[i]];
      if (!x._cmp) continue;
      for (j = 0; j < list.length; j++) {
        if (j === loose[i] || !list[j]._cmp) continue;
        if (!contains(x._cmp, list[j]._cmp)) continue;
        stats.containmentPairs++;
        uf.union(offset + loose[i], offset + j);
      }
    }
  }

  // records: highlights only, each carrying _cmp (compare text) and bookKey.
  KC.dedupe = function (records) {
    var stats = { overlapPairs: 0, containmentPairs: 0, exactPairs: 0, components: 0, multiComponents: 0 };
    var uf = makeUF(records.length);
    var byBook = {}, i, key;

    for (i = 0; i < records.length; i++) {
      key = records[i].bookKey;
      (byBook[key] || (byBook[key] = [])).push(i);
    }

    for (key in byBook) {
      if (!Object.prototype.hasOwnProperty.call(byBook, key)) continue;
      var idx = byBook[key];
      var list = [];
      for (i = 0; i < idx.length; i++) list.push(records[idx[i]]);
      // linkBook works in `list` space; remap unions back to the global index space.
      var localUF = {
        find: function () { return 0; },
        union: function (a, b) { uf.union(idx[a], idx[b]); }
      };
      linkBook(list, localUF, 0, stats);
    }

    // Fold each component down to its single best survivor.
    var champ = {}, root;
    for (i = 0; i < records.length; i++) {
      root = uf.find(i);
      champ[root] = champ[root] === undefined ? i : (better(records[champ[root]], records[i]) === records[i] ? i : champ[root]);
    }

    var survivors = [], duplicatesOf = {};
    for (i = 0; i < records.length; i++) {
      root = uf.find(i);
      if (champ[root] === i) survivors.push(records[i]);
    }
    for (i = 0; i < records.length; i++) {
      root = uf.find(i);
      if (champ[root] === i) continue;
      var sid = records[champ[root]].id;
      (duplicatesOf[sid] || (duplicatesOf[sid] = [])).push(records[i]);
    }

    survivors.sort(function (a, b) { return a.order - b.order; });

    var size = {};
    for (i = 0; i < records.length; i++) {
      root = uf.find(i);
      size[root] = (size[root] || 0) + 1;
    }
    for (root in size) {
      if (!Object.prototype.hasOwnProperty.call(size, root)) continue;
      stats.components++;
      if (size[root] > 1) stats.multiComponents++;
    }
    stats.merged = records.length - survivors.length;
    return { survivors: survivors, duplicatesOf: duplicatesOf, stats: stats };
  };
})(window.KC = window.KC || {});
