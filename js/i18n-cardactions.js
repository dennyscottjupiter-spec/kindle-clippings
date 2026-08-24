// ---
// purpose: Register per-card action strings (save as image, export this highlight) into both catalogs
// exports: nothing — side effect only (KC.i18n.add)
// depends: js/i18n.js — index.html loads this immediately after it, before any render
// gotcha: the four export-format labels are NOT duplicated here — js/cardactions.js reuses the
//   existing export.md / export.json / export.txt / export.anki / export.menu / export.done keys
// ---
(function (KC) {
  'use strict';

  KC.i18n.add({
    'pt-BR': {
      'ca.img.aria': 'Baixar esta citação como imagem JPEG',
      'ca.img.done': 'Imagem baixada',
      'ca.img.failed': 'Não foi possível gerar a imagem',
      'ca.export.aria': 'Exportar este destaque'
    },
    'en': {
      'ca.img.aria': 'Download this highlight as a JPEG image',
      'ca.img.done': 'Image downloaded',
      'ca.img.failed': 'Could not create the image',
      'ca.export.aria': 'Export this highlight'
    }
  });
})(window.KC = window.KC || {});
