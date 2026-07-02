(function () {
  'use strict';
  var WA = '551140402345';

  function maskWhatsapp(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var digits = input.value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 10) {
        input.value = digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        input.value = digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    });
  }

  function showFeedback(form, msg, type) {
    var el = form.querySelector('.form-feedback') || document.getElementById('b2bFormFeedback');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.className = 'form-feedback is-' + type;
  }

  function showSuccess(form) {
    var panel = form.closest('.lead-form-panel');
    var success = panel && panel.querySelector('[id$="FormSuccess"], .form-success');
    if (panel && success) {
      form.hidden = true;
      success.hidden = false;
      success.focus?.();
      return;
    }
    showFeedback(form, 'Recebemos seu contato! Nossa equipe falará com você em breve.', 'success');
  }

  function saveLeadLocal(data) {
    try {
      var leads = JSON.parse(localStorage.getItem('viva_leads') || '[]');
      data.at = new Date().toISOString();
      leads.push(data);
      localStorage.setItem('viva_leads', JSON.stringify(leads.slice(-50)));
    } catch (e) {}
  }

  document.querySelectorAll('[data-wa-form]').forEach(function (form) {
    var waInput = form.querySelector('[name="whatsapp"]');
    maskWhatsapp(waInput);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lines = ['Olá! Gostaria de receber uma proposta da Viva Saúde para gestão de escalas.', ''];
      var valid = true;
      var payload = {};

      form.querySelectorAll('[name]').forEach(function (input) {
        if (input.type === 'checkbox') return;
        var v = (input.value || '').trim();
        if (input.required && !v) valid = false;
        if (v && input.name) {
          payload[input.name] = v;
          var labelEl = input.labels && input.labels[0] ? input.labels[0] : null;
          var label = labelEl ? labelEl.textContent.replace(':', '').trim() : input.name;
          lines.push(label + ': ' + v);
        }
      });

      var consent = form.querySelector('[name="consent"]');
      if (consent && !consent.checked) {
        showFeedback(form, 'É necessário aceitar a Política de Privacidade e os Termos de Uso para enviar.', 'error');
        return;
      }

      if (!valid) {
        showFeedback(form, 'Preencha os campos obrigatórios.', 'error');
        return;
      }

      var feedback = form.querySelector('.form-feedback');
      if (feedback) feedback.hidden = true;

      saveLeadLocal(payload);

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ source: 'landing-b2b' }, payload))
      }).catch(function () {});

      showSuccess(form);

      window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    });
  });
})();
