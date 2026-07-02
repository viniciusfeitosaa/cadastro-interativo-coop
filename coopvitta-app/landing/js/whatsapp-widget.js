(function () {
  'use strict';

  var WA_NUMBER = '551140402345';
  var WA_DISPLAY = '+55 (11) 4040-2345';
  var floatBtn = document.querySelector('.whatsapp-float');
  if (!floatBtn) return;

  if (floatBtn.tagName === 'A') {
    var legacyHref = floatBtn.getAttribute('href') || '';
    if (legacyHref.indexOf('wa.me') !== -1) {
      floatBtn.setAttribute('data-wa-href', legacyHref);
    }
    floatBtn.setAttribute('href', '#');
    floatBtn.setAttribute('role', 'button');
    floatBtn.removeAttribute('target');
    floatBtn.removeAttribute('rel');
  }

  if (document.getElementById('waChatPanel')) return;

  var panelMarkup =
    '<div id="waChatPanel" class="wa-chat-panel" hidden role="dialog" aria-modal="true" aria-labelledby="waChatTitle">' +
      '<div class="wa-chat-panel-inner">' +
        '<header class="wa-chat-header">' +
          '<img src="/assets/logo.png" alt="" class="wa-chat-logo" width="40" height="40" />' +
          '<div class="wa-chat-header-text">' +
            '<h2 id="waChatTitle" class="wa-chat-title">Viva Saúde</h2>' +
            '<div class="wa-chat-status">' +
              '<span class="wa-chat-status-dot" aria-hidden="true"></span>' +
              '<span>Suporte online</span>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="wa-chat-close" id="waChatClose" aria-label="Fechar">×</button>' +
        '</header>' +
        '<div class="wa-chat-body wa-chat-body--screen">' +
          '<div class="wa-chat-bubble wa-chat-bubble--in">' +
            '<p>Olá! 👋 Como podemos ajudar você hoje?</p>' +
          '</div>' +
          '<div class="wa-chat-bubble wa-chat-bubble--in">' +
            '<p>Nossa equipe está disponível para dúvidas sobre app, plantões, cadastro e gestão de escalas.</p>' +
          '</div>' +
          '<div class="wa-chat-actions">' +
            '<a href="https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent('Olá! Preciso de suporte da Viva Saúde.') + '" class="wa-chat-support-btn" id="waChatSupportLink" target="_blank" rel="noopener noreferrer">' +
              '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
              'Falar com suporte' +
            '</a>' +
            '<p class="wa-chat-phone">' + WA_DISPLAY + '</p>' +
            '<p class="wa-chat-footnote">Geralmente respondemos em poucos minutos</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', panelMarkup);

  var panel = document.getElementById('waChatPanel');
  var pageLogo = document.querySelector('.logo-img');
  var panelLogo = panel.querySelector('.wa-chat-logo');
  if (pageLogo && panelLogo) {
    panelLogo.src = pageLogo.getAttribute('src') || '/assets/logo.png';
  }

  fetch('/design.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.site || !data.site.contact) return;
      var contact = data.site.contact;
      if (contact.phoneWa) WA_NUMBER = contact.phoneWa;
      if (contact.phone) {
        WA_DISPLAY = contact.phone;
        var phoneEl = panel.querySelector('.wa-chat-phone');
        if (phoneEl) phoneEl.textContent = contact.phone;
      }
      var supportLink = document.getElementById('waChatSupportLink');
      if (supportLink) {
        supportLink.href = 'https://wa.me/' + WA_NUMBER + '?text=' +
          encodeURIComponent('Olá! Preciso de suporte da Viva Saúde.');
      }
    })
    .catch(function () {});

  function openPanel() {
    panel.hidden = false;
    floatBtn.classList.add('whatsapp-float--open');
    floatBtn.setAttribute('aria-expanded', 'true');
    document.getElementById('waChatClose').focus();
  }

  function closePanel() {
    panel.hidden = true;
    floatBtn.classList.remove('whatsapp-float--open');
    floatBtn.setAttribute('aria-expanded', 'false');
    floatBtn.focus();
  }

  function togglePanel() {
    if (panel.hidden) openPanel();
    else closePanel();
  }

  floatBtn.setAttribute('aria-haspopup', 'dialog');
  floatBtn.setAttribute('aria-expanded', 'false');
  floatBtn.setAttribute('aria-controls', 'waChatPanel');

  floatBtn.addEventListener('click', function (e) {
    e.preventDefault();
    togglePanel();
  });

  document.getElementById('waChatClose').addEventListener('click', closePanel);

  document.getElementById('waChatSupportLink').addEventListener('click', function () {
    closePanel();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) closePanel();
  });
})();
