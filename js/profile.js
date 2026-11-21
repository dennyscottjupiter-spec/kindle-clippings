// ---
// purpose: Optional two-person mode (A/B) on one device — namespaces every storage key per person
// exports: KC.profile.on, id, key(k), setOn(bool), switchTo(id); wires #toggle-profile / #profile-pill
// depends: js/i18n.js (strings); loaded before js/store.js and js/persist.js, which call key() lazily
// gotcha: person A uses the bare keys, so data saved before this mode existed stays A's untouched
// gotcha: switching person reloads the page — every module re-reads its namespaced storage at boot
// ---
(function (KC) {
  'use strict';

  var STATE_KEY = 'kc.profile';  // device-level, never namespaced

  function read() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch (e) { return {}; }
  }
  function write(s) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  var st = read();
  var on = st.on === true;
  var id = on && st.id === 'B' ? 'B' : 'A';

  KC.profile = {
    on: on,
    id: id,
    key: function (k) { return id === 'B' ? k + '@B' : k; },
    setOn: function (v) { write({ on: !!v, id: v ? id : 'A' }); location.reload(); },
    switchTo: function (next) { write({ on: true, id: next === 'B' ? 'B' : 'A' }); location.reload(); }
  };

  if (KC.i18n && KC.i18n.add) {
    KC.i18n.add({
      'pt-BR': {
        'switch.profile': 'Duas pessoas',
        'tip.profile': 'Liga o modo A/B: cada pessoa tem seus próprios destaques, favoritos e ajustes neste aparelho. Toque no círculo A/B para trocar.',
        'profile.label': 'Trocar de pessoa (A/B)'
      },
      'en': {
        'switch.profile': 'Two people',
        'tip.profile': 'Turns on A/B mode: each person keeps their own highlights, favourites and settings on this device. Tap the A/B circle to switch.',
        'profile.label': 'Switch person (A/B)'
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sw = document.getElementById('toggle-profile');
    var pill = document.getElementById('profile-pill');
    if (sw) {
      sw.setAttribute('aria-checked', String(on));
      sw.addEventListener('click', function () { KC.profile.setOn(!on); });
    }
    if (pill) {
      pill.hidden = !on;
      pill.textContent = id;
      pill.setAttribute('data-profile', id);
      pill.addEventListener('click', function () { KC.profile.switchTo(id === 'A' ? 'B' : 'A'); });
    }
  });
})(window.KC = window.KC || {});
