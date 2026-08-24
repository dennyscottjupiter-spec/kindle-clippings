// ---
// purpose: App version string + changelog data — the single source of truth for the About panel
// exports: KC.version.CURRENT, KC.version.RELEASES
// gotcha: pure data, no DOM — loaded early in index.html, well before js/aboutview.js runs
// ---
(function (KC) {
  'use strict';

  var CURRENT = '2.0.0';

  // Newest first. Each `changes` entry is an i18n key resolved against js/i18n-about.js by
  // js/aboutview.js, so the release history reads correctly in both pt-BR and en.
  var RELEASES = [
    {
      version: '2.0.0',
      date: '2026-08-24',
      changes: [
        'about.rel.2_0_0.1', 'about.rel.2_0_0.2', 'about.rel.2_0_0.3', 'about.rel.2_0_0.4',
        'about.rel.2_0_0.5', 'about.rel.2_0_0.6', 'about.rel.2_0_0.7', 'about.rel.2_0_0.8'
      ]
    },
    {
      version: '1.3.0',
      date: '2026-08-22',
      changes: ['about.rel.1_3_0.1', 'about.rel.1_3_0.2', 'about.rel.1_3_0.3', 'about.rel.1_3_0.4']
    },
    {
      version: '1.2.0',
      date: '2026-08-21',
      changes: ['about.rel.1_2_0.1', 'about.rel.1_2_0.2', 'about.rel.1_2_0.3', 'about.rel.1_2_0.4']
    },
    {
      version: '1.1.0',
      date: '2026-08-21',
      changes: [
        'about.rel.1_1_0.1', 'about.rel.1_1_0.2', 'about.rel.1_1_0.3',
        'about.rel.1_1_0.4', 'about.rel.1_1_0.5'
      ]
    },
    {
      version: '1.0.0',
      date: '2026-08-21',
      changes: [
        'about.rel.1_0_0.1', 'about.rel.1_0_0.2', 'about.rel.1_0_0.3',
        'about.rel.1_0_0.4', 'about.rel.1_0_0.5'
      ]
    }
  ];

  KC.version = { CURRENT: CURRENT, RELEASES: RELEASES };
})(window.KC = window.KC || {});
