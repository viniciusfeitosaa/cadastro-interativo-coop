(function () {
  'use strict';

  var WA_NUMBER = '551140402345';
  var form = document.getElementById('medicoLeadForm');
  if (!form) return;

  var whatsappInput = document.getElementById('medicoWhatsapp');
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
    var el = document.getElementById('medicoFormFeedback');
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

  form.querySelectorAll('input, select, textarea').forEach(function (input) {
    if (input.type === 'checkbox') return;
    input.addEventListener('input', function () {
      if (input.value.trim()) setFieldError(input, false);
    });
    input.addEventListener('change', function () {
      if (input.value.trim()) setFieldError(input, false);
    });
  });

  function saveLeadLocal(data) {
    try {
      var leads = JSON.parse(localStorage.getItem('viva_medico_leads') || '[]');
      data.at = new Date().toISOString();
      leads.push(data);
      localStorage.setItem('viva_medico_leads', JSON.stringify(leads.slice(-50)));
    } catch (e) {}
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = {
      name: document.getElementById('medicoName'),
      crm: document.getElementById('medicoCrm'),
      specialty: document.getElementById('medicoSpecialty'),
      city: document.getElementById('medicoCity'),
      email: document.getElementById('medicoEmail'),
      whatsapp: document.getElementById('medicoWhatsapp'),
      availability: document.getElementById('medicoAvailability')
    };
    var consent = document.getElementById('medicoConsent');

    var hasError = false;
    Object.keys(fields).forEach(function (key) {
      var input = fields[key];
      var empty = !(input && input.value.trim());
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
      crm: fields.crm.value.trim(),
      specialty: fields.specialty.value.trim(),
      city: fields.city.value.trim(),
      email: fields.email.value.trim(),
      whatsapp: fields.whatsapp.value.trim(),
      availability: fields.availability.value.trim()
    };
    saveLeadLocal(payload);

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ source: 'landing-medico' }, payload))
    }).catch(function () {});

    var text = [
      'Olá! Sou médico e tenho interesse em oportunidades com a Viva Saúde.',
      '',
      'Nome: ' + payload.name,
      'CRM: ' + payload.crm,
      'Especialidade: ' + payload.specialty,
      'Cidade/Estado: ' + payload.city,
      'E-mail: ' + payload.email,
      'WhatsApp: ' + payload.whatsapp,
      'Disponibilidade: ' + payload.availability
    ].join('\n');

    var success = document.getElementById('medicoFormSuccess');
    if (success) {
      form.hidden = true;
      success.hidden = false;
      success.focus?.();
    } else {
      showFeedback('Recebemos seu interesse! Nossa equipe falará com você em breve.', 'success');
    }

    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  });
})();
