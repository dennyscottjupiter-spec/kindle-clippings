// ---
// purpose: i18n catalog + helpers (pt-BR/en) for the Kindle clippings viewer
// exports: KC.i18n.t(), setLang(), num(), date(), fold(), lang
// gotcha: fold() is for SEARCH only; dedup comparison keeps accents (see clean.js)
// ---
(function (KC) {
  'use strict';

  var CATALOG = {
    'pt-BR': {
      'app.title': 'Meus Destaques do Kindle',
      'app.subtitle': 'Organize e exporte seus destaques',
      'drop.title': 'Arraste seu arquivo de destaques aqui',
      'drop.hint': 'ou clique para selecionar o arquivo My Clippings.txt',
      'drop.button': 'Selecionar arquivo',
      'sidebar.all': 'Todos os livros',
      'sidebar.heading': 'Livros',
      'sidebar.empty': 'Nenhum livro encontrado',
      'search.placeholder': 'Pesquisar destaques...',
      'toggle.hidden.show': 'Mostrar ocultos',
      'toggle.hidden.hide': 'Ocultar duplicatas',
      'toggle.theme': 'Alternar tema',
      'toggle.lang': 'Idioma',
      'toggle.books': 'Livros',
      'stats.line': '{records} destaques · {books} livros',
      'stats.duplicates': '{n} possíveis duplicatas ocultas',
      'stats.bookmarks': '{n} marcadores vazios',
      'stats.clipLimit': '{n} com limite de recorte',
      'stats.unparsed': '{n} blocos não reconhecidos',
      'type.highlight': 'Destaque',
      'type.note': 'Nota',
      'type.bookmark': 'Marcador',
      'type.clipping': 'Recorte',
      'type.unknown': 'Desconhecido',
      'card.copy': 'Copiar',
      'card.copied': 'Copiado com a hashtag do livro',
      'card.possibleDuplicate': 'possível duplicata',
      'card.duplicatesHidden': '{n} variante(s) oculta(s)',
      'card.truncated': 'texto truncado pelo limite do editor',
      'card.noteLabel': 'Nota:',
      'card.noteNear': 'associação aproximada',
      'meta.page': 'p. {n}',
      'meta.loc': 'pos. {range}',
      'export.menu': 'Exportar',
      'export.md': 'Markdown',
      'export.mdBook': 'Markdown (por livro)',
      'export.json': 'JSON',
      'export.csv': 'CSV',
      'export.txt': 'Texto',
      'export.anki': 'Anki',
      'export.done': 'Exportação concluída',
      'empty.noResults': 'Nenhum resultado encontrado',
      'empty.noFile': 'Nenhum arquivo carregado',
      'error.read': 'Erro ao ler o arquivo',
      'error.empty': 'O arquivo está vazio',
      'footer.privacy': 'Nada sai deste dispositivo.',
      'lang.pt': 'PT',
      'lang.en': 'EN',
      'ex.title': 'Meus destaques',
      'ex.exported': 'Exportado em',
      'ex.book': 'Livro',
      'ex.author': 'Autor',
      'ex.page': 'Página',
      'ex.loc': 'Localização',
      'ex.date': 'Data',
      'ex.text': 'Texto',
      'ex.type': 'Tipo',
      'ex.tag': 'Tag',
      'ex.note': 'Nota',
      'ex.allBooks': 'Todos os livros'
    },
    'en': {
      'app.title': 'My Kindle Highlights',
      'app.subtitle': 'Organize and export your highlights',
      'drop.title': 'Drag your clippings file here',
      'drop.hint': 'or click to select the My Clippings.txt file',
      'drop.button': 'Select file',
      'sidebar.all': 'All books',
      'sidebar.heading': 'Books',
      'sidebar.empty': 'No books found',
      'search.placeholder': 'Search highlights...',
      'toggle.hidden.show': 'Show hidden',
      'toggle.hidden.hide': 'Hide duplicates',
      'toggle.theme': 'Toggle theme',
      'toggle.lang': 'Language',
      'toggle.books': 'Books',
      'stats.line': '{records} highlights · {books} books',
      'stats.duplicates': '{n} possible duplicates hidden',
      'stats.bookmarks': '{n} empty bookmarks',
      'stats.clipLimit': '{n} at clipping limit',
      'stats.unparsed': '{n} unrecognised blocks',
      'type.highlight': 'Highlight',
      'type.note': 'Note',
      'type.bookmark': 'Bookmark',
      'type.clipping': 'Clipping',
      'type.unknown': 'Unknown',
      'card.copy': 'Copy',
      'card.copied': 'Copied with the book hashtag',
      'card.possibleDuplicate': 'possible duplicate',
      'card.duplicatesHidden': '{n} hidden variant(s)',
      'card.truncated': 'text truncated by the publisher limit',
      'card.noteLabel': 'Note:',
      'card.noteNear': 'approximate match',
      'meta.page': 'p. {n}',
      'meta.loc': 'loc. {range}',
      'export.menu': 'Export',
      'export.md': 'Markdown',
      'export.mdBook': 'Markdown (by book)',
      'export.json': 'JSON',
      'export.csv': 'CSV',
      'export.txt': 'Text',
      'export.anki': 'Anki',
      'export.done': 'Export finished',
      'empty.noResults': 'No results found',
      'empty.noFile': 'No file loaded',
      'error.read': 'Error reading file',
      'error.empty': 'The file is empty',
      'footer.privacy': 'Nothing leaves this device.',
      'lang.pt': 'PT',
      'lang.en': 'EN',
      'ex.title': 'My highlights',
      'ex.exported': 'Exported on',
      'ex.book': 'Book',
      'ex.author': 'Author',
      'ex.page': 'Page',
      'ex.loc': 'Location',
      'ex.date': 'Date',
      'ex.text': 'Text',
      'ex.type': 'Type',
      'ex.tag': 'Tag',
      'ex.note': 'Note',
      'ex.allBooks': 'All books'
    }
  };
  function detectLang() {
    var nav = (typeof navigator !== 'undefined') ? navigator : null;
    var raw = nav && nav.language ? String(nav.language) : '';
    var low = raw.toLowerCase();
    if (low.indexOf('pt') === 0) { return 'pt-BR'; }
    if (low.indexOf('en') === 0) { return 'en'; }
    return 'pt-BR';
  }
  function num(n) {
    try {
      return new Intl.NumberFormat(KC.i18n.lang).format(n);
    } catch (e) {
      return String(n);
    }
  }
  function date(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) { return ''; }
    try {
      return new Intl.DateTimeFormat(KC.i18n.lang, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(ms));
    } catch (e) {
      return '';
    }
  }
  function fold(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u0111\u0110]/g, 'd').replace(/\u00df/g, 'ss')
      .replace(/[\u00f8\u00d8]/g, 'o').replace(/[\u00e6\u00c6]/g, 'ae')
      .toLowerCase();
  }
  function t(key, params) {
    var table = CATALOG[KC.i18n.lang] || CATALOG['pt-BR'];
    var str = table[key];
    if (str === undefined) { str = CATALOG['pt-BR'][key]; }
    if (str === undefined) { str = key; }
    if (params) {
      for (var k in params) {
        if (Object.prototype.hasOwnProperty.call(params, k)) {
          var val = params[k];
          if (typeof val === 'number') { val = num(val); }
          str = str.replace('{' + k + '}', val);
        }
      }
    }
    return str;
  }
  function setLang(lang) {
    if (lang !== 'pt-BR' && lang !== 'en') { return; }
    KC.i18n.lang = lang;
    if (typeof KC.i18n.onChange === 'function') { KC.i18n.onChange(); }
  }
  KC.i18n = {
    lang: detectLang(),
    t: t,
    setLang: setLang,
    num: num,
    date: date,
    fold: fold,
    catalog: CATALOG,
    onChange: null
  };
})(window.KC = window.KC || {});
