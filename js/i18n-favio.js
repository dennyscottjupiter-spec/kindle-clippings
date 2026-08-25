// ---
// purpose: Register the favourites backup strings (save / restore JSON) into both catalogs
// exports: nothing — side effect only (KC.i18n.add)
// depends: js/i18n.js — index.html loads this immediately after it, before any render
// ---
(function (KC) {
  'use strict';

  KC.i18n.add({
    'pt-BR': {
      'favio.export': 'Salvar favoritos',
      'favio.import': 'Restaurar favoritos',
      'tip.favio.export': 'Baixa um arquivo .json com a lista dos seus destaques favoritados. Guarde-o onde quiser: se o navegador apagar os dados do site, é por ele que as estrelas voltam.',
      'tip.favio.import': 'Lê um arquivo .json salvo antes e devolve aquelas estrelas. Nada é apagado — os favoritos do arquivo se somam aos que já existem.',
      'favio.saved': '{n} favoritos salvos no arquivo',
      'favio.empty': 'Nenhum destaque favoritado ainda',
      'favio.restored': '{n} favoritos restaurados ({total} no total)',
      'favio.nothingNew': 'Nada novo — esses favoritos já estavam aqui',
      'favio.badFile': 'Arquivo inválido: escolha um .json salvo por este app'
    },
    'en': {
      'favio.export': 'Save favourites',
      'favio.import': 'Restore favourites',
      'tip.favio.export': 'Downloads a .json file with the list of your starred highlights. Keep it anywhere: if the browser ever clears this site’s data, that file is how the stars come back.',
      'tip.favio.import': 'Reads a .json file you saved before and gives those stars back. Nothing is removed — the file’s favourites are added to the ones already here.',
      'favio.saved': '{n} favourites saved to the file',
      'favio.empty': 'No starred highlights yet',
      'favio.restored': '{n} favourites restored ({total} in total)',
      'favio.nothingNew': 'Nothing new — those favourites were already here',
      'favio.badFile': 'Invalid file: pick a .json saved by this app'
    }
  });
})(window.KC = window.KC || {});
