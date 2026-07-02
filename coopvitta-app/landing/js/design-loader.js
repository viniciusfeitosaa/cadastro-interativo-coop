/**
 * design-loader.js
 * Lê landing/design.json e aplica cores/identidade visual na página.
 * Quando primary/secondary/background/text estiverem preenchidos no JSON (não #______),
 * eles sobrescrevem as variáveis CSS.
 */
(function () {
  fetch('design.json')
    .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
    .then(function (data) {
      var colors = data.identity_visual && data.identity_visual.colors;
      if (!colors) return;

      var root = document.documentElement;
      var map = {
        primary: '--color-primary',
        secondary: '--color-secondary',
        background: '--color-background',
        text: '--color-text'
      };

      Object.keys(map).forEach(function (key) {
        var value = colors[key];
        if (value && typeof value === 'string' && value.trim() && !/^#_+$/.test(value)) {
          root.style.setProperty(map[key], value.trim());
        }
      });

      if (data.identity_visual.typography) {
        if (data.identity_visual.typography.headers) {
          root.style.setProperty('--font-headers', data.identity_visual.typography.headers);
        }
        if (data.identity_visual.typography.body) {
          root.style.setProperty('--font-body', data.identity_visual.typography.body);
        }
      }
    })
    .catch(function () {});
})();
