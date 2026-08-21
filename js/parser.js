// ---
// purpose: Parse Kindle "My Clippings.txt" into structured records (English + Brazilian Portuguese)
// exports: KC.parse(text)
// gotcha: author is the LAST balanced paren group; BOM must be stripped before splitting
// ---
(function (KC) {
  'use strict';

  var SEPARATOR = /^[ \t]*={10}[ \t]*$/m;

  // Type keywords, checked in this order. All keywords are ASCII so \b is safe.
  var TYPE_WORDS = [
    { type: 'bookmark', re: /\b(bookmark|marcador)\b/i },
    { type: 'note', re: /\b(note|nota)\b/i },
    { type: 'clipping', re: /\b(clipping|recorte)\b/i },
    { type: 'highlight', re: /\b(highlight|destaque|subrayado)\b/i }
  ];

  // "Added on <date>" / "Adicionado: <date>" / "Adicionado em <date>"
  var DATE_LABEL = /(?:added\s+on|adicionado(?:\s+em)?\s*:?)\s*(.+)$/i;

  var PAGE_RE = /(?:page|p[áa]gina)\s+([0-9ivxlcdm]+)/i;
  var LOC_RE = /(?:location|posi[çc][ãa]o|posicao)\s*(?:n[o°.]*\s*)?(\d+)(?:\s*[-–]\s*(\d+))?/i;
  var CLIP_LIMIT_RE = /^<.*(?:clipping limit|limite de recorte).*>$/i;

  var PT_MONTHS = {
    janeiro: 0, fevereiro: 1, 'março': 2, marco: 2, abril: 3, maio: 4, junho: 5,
    julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
  };

  // Splits "Title (Sub) (Author, Name)" by scanning backwards for the match of the final ')'.
  function splitTitleAuthor(line) {
    var s = line.trim();
    if (s.charAt(s.length - 1) !== ')') return { title: s, author: '' };
    var depth = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      var c = s.charAt(i);
      if (c === ')') depth++;
      else if (c === '(') {
        depth--;
        if (depth === 0) {
          var title = s.slice(0, i).trim();
          var author = s.slice(i + 1, -1).trim().replace(/\s+/g, ' ');
          if (!title) return { title: s, author: '' };
          return { title: title, author: author };
        }
      }
    }
    return { title: s, author: '' };
  }

  function detectType(meta) {
    for (var i = 0; i < TYPE_WORDS.length; i++) {
      if (TYPE_WORDS[i].re.test(meta)) return TYPE_WORDS[i].type;
    }
    return 'unknown';
  }

  // Roman numerals appear as page numbers in front matter; keep them as a string.
  function parsePage(meta) {
    var m = meta.match(PAGE_RE);
    return m ? m[1] : '';
  }

  function parseLocation(meta) {
    var m = meta.match(LOC_RE);
    if (m) {
      return { start: parseInt(m[1], 10), end: m[2] ? parseInt(m[2], 10) : parseInt(m[1], 10) };
    }
    // Locale we do not know: take the last number run before the date label.
    var head = meta.split(DATE_LABEL)[0];
    var nums = head.match(/(\d+)(?:\s*[-–]\s*(\d+))?/g);
    if (nums && nums.length) {
      var last = nums[nums.length - 1].match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
      return { start: parseInt(last[1], 10), end: last[2] ? parseInt(last[2], 10) : parseInt(last[1], 10) };
    }
    return { start: null, end: null };
  }

  function parseDate(raw) {
    if (!raw) return null;
    var s = raw.trim();
    // Portuguese: "segunda-feira, 23 de março de 2015 00:22:06"
    var pt = s.match(/(\d{1,2})\s+de\s+([a-zçãé]+)\s+de\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/i);
    if (pt) {
      var mo = PT_MONTHS[pt[2].toLowerCase()];
      if (mo !== undefined) {
        return new Date(+pt[3], mo, +pt[1], +(pt[4] || 0), +(pt[5] || 0), +(pt[6] || 0)).getTime();
      }
    }
    // English: strip the weekday, then let the engine do it.
    var en = s.replace(/^[^,]+,\s*/, '');
    var t = Date.parse(en);
    if (!isNaN(t)) return t;
    t = Date.parse(s);
    return isNaN(t) ? null : t;
  }

  function parseBlock(block, index) {
    var lines = block.split('\n');
    var i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) return null;

    var titleLine = lines[i].trim();
    var metaLine = (lines[i + 1] || '').trim();
    var body = lines.slice(i + 2).join('\n').replace(/^\s*\n/, '').trim();

    // A block with no metadata line is not a record.
    if (!metaLine || metaLine.charAt(0) !== '-') return null;

    var ta = splitTitleAuthor(titleLine);
    var dm = metaLine.match(DATE_LABEL);
    var loc = parseLocation(metaLine);
    var type = detectType(metaLine);

    return {
      id: 'r' + index,
      order: index,
      title: ta.title,
      author: ta.author,
      type: type,
      page: parsePage(metaLine),
      locStart: loc.start,
      locEnd: loc.end,
      dateRaw: dm ? dm[1].trim() : '',
      dateMs: dm ? parseDate(dm[1]) : null,
      metaRaw: metaLine,
      text: body,
      clipLimit: CLIP_LIMIT_RE.test(body)
    };
  }

  KC.parse = function (text) {
    var clean = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var blocks = clean.split(SEPARATOR);
    var records = [];
    var unparsed = 0;

    for (var i = 0; i < blocks.length; i++) {
      if (!blocks[i].trim()) continue;
      var rec = parseBlock(blocks[i], records.length);
      if (rec) records.push(rec);
      else unparsed++;
    }

    return { records: records, unparsed: unparsed, blocks: blocks.length };
  };

  KC.splitTitleAuthor = splitTitleAuthor;
  KC.parseDate = parseDate;
})(window.KC = window.KC || {});
