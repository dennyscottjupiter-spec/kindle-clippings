// ---
// purpose: Render one highlight to a JPEG quote card at a chosen screen size (landscape or portrait)
// exports: KC.quotecard.SIZES/draw()/toBlob()/download()
// depends: nothing (canvas only, no network, no fonts loaded)
// gotcha: draw() works in CSS pixels — it sets canvas.width = w * scale and ctx.scale(scale, scale),
//   so every coordinate below is in `w` x `h` space, never device pixels. Type and padding derive
//   from `base = Math.min(w, h)` so a tall phone card does not get giant fonts.
// gotcha: THEMES/accentOf colors are literals mirroring css/tokens.css — update both on a repaint.
// ---
(function (KC) {
  'use strict';

  var SIZES = [
    { id: 'nesthub', w: 1024, h: 600, label: 'Nest Hub 7"' },
    { id: 'fhd', w: 1920, h: 1080, label: 'Full HD 1080p' },
    { id: 'qhd', w: 2560, h: 1440, label: '2K / QHD 1440p' },
    { id: 'iphone', w: 1290, h: 2796, label: 'iPhone' },
    { id: 'android', w: 1080, h: 2400, label: 'Android' },
    { id: 'square', w: 1080, h: 1080, label: 'Square' }
  ];

  // Literals mirror the amber/ink palette in css/tokens.css (a canvas can't read custom
  // properties) — update both places together if that palette changes.
  var THEMES = {
    dark: { a: '#16130F', b: '#2A231C', text: '#F2EAE0', muted: '#A79A8D', quote: 'rgba(242,234,224,.07)' },
    light: { a: '#FFFFFF', b: '#FFFDFA', text: '#1C1917', muted: '#6B5F55', quote: 'rgba(28,25,23,.06)' },
    paper: { a: '#FAF7F2', b: '#F1EBE1', text: '#1C1917', muted: '#6B5F55', quote: 'rgba(28,25,23,.07)' }
  };

  // "Fraunces"/"Inter" lead the stacks opportunistically: if the app has already loaded them
  // elsewhere on the page, canvas text uses them; if not, it silently falls back to the next
  // name (spec behaviour, no error/blank glyphs) — this module still loads no fonts itself.
  var SERIF = '"Fraunces", Georgia, "Iowan Old Style", "Times New Roman", serif';
  var SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';
  var LH = 1.35;

  // JPEG quality: below ~0.85 glyph edges on the flat card background show ringing artifacts.
  var JPEG_QUALITY = 0.92;

  // The fallback follows the ground it sits on, exactly as css/tokens.css does: the lifted amber
  // reads on the dark card, the deeper one on the two pale ones (it would wash out at #E8853C).
  function accentOf(hue, theme) {
    if (typeof hue === 'number') return 'hsl(' + hue + ',70%,55%)';
    return theme === 'dark' ? '#E8853C' : '#C2410C';
  }

  // A real measured wrap: a word that cannot fit alone is hard-broken mid-word rather than
  // silently overflowing the text box.
  function wrapLines(ctx, text, maxW) {
    var words = String(text || '').split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w) continue;
      var trial = cur ? cur + ' ' + w : w;
      if (ctx.measureText(trial).width <= maxW) { cur = trial; continue; }
      if (cur) { lines.push(cur); cur = ''; }
      while (ctx.measureText(w).width > maxW && w.length > 1) {
        var n = 1;
        while (n < w.length && ctx.measureText(w.slice(0, n + 1)).width <= maxW) n++;
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      cur = w;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function ellipsize(ctx, text, maxW) {
    var s = String(text || '');
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s.replace(/\s+$/, '') + '…';
  }

  // Largest font size (integer px) whose wrapped block still fits the box.
  function fitSize(ctx, text, maxW, boxH, min, max) {
    var lo = min, hi = max, best = min;
    while (lo <= hi) {
      var mid = Math.floor((lo + hi) / 2);
      ctx.font = mid + 'px ' + SERIF;
      var lines = wrapLines(ctx, text, maxW);
      if (lines.length * mid * LH <= boxH) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return best;
  }

  function letterText(ctx, text, x, y, tracking) {
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = tracking + 'px';
      ctx.fillText(text, x, y);
      ctx.letterSpacing = '0px';
      return;
    }
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text.charAt(i), cx, y);
      cx += ctx.measureText(text.charAt(i)).width + tracking;
    }
  }

  function draw(canvas, rec, opts) {
    opts = opts || {};
    var w = opts.w || SIZES[0].w, h = opts.h || SIZES[0].h;
    var scale = opts.scale || 1;
    var th = THEMES[opts.theme] || THEMES.dark;
    var hue = typeof opts.hue === 'number' ? opts.hue : null;
    var accent = accentOf(hue, opts.theme);

    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(scale, scale);

    var grad = ctx.createLinearGradient(0, 0, w * 0.35, h);
    grad.addColorStop(0, th.a);
    grad.addColorStop(1, th.b);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Tint, never dye: a flat 10% wash keeps the theme recognisable at any hue.
    if (hue !== null) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = 'hsl(' + hue + ',60%,50%)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 6, h);

    // Everything vertical scales off the SHORT side, so a portrait card gets phone-sized type
    // instead of type derived from its 2796px height.
    var base = Math.min(w, h);
    var padX = w * 0.09, padY = base * 0.1;
    var left = padX + 6;
    var maxW = w - left - padX;

    var titleSize = Math.max(12, Math.min(30, Math.round(base * 0.032)));
    var authorSize = Math.round(titleSize * 0.9);
    var author = String((rec && rec.author) || '').trim();

    var authorY = h - padY;
    var titleY = author ? authorY - authorSize * 1.7 : authorY;
    var ruleY = titleY - titleSize * 1.6;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    ctx.fillStyle = accent;
    ctx.fillRect(left, ruleY, Math.min(maxW, w * 0.09), 3);

    ctx.font = '600 ' + titleSize + 'px ' + SANS;
    ctx.fillStyle = th.text;
    var title = ellipsize(ctx, String((rec && rec.title) || '').toUpperCase(), maxW - titleSize * 2);
    letterText(ctx, title, left, titleY, titleSize * 0.14);

    if (author) {
      ctx.font = authorSize + 'px ' + SANS;
      ctx.fillStyle = th.muted;
      ctx.fillText(ellipsize(ctx, author, maxW), left, authorY);
    }

    var boxTop = padY;
    var boxBottom = ruleY - base * 0.06;
    var boxH = Math.max(base * 0.1, boxBottom - boxTop);

    // Decorative opening mark, behind the quote and barely there.
    var qSize = base * 0.3;
    ctx.font = qSize + 'px ' + SERIF;
    ctx.fillStyle = th.quote;
    ctx.fillText('“', left - qSize * 0.06, boxTop + qSize * 0.72);

    var text = String((rec && rec.text) || '').replace(/\s+/g, ' ').trim();
    var min = Math.max(10, Math.round(base / 28)), max = Math.max(min, Math.round(base / 9));
    var size = fitSize(ctx, text, maxW, boxH, min, max);
    ctx.font = size + 'px ' + SERIF;
    var lines = wrapLines(ctx, text, maxW);

    // Even at the minimum size a very long highlight can overflow — cut it on a word boundary.
    var maxLines = Math.max(1, Math.floor(boxH / (size * LH)));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1] + ' …', maxW);
    }

    ctx.fillStyle = th.text;
    var blockH = lines.length * size * LH;
    var y = boxTop + Math.max(0, (boxH - blockH) / 2) + size;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], left, y + i * size * LH);
    }

    ctx.restore();
    return canvas;
  }

  function toBlob(rec, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    draw(canvas, rec, opts);
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error('toBlob failed'));
        }, 'image/jpeg', JPEG_QUALITY);
        return;
      }
      var url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      var bin = atob(url.split(',')[1]);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/jpeg' }));
    });
  }

  function download(rec, opts, filename) {
    return toBlob(rec, opts).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'quote.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      return blob;
    });
  }

  KC.quotecard = { SIZES: SIZES, draw: draw, toBlob: toBlob, download: download };
})(window.KC = window.KC || {});
