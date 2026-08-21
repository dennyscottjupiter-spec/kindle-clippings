// ---
// purpose: Pure statistics over cleaned records — totals, per-book, time histograms, streaks
// exports: KC.stats.compute(visible, books, lib)
// depends: nothing (no DOM, no browser globals — must stay loadable in tests/harness.js)
// gotcha: day buckets use LOCAL calendar days, so a streak matches what the reader saw on the device
// ---
(function (KC) {
  'use strict';

  var DAY = 86400000;

  function words(s) {
    var m = String(s || '').trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  // Local calendar day as a whole number of days, so consecutive days differ by exactly 1.
  function dayIndex(ms) {
    var d = new Date(ms);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
  }

  function monthKey(ms) {
    var d = new Date(ms);
    var m = d.getMonth() + 1;
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m);
  }

  function streaks(dayList) {
    if (!dayList.length) return { longest: 0, current: 0 };
    var longest = 1, run = 1, i;
    for (i = 1; i < dayList.length; i++) {
      run = dayList[i] === dayList[i - 1] + 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    // "Current" is the streak ending on the last day that has highlights, not on today —
    // the file is a historical export and may be months old.
    return { longest: longest, current: run };
  }

  KC.stats = {
    compute: function (visible, books, lib) {
      lib = lib || {};
      var perBook = {}, byYear = {}, byMonth = {}, byTopic = {};
      var byWeekday = [0, 0, 0, 0, 0, 0, 0];
      var byHour = [], perDay = {};
      var highlights = 0, notes = 0, bookmarks = 0, totalWords = 0, totalChars = 0;
      var firstMs = null, lastMs = null;
      var longest = null;
      var i, h;

      for (i = 0; i < 24; i++) byHour.push(0);

      for (i = 0; i < books.length; i++) {
        perBook[books[i].key] = {
          key: books[i].key, title: books[i].title, author: books[i].author,
          count: 0, words: 0, notes: 0, topic: (lib[books[i].key] && lib[books[i].key].topic) || 'uncategorized'
        };
      }

      function bookOf(rec) {
        if (!perBook[rec.bookKey]) {
          perBook[rec.bookKey] = { key: rec.bookKey, title: rec.title, author: rec.author,
            count: 0, words: 0, notes: 0, topic: 'uncategorized' };
        }
        return perBook[rec.bookKey];
      }

      for (i = 0; i < visible.length; i++) {
        var rec = visible[i];
        if (rec.deviceFooter) continue;
        var b = bookOf(rec);
        var isHighlight = rec.type === 'highlight' || rec.type === 'clipping';

        if (isHighlight) {
          var w = words(rec.text);
          highlights++;
          totalWords += w;
          totalChars += String(rec.text || '').length;
          b.count++;
          b.words += w;
          if (!longest || w > longest.words) longest = { words: w, text: rec.text, title: b.title };
        } else if (rec.type === 'note') {
          notes++;
          b.notes++;
        } else if (rec.type === 'bookmark') {
          bookmarks++;
        }
        if (rec.note) { notes++; b.notes++; }

        if (rec.dateMs) {
          if (firstMs === null || rec.dateMs < firstMs) firstMs = rec.dateMs;
          if (lastMs === null || rec.dateMs > lastMs) lastMs = rec.dateMs;
          if (isHighlight) {
            var d = new Date(rec.dateMs);
            byYear[d.getFullYear()] = (byYear[d.getFullYear()] || 0) + 1;
            var mk = monthKey(rec.dateMs);
            byMonth[mk] = (byMonth[mk] || 0) + 1;
            byWeekday[d.getDay()]++;
            byHour[d.getHours()]++;
            var di = dayIndex(rec.dateMs);
            perDay[di] = (perDay[di] || 0) + 1;
          }
        }
      }

      var bookList = [];
      for (h in perBook) if (perBook[h].count || perBook[h].notes) bookList.push(perBook[h]);
      bookList.sort(function (a, b2) { return b2.count - a.count || a.title.localeCompare(b2.title); });

      for (i = 0; i < bookList.length; i++) {
        var tk = bookList[i].topic;
        if (!byTopic[tk]) byTopic[tk] = { topic: tk, books: 0, count: 0 };
        byTopic[tk].books++;
        byTopic[tk].count += bookList[i].count;
      }
      var topicList = [];
      for (h in byTopic) topicList.push(byTopic[h]);
      topicList.sort(function (a, b2) { return b2.count - a.count; });

      var yearList = [];
      for (h in byYear) yearList.push({ year: Number(h), count: byYear[h] });
      yearList.sort(function (a, b2) { return a.year - b2.year; });

      var monthList = [];
      for (h in byMonth) monthList.push({ key: h, count: byMonth[h] });
      monthList.sort(function (a, b2) { return a.key < b2.key ? -1 : 1; });

      var days = [], busiest = null;
      for (h in perDay) {
        days.push(Number(h));
        if (!busiest || perDay[h] > busiest.count) busiest = { day: Number(h), count: perDay[h] };
      }
      days.sort(function (a, b2) { return a - b2; });
      var st = streaks(days);

      return {
        highlights: highlights,
        notes: notes,
        bookmarks: bookmarks,
        books: bookList.length,
        words: totalWords,
        chars: totalChars,
        avgWords: highlights ? Math.round(totalWords / highlights) : 0,
        perBookAvg: bookList.length ? Math.round(highlights / bookList.length) : 0,
        longest: longest,
        topBooks: bookList,
        topics: topicList,
        byYear: yearList,
        byMonth: monthList,
        byWeekday: byWeekday,
        byHour: byHour,
        firstMs: firstMs,
        lastMs: lastMs,
        spanDays: (firstMs !== null && lastMs !== null) ? Math.round((lastMs - firstMs) / DAY) : 0,
        activeDays: days.length,
        busiestDay: busiest ? { ms: busiest.day * DAY, count: busiest.count } : null,
        longestStreak: st.longest,
        currentStreak: st.current
      };
    }
  };
})(window.KC = window.KC || {});
