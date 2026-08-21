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
      'lang.pt': '🇧🇷',
      'lang.en': '🇬🇧',
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
      'ex.allBooks': 'Todos os livros',
      'nav.shelf': 'Estante',
      'toggle.covers': 'Carregar capas',
      'toggle.covers.on': 'Capas ativas',
      'covers.progress': 'Capas {done}/{total}',
      'covers.done': '{n} capas carregadas',
      'covers.failed': 'Não foi possível falar com o openlibrary.org',
      'covers.privacy': 'Título e autor de cada livro são enviados ao openlibrary.org. Nada mais sai daqui.',
      'footer.privacyCovers': 'Seus destaques nunca saem deste dispositivo. Só os títulos são consultados.',
      'tip.hidden': 'Por padrão o leitor esconde três tipos de ruído que o Kindle grava no arquivo: cópias duplicadas de um destaque que você arrastou mais, marcadores vazios e registros esvaziados pelo limite de recorte. Ative para vê-los, marcados em cinza — nada é apagado do seu arquivo.',
      'tip.covers': 'Busca a capa e o assunto de cada livro no openlibrary.org, usando só o título e o autor. Nenhum destaque ou nota é enviado, e nada é buscado até você ativar isto.',
      'tip.shelf': 'Abre a estante: uma grade com a capa de cada livro da sua biblioteca, para navegar visualmente em vez de pela lista lateral.',
      'sort.label': 'Ordenar',
      'sort.order': 'Leitura',
      'sort.dateDesc': 'Mais recentes',
      'sort.dateAsc': 'Mais antigos',
      'sort.book': 'Livro',
      'sort.topic': 'Tema',
      'sidebar.sortLabel': 'Ordenar livros',
      'sidebar.sort.title': 'A–Z',
      'sidebar.sort.count': 'Destaques',
      'sidebar.sort.recent': 'Recentes',
      'sidebar.resize': 'Redimensionar a lista de livros',
      'topic.all': 'Todos os temas',
      'topic.psychology': 'Psicologia',
      'topic.selfhelp': 'Desenvolvimento pessoal',
      'topic.business': 'Negócios',
      'topic.economics': 'Economia',
      'topic.philosophy': 'Filosofia',
      'topic.history': 'História',
      'topic.science': 'Ciência',
      'topic.technology': 'Tecnologia',
      'topic.health': 'Saúde',
      'topic.fiction': 'Ficção',
      'topic.biography': 'Biografia',
      'topic.politics': 'Política e sociedade',
      'topic.religion': 'Religião e espiritualidade',
      'topic.education': 'Educação e linguagem',
      'topic.arts': 'Artes e cultura',
      'topic.uncategorized': 'Sem tema',
      'book.highlights': '{n} destaques',
      'shelf.title': 'Estante',
      'shelf.subtitle': 'Sua biblioteca em capas',
      'shelf.search': 'Buscar livro…',
      'shelf.back': 'Voltar aos destaques',
      'shelf.empty': 'Nenhuma biblioteca ainda — abra um arquivo de destaques primeiro.',
      'restore.pending': 'Solte seu arquivo para abrir "{book}"'
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
      'lang.pt': '🇧🇷',
      'lang.en': '🇬🇧',
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
      'ex.allBooks': 'All books',
      'nav.shelf': 'Shelf',
      'toggle.covers': 'Load covers',
      'toggle.covers.on': 'Covers on',
      'covers.progress': 'Covers {done}/{total}',
      'covers.done': '{n} covers loaded',
      'covers.failed': 'Could not reach openlibrary.org',
      'covers.privacy': "Each book's title and author are sent to openlibrary.org. Nothing else leaves this device.",
      'footer.privacyCovers': 'Your highlights never leave this device. Only titles are looked up.',
      'tip.hidden': "Off by default, the reader hides three kinds of clutter Kindle writes into your file: duplicate copies of a highlight you dragged wider, empty bookmarks, and records the clipping limit emptied out. Turn this on to see them, marked in grey — nothing is ever deleted from your file.",
      'tip.covers': "Looks up each book's cover and subject on openlibrary.org, using only its title and author. No highlight or note is ever sent, and nothing is looked up until you turn this on.",
      'tip.shelf': "Opens the shelf: a grid of every book in your library by its cover, for browsing visually instead of through the side list.",
      'sort.label': 'Sort',
      'sort.order': 'Reading',
      'sort.dateDesc': 'Newest',
      'sort.dateAsc': 'Oldest',
      'sort.book': 'Book',
      'sort.topic': 'Topic',
      'sidebar.sortLabel': 'Sort books',
      'sidebar.sort.title': 'A–Z',
      'sidebar.sort.count': 'Highlights',
      'sidebar.sort.recent': 'Recent',
      'sidebar.resize': 'Resize the book list',
      'topic.all': 'All topics',
      'topic.psychology': 'Psychology',
      'topic.selfhelp': 'Self-help',
      'topic.business': 'Business',
      'topic.economics': 'Economics',
      'topic.philosophy': 'Philosophy',
      'topic.history': 'History',
      'topic.science': 'Science',
      'topic.technology': 'Technology',
      'topic.health': 'Health',
      'topic.fiction': 'Fiction',
      'topic.biography': 'Biography',
      'topic.politics': 'Politics & society',
      'topic.religion': 'Religion & spirituality',
      'topic.education': 'Education & language',
      'topic.arts': 'Arts & culture',
      'topic.uncategorized': 'No topic',
      'book.highlights': '{n} highlights',
      'shelf.title': 'Shelf',
      'shelf.subtitle': 'Your library in covers',
      'shelf.search': 'Search books…',
      'shelf.back': 'Back to highlights',
      'shelf.empty': 'No library yet — open a clippings file first.',
      'restore.pending': 'Drop your file to open "{book}"'
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
