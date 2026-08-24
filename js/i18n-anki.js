// ---
// purpose: Register the Anki button's strings into both catalogs
// exports: nothing — side effect only (KC.i18n.add)
// depends: js/i18n.js — index.html loads this immediately after it, before any render
// ---
(function (KC) {
  'use strict';

  KC.i18n.add({
    'pt-BR': {
      'anki.button': 'Anki',
      'tip.anki': 'Baixa os destaques que você está vendo como um arquivo de texto pronto para virar flashcards: a frente é o destaque, o verso é o livro, o autor e onde você marcou. No Anki, abra Arquivo → Importar e escolha esse arquivo — as colunas e as etiquetas já vêm prontas.',
      'anki.done': 'Arquivo do Anki baixado',
      'anki.empty': 'Nada para exportar — nenhum destaque está visível agora'
    },
    'en': {
      'anki.button': 'Anki',
      'tip.anki': 'Downloads the highlights you are looking at as a text file ready to become flashcards: the front is the highlight, the back is the book, author and where you marked it. In Anki, open File → Import and pick this file — the columns and tags are already set up.',
      'anki.done': 'Anki file downloaded',
      'anki.empty': 'Nothing to export — no highlights are visible right now'
    }
  });
})(window.KC = window.KC || {});
