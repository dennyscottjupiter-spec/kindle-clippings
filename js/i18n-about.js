// ---
// purpose: Register the About panel's strings (intro, privacy note, credit, full changelog) — pt-BR/en
// exports: nothing — side effect only (KC.i18n.add)
// depends: js/i18n.js — index.html loads this immediately after it, before any render
// gotcha: about.rel.<version>.<n> keys must stay in sync with the `changes` arrays in js/version.js
// ---
(function (KC) {
  'use strict';

  KC.i18n.add({
    'pt-BR': {
      'about.title': 'Sobre o app',
      'about.label': 'Sobre',
      'tip.about': 'Abre um resumo do que é este app, como sua privacidade é protegida e o histórico de tudo que já mudou, versão por versão.',
      'about.what.h': 'O que é isso',
      'about.what.body': 'O Meus Destaques do Kindle transforma o arquivo My Clippings.txt do seu Kindle em cartões de destaque organizados, pesquisáveis e prontos para exportar. Tudo roda direto no seu navegador.',
      'about.privacy.note': 'Nenhum destaque, nota ou arquivo sai deste dispositivo. A única exceção é opcional e vem desligada por padrão: ao ligar as "Capas", o título e o autor de cada livro — nunca o texto dos seus destaques — são enviados ao openlibrary.org para buscar a capa e o assunto do livro.',
      'about.history.h': 'Histórico de versões',
      'about.history.hint': 'O que mudou em cada versão, em português simples.',
      'about.version.term': 'Versão instalada',
      'about.version.desc': '{v} — lançada em {date}',
      'about.current': 'atual',
      'about.credit.h': 'Créditos',
      'about.credit.body': 'Este app foi construído com a ajuda do Claude Code, da Anthropic.',

      'about.rel.2_3_0.1': 'Botões e menus redesenhados com ícones próprios; Ajuda e Sobre agora ficam no fim do menu ⋯.',
      'about.rel.2_3_0.2': 'Novo botão ← Voltar (e o gesto de voltar do celular) leva você de volta para onde estava: livro, tema, busca ou painel.',
      'about.rel.2_3_0.3': 'Rodapé de cada destaque refeito: página, posição e data em etiquetas, e uma barra de ações para o polegar.',
      'about.rel.2_3_0.4': 'Toque num quadro das Estatísticas para ver os detalhes: destaques por mês, todos os livros, suas notas e o tamanho dos destaques.',
      'about.rel.2_3_0.5': 'Corrigido: a estrela continuava dourada depois de desmarcada no celular.',
      'about.rel.2_3_0.6': 'O modo "Duas pessoas" foi removido — cada pessoa usa o app no próprio celular.',
      'about.rel.2_3_0.7': 'Corrigido: o "dia mais intenso" das estatísticas aparecia um dia antes no fuso do Brasil.',
      'about.rel.2_2_1.1': 'O app ganhou um ícone próprio — um livro aberto — na Tela de Início do celular e na aba do navegador.',
      'about.rel.2_2_0.1': 'Novo modo "Duas pessoas" nas configurações: A e B no mesmo aparelho, cada um com seus destaques, favoritos e ajustes.',
      'about.rel.2_2_0.2': 'Ao abrir o app, ele pede ao navegador para guardar seus dados de forma permanente — no iPhone, adicione à Tela de Início para nunca perdê-los.',
      'about.rel.2_1_0.1': 'Suas preferências (tema, idioma, ordenação) agora ficam guardadas em dois lugares — se o navegador limpar um, o outro devolve tudo.',
      'about.rel.2_1_0.2': 'Novo backup manual dos favoritos: baixe um arquivo .json com suas estrelas e restaure-o quando quiser, em qualquer aparelho.',
      'about.rel.2_1_0.3': 'Cada nova versão do app chega ao seu navegador na hora, sem depender de recarregar a página com força.',
      'about.rel.2_1_0.4': 'O menu "exportar" de um destaque não abre mais fora da tela no celular.',

      'about.rel.2_0_0.1': 'Visual totalmente novo: paleta âmbar e tinta quente no lugar do índigo frio.',
      'about.rel.2_0_0.2': 'As fontes agora vêm embutidas no próprio app — carregamento mais rápido e 100% offline, sem pedir nada à internet.',
      'about.rel.2_0_0.3': 'A área de leitura agora ocupa a largura toda da tela, em vez de ficar espremida ao centro.',
      'about.rel.2_0_0.4': 'Cada destaque ganha uma faixa colorida pelo tema, no lugar do antigo marcador amarelo.',
      'about.rel.2_0_0.5': 'Os temas dos livros agora aparecem e podem ser filtrados na barra lateral e na estante.',
      'about.rel.2_0_0.6': 'A galeria de citações agora pode ser ordenada e filtrada por livro.',
      'about.rel.2_0_0.7': 'Exportação para o Anki agora é um botão só, sem precisar passar pelo menu.',
      'about.rel.2_0_0.8': 'Este painel "Sobre" e um novo painel de "Ajuda".',

      'about.rel.1_3_0.1': 'O app agora lembra do seu arquivo de destaques entre visitas — sem precisar carregar de novo toda vez.',
      'about.rel.1_3_0.2': 'O menu do celular ficou mais compacto, escondido atrás de um botão, com um novo atalho para voltar ao início.',
      'about.rel.1_3_0.3': 'Escolha quais anos aparecem na linha do tempo das estatísticas.',
      'about.rel.1_3_0.4': 'As imagens de citação agora são JPEG em vez de PNG — arquivos até 10 vezes menores para baixar.',

      'about.rel.1_2_0.1': 'Painel de estatísticas: total de destaques, livros, notas e palavras, linha do tempo, livros mais destacados, temas e seu ritmo de leitura por dia e hora.',
      'about.rel.1_2_0.2': 'Marque destaques favoritos com uma estrela e baixe-os como imagens de citação, no tamanho certo para uma tela Nest Hub ou um post quadrado.',
      'about.rel.1_2_0.3': 'Exportação para o Obsidian: uma nota pronta por livro.',
      'about.rel.1_2_0.4': 'Suporte completo a celular: encaixe com a área segura da tela, alvos de toque maiores e uma estante em duas colunas.',

      'about.rel.1_1_0.1': 'Novo visual mais colorido para a leitura.',
      'about.rel.1_1_0.2': 'Busca opcional da capa e do assunto de cada livro no openlibrary.org — só o título e o autor são enviados, e só se você ligar isso.',
      'about.rel.1_1_0.3': 'Barra lateral redimensionável, com os livros ordenáveis por nome, quantidade de destaques ou mais recentes.',
      'about.rel.1_1_0.4': 'Destaques também podem ser ordenados por data, livro ou tema.',
      'about.rel.1_1_0.5': 'Nova página "Estante", mostrando sua biblioteca em capas.',

      'about.rel.1_0_0.1': 'O app nasceu: ele lê seu arquivo My Clippings.txt inteiro dentro do navegador — nada é enviado a lugar nenhum.',
      'about.rel.1_0_0.2': 'Duplicatas, marcadores vazios e textos cortados pelo limite de cópia do Kindle são detectados e escondidos automaticamente, sem apagar nada do seu arquivo original.',
      'about.rel.1_0_0.3': 'Cada livro ganha sua própria #hashtag, útil para organizar anotações.',
      'about.rel.1_0_0.4': 'Busca por palavras nos destaques, ignorando acentos.',
      'about.rel.1_0_0.5': 'Exportação em Markdown, JSON, CSV, TXT e Anki.'
    },
    'en': {
      'about.title': 'About the app',
      'about.label': 'About',
      'tip.about': 'Opens a short summary of what this app is, how your privacy is protected, and the history of everything that has changed, version by version.',
      'about.what.h': 'What this is',
      'about.what.body': 'My Kindle Highlights turns your Kindle’s My Clippings.txt file into organized, searchable, exportable highlight cards. Everything runs right in your browser.',
      'about.privacy.note': 'No highlight, note or file ever leaves this device. The one exception is opt-in and off by default: turning on "Covers" sends each book’s title and author — never your highlight text — to openlibrary.org to fetch its cover and subject.',
      'about.history.h': 'Version history',
      'about.history.hint': 'What changed in each version, explained in plain language.',
      'about.version.term': 'Installed version',
      'about.version.desc': '{v} — released {date}',
      'about.current': 'current',
      'about.credit.h': 'Credits',
      'about.credit.body': 'This app was built with the help of Claude Code, by Anthropic.',

      'about.rel.2_3_0.1': 'Buttons and menus redesigned with their own icons; Help and About now sit at the bottom of the ⋯ menu.',
      'about.rel.2_3_0.2': 'A new ← Back button (and your phone’s back gesture) takes you back to where you were: book, topic, search or panel.',
      'about.rel.2_3_0.3': 'Each highlight’s footer is redone: page, location and date as tags, plus a thumb-friendly action bar.',
      'about.rel.2_3_0.4': 'Tap a Statistics tile to drill in: highlights per month, every book, your notes and how long your highlights are.',
      'about.rel.2_3_0.5': 'Fixed: the star stayed gold after you un-starred it on a phone.',
      'about.rel.2_3_0.6': 'The "Two people" mode is gone — everyone uses the app on their own phone.',
      'about.rel.2_3_0.7': 'Fixed: the statistics’ "busiest day" showed one day early in Brazil’s time zone.',
      'about.rel.2_2_1.1': 'The app now has its own icon — an open book — on your phone’s Home Screen and in the browser tab.',
      'about.rel.2_2_0.1': 'New "Two people" mode in settings: A and B on the same device, each with their own highlights, favourites and settings.',
      'about.rel.2_2_0.2': 'On launch the app asks the browser to keep your data permanently — on iPhone, add it to the Home Screen so it is never cleared.',
      'about.rel.2_1_0.1': 'Your preferences (theme, language, sorting) are now kept in two places — if the browser wipes one, the other brings them back.',
      'about.rel.2_1_0.2': 'A manual backup for favourites: download a .json file with your stars and restore it whenever you like, on any device.',
      'about.rel.2_1_0.3': 'Every new version of the app reaches your browser straight away, with no forced reload.',
      'about.rel.2_1_0.4': 'A highlight’s "export" menu no longer opens off the edge of a phone screen.',

      'about.rel.2_0_0.1': 'A whole new look: warm amber and ink instead of the cool indigo palette.',
      'about.rel.2_0_0.2': 'Fonts are now bundled with the app itself — faster loading and fully offline, with no request made to the internet.',
      'about.rel.2_0_0.3': 'The reading area now fills the full width of the screen, instead of sitting cramped in the middle.',
      'about.rel.2_0_0.4': 'Every highlight gets a colored rail matching its topic, replacing the old yellow marker.',
      'about.rel.2_0_0.5': 'Book topics now show up and can be filtered from the sidebar and the shelf.',
      'about.rel.2_0_0.6': 'The quote gallery can now be sorted and filtered by book.',
      'about.rel.2_0_0.7': 'Anki export is now a single button, no need to go through the menu.',
      'about.rel.2_0_0.8': 'This About panel, and a new Help panel.',

      'about.rel.1_3_0.1': 'The app now remembers your highlights file between visits — no more re-uploading it every time.',
      'about.rel.1_3_0.2': 'The mobile menu got more compact, tucked behind a single button, with a new shortcut back to the start.',
      'about.rel.1_3_0.3': 'Choose which years show up on the statistics timeline.',
      'about.rel.1_3_0.4': 'Quote-card images are now JPEG instead of PNG — downloads up to 10x smaller.',

      'about.rel.1_2_0.1': 'A statistics panel: total highlights, books, notes and words, a timeline, your most-highlighted books, topics and your reading rhythm by day and hour.',
      'about.rel.1_2_0.2': 'Star your favourite highlights and download them as quote-card images, sized exactly for a Nest Hub screen or a square post.',
      'about.rel.1_2_0.3': 'Obsidian export: one ready-to-use note per book.',
      'about.rel.1_2_0.4': 'Full mobile support: safe-area-aware layout, bigger touch targets and a two-column shelf.',

      'about.rel.1_1_0.1': 'A more colorful new look for reading.',
      'about.rel.1_1_0.2': 'Optional cover and subject lookup for each book via openlibrary.org — only the title and author are sent, and only if you turn it on.',
      'about.rel.1_1_0.3': 'Resizable sidebar, with books sortable by name, highlight count or most recent.',
      'about.rel.1_1_0.4': 'Highlights can now also be sorted by date, book or topic.',
      'about.rel.1_1_0.5': 'New "Shelf" page, showing your library by book cover.',

      'about.rel.1_0_0.1': 'The app is born: it reads your whole My Clippings.txt file right inside the browser — nothing is ever sent anywhere.',
      'about.rel.1_0_0.2': 'Duplicate highlights, empty bookmarks and text cut short by Kindle’s clipping limit are detected and hidden automatically — nothing is ever deleted from your original file.',
      'about.rel.1_0_0.3': 'Every book gets its own #hashtag, handy for organizing notes.',
      'about.rel.1_0_0.4': 'Search across your highlights, accent-insensitive.',
      'about.rel.1_0_0.5': 'Export to Markdown, JSON, CSV, TXT and Anki.'
    }
  });
})(window.KC = window.KC || {});
