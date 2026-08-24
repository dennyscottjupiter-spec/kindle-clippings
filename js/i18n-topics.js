// ---
// purpose: Strings for the topic-discovery prompt shown when covers/topics are off
// exports: nothing — registers 'topic.discover.*' into the shared i18n catalog
// depends: js/i18n.js (KC.i18n.add)
// ---
(function (KC) {
  'use strict';

  KC.i18n.add({
    'pt-BR': {
      'topic.discover.text': 'Os temas vêm do openlibrary.org, a partir do título e autor de cada livro — nenhum destaque é enviado.',
      'topic.discover.cta': 'Ativar temas'
    },
    'en': {
      'topic.discover.text': "Topics come from openlibrary.org, looked up by each book's title and author — no highlight is ever sent.",
      'topic.discover.cta': 'Turn on topics'
    }
  });
})(window.KC = window.KC || {});
