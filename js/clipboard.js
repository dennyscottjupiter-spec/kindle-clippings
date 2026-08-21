// ---
// purpose: Make the invisible book hashtag ride along with every copy, by two independent paths
// exports: KC.clipboard.install(), KC.clipboard.copyText(text)
// depends: nothing (KC.ui.toast is called by app.js, not here)
// gotcha: navigator.clipboard.writeText never resolves under browser automation — always race a timeout
// ---
(function (KC) {
  'use strict';

  var RACE_MS = 600;

  function tagsInSelection(sel) {
    var nodes = document.querySelectorAll('[data-tag]');
    var seen = {}, out = [], r, i, j;
    for (i = 0; i < nodes.length; i++) {
      var tag = nodes[i].getAttribute('data-tag');
      if (seen[tag]) continue;
      for (j = 0; j < sel.rangeCount; j++) {
        r = sel.getRangeAt(j);
        if (!r.intersectsNode || !r.intersectsNode(nodes[i])) continue;
        seen[tag] = true;
        out.push(tag);
        break;
      }
    }
    return out;
  }

  // The .sr-only span may already have contributed the tag to the selection string,
  // so strip every occurrence first and append the unique set exactly once.
  function withTags(text, tags) {
    var out = text, i;
    for (i = 0; i < tags.length; i++) out = out.split(tags[i]).join('');
    out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return out + '\n\n' + tags.join(' ');
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  KC.clipboard = {
    withTags: withTags,

    install: function () {
      document.addEventListener('copy', function (e) {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !e.clipboardData) return;
        var tags = tagsInSelection(sel);
        if (!tags.length) return;
        var text = withTags(sel.toString(), tags);
        e.clipboardData.setData('text/plain', text);
        e.clipboardData.setData('text/html', '<pre>' + escapeHtml(text) + '</pre>');
        e.preventDefault();
      });
    },

    // Resolves true/false. Never assert on the clipboard's contents in a test — assert on the toast.
    copyText: function (text) {
      if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
        return new Promise(function (resolve) {
          var settled = false;
          var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            resolve(legacyCopy(text));
          }, RACE_MS);
          navigator.clipboard.writeText(text).then(function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(true);
          }, function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(legacyCopy(text));
          });
        });
      }
      return Promise.resolve(legacyCopy(text));
    }
  };
})(window.KC = window.KC || {});
