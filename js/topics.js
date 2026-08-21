// ---
// purpose: Fixed 15-topic taxonomy + Open Library subject -> topic classifier
// exports: KC.topics.list, KC.topics.byId, KC.topics.classify(subjects), KC.topics.hueOf(id), KC.topics.label(id)
// gotcha: ids are stable storage keys — never rename one without migrating kc.library.v1
// ---
(function (KC) {
  'use strict';

  var LIST = [
    { id: 'psychology',  h: 285, kw: ['psychology','psychiatry','cognitive','behavior','behaviour','mental health','emotions','neuroscience','mind'] },
    { id: 'selfhelp',    h: 44,  kw: ['self-help','self help','personal development','habits','productivity','motivation','success','time management'] },
    { id: 'business',    h: 212, kw: ['business','management','leadership','entrepreneurship','marketing','startups','organizational','negotiation'] },
    { id: 'economics',   h: 172, kw: ['economics','finance','investment','money','capitalism','markets','trade','personal finance'] },
    { id: 'philosophy',  h: 258, kw: ['philosophy','ethics','stoicism','logic','metaphysics','existential','epistemology'] },
    { id: 'history',     h: 26,  kw: ['history','historiography','ancient','medieval','world war','civilization','empire','revolution'] },
    { id: 'science',     h: 152, kw: ['science','physics','biology','chemistry','evolution','astronomy','mathematics','nature','environment','climate'] },
    { id: 'technology',  h: 232, kw: ['computer','technology','software','programming','artificial intelligence','internet','engineering','data','design patterns'] },
    { id: 'health',      h: 132, kw: ['health','fitness','nutrition','diet','medicine','sleep','exercise','wellness','longevity'] },
    { id: 'fiction',     h: 318, kw: ['fiction','novel','literature','fantasy','science fiction','short stories','poetry','drama','romance','thriller'] },
    { id: 'biography',   h: 350, kw: ['biography','autobiography','memoir','diaries','correspondence','personal narratives'] },
    { id: 'politics',    h: 8,   kw: ['politics','political','government','democracy','war','international relations','law','justice','sociology','social'] },
    { id: 'religion',    h: 300, kw: ['religion','spirituality','buddhism','christianity','meditation','theology','islam','faith','mindfulness'] },
    { id: 'education',   h: 195, kw: ['education','study','learning','teaching','language','writing','rhetoric','reference','communication'] },
    { id: 'arts',        h: 92,  kw: ['art','music','film','photography','architecture','design','culture','painting','theater'] }
  ];
  var FALLBACK_ID = 'uncategorized';

  var byId = {};
  for (var i = 0; i < LIST.length; i++) {
    LIST[i].i = i;
    byId[LIST[i].id] = LIST[i];
  }

  function classify(subjects) {
    if (!subjects || !subjects.length) return FALLBACK_ID;
    var blob = subjects.slice(0, 40).join(' | ').toLowerCase();
    var bestId = FALLBACK_ID, bestScore = 0;
    for (var i = 0; i < LIST.length; i++) {
      var score = 0;
      for (var j = 0; j < LIST[i].kw.length; j++) {
        if (blob.indexOf(LIST[i].kw[j]) !== -1) score++;
      }
      if (score > bestScore) { bestScore = score; bestId = LIST[i].id; }
    }
    return bestScore > 0 ? bestId : FALLBACK_ID;
  }

  function hueOf(id) {
    return byId[id] ? byId[id].h : null;
  }

  function label(id) {
    return KC.i18n.t('topic.' + id);
  }

  KC.topics = {
    list: LIST,
    byId: byId,
    classify: classify,
    hueOf: hueOf,
    label: label
  };
})(window.KC = window.KC || {});
