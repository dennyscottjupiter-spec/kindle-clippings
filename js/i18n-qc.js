// ---
// purpose: Quote-card gallery strings (pt-BR/en) — order, book filter, live count, empty states
// exports: nothing — registers its catalog into KC.i18n at load
// depends: js/i18n.js
// gotcha: must not collide with the qc.* keys already in js/i18n.js (title, source, theme, size…)
// ---
(function (KC) {
  'use strict';

  KC.i18n.add({
    'pt-BR': {
      'qc.source': 'Origem',
      'qc.sort': 'Ordem',
      'qc.sort.dateDesc': 'Mais recentes',
      'qc.sort.dateAsc': 'Mais antigas',
      'qc.sort.book': 'Livro (A–Z)',
      'qc.sort.text': 'Citação (A–Z)',
      'qc.sort.long': 'Mais longas',
      'qc.book': 'Livro',
      'qc.book.all': 'Todos os livros',
      'qc.book.opt': '{title} · {n}',
      'qc.find': 'Busca',
      'qc.count': '{n} de {total}',
      'qc.clear': 'Limpar filtros',
      'qc.empty.title': 'Nenhuma citação com esses filtros',
      'qc.empty.hint': 'Escolha outro livro, apague a busca ou troque a origem.'
    },
    'en': {
      'qc.source': 'Source',
      'qc.sort': 'Order',
      'qc.sort.dateDesc': 'Newest first',
      'qc.sort.dateAsc': 'Oldest first',
      'qc.sort.book': 'Book (A–Z)',
      'qc.sort.text': 'Quote (A–Z)',
      'qc.sort.long': 'Longest first',
      'qc.book': 'Book',
      'qc.book.all': 'All books',
      'qc.book.opt': '{title} · {n}',
      'qc.find': 'Search',
      'qc.count': '{n} of {total}',
      'qc.clear': 'Clear filters',
      'qc.empty.title': 'No quotes match these filters',
      'qc.empty.hint': 'Pick another book, clear the search, or switch the source.'
    }
  });
})(window.KC = window.KC || {});
