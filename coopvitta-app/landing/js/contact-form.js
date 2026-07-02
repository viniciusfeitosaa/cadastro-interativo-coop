(function () {
  'use strict';

  var WA_NUMBER = '551140402345';
  var form = document.getElementById('leadForm');
  if (!form) return;

  var whatsappInput = document.getElementById('leadWhatsapp');
  if (whatsappInput) {
    whatsappInput.addEventListener('input', function () {
      var digits = whatsappInput.value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 10) {
        whatsappInput.value = digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        whatsappInput.value = digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2');
      }
    });
  }

  function showFeedback(msg, type) {
    var el = document.getElementById('formFeedback');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.className = 'form-feedback is-' + type;
  }

  function setFieldError(input, hasError) {
    if (!input) return;
    input.classList.toggle('is-invalid', hasError);
    input.closest('.form-row')?.classList.toggle('has-error', hasError);
  }

  ['leadName', 'leadRole', 'leadInstitution', 'leadCity', 'leadVolume', 'leadSpecialties', 'leadChallenge', 'leadWhatsapp'].forEach(function (id) {
    var input = document.getElementById(id);
    if (!input) return;
    var evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, function () {
      if (input.value.trim()) setFieldError(input, false);
    });
  });

  function saveLeadLocal(data) {
    try {
      var leads = JSON.parse(localStorage.getItem('viva_leads') || '[]');
      data.at = new Date().toISOString();
      leads.push(data);
      localStorage.setItem('viva_leads', JSON.stringify(leads.slice(-50)));
    } catch (e) {}
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = {
      name: document.getElementById('leadName'),
      role: document.getElementById('leadRole'),
      institution: document.getElementById('leadInstitution'),
      city: document.getElementById('leadCity'),
      volume: document.getElementById('leadVolume'),
      specialties: document.getElementById('leadSpecialties'),
      challenge: document.getElementById('leadChallenge'),
      whatsapp: document.getElementById('leadWhatsapp')
    };
    var consent = document.getElementById('leadConsent');

    var hasError = false;
    Object.keys(fields).forEach(function (key) {
      var input = fields[key];
      if (!input) return;
      var empty = !input.value.trim();
      setFieldError(input, empty);
      if (empty) hasError = true;
    });

    var digits = (fields.whatsapp?.value || '').replace(/\D/g, '');
    if (!hasError && digits.length < 10) {
      setFieldError(fields.whatsapp, true);
      hasError = true;
    }

    if (hasError) {
      showFeedback('Revise os campos destacados.', 'error');
      return;
    }

    if (consent && !consent.checked) {
      showFeedback('É necessário aceitar a Política de Privacidade para enviar.', 'error');
      return;
    }

    var payload = {
      name: fields.name.value.trim(),
      role: fields.role.value.trim(),
      institution: fields.institution.value.trim(),
      city: fields.city.value.trim(),
      volume: fields.volume.value.trim(),
      specialties: fields.specialties.value.trim(),
      challenge: fields.challenge.value.trim(),
      whatsapp: fields.whatsapp.value.trim()
    };
    saveLeadLocal(payload);

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ source: 'landing-home' }, payload))
    }).catch(function () {});

    var text = [
      'Olá! Gostaria de receber uma proposta da Viva Saúde para gestão integral de escalas.',
      '',
      'Nome: ' + payload.name,
      'Cargo: ' + payload.role,
      'Instituição: ' + payload.institution,
      'Cidade/Estado: ' + payload.city,
      'Volume de plantões: ' + payload.volume,
      'Especialidades: ' + payload.specialties,
      'Principal desafio: ' + payload.challenge,
      'WhatsApp: ' + payload.whatsapp
    ].join('\n');

    var success = document.getElementById('formSuccess');
    if (success) {
      form.hidden = true;
      success.hidden = false;
      success.focus?.();
    } else {
      showFeedback('Recebemos seu contato! Nossa equipe falará com você em breve.', 'success');
    }

    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
})();
