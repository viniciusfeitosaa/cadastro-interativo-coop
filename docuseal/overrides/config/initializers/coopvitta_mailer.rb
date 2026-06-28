# COOPVITTA — melhor entregabilidade do e-mail 2FA (evita rodapé promocional padrão do DocuSeal).
Rails.application.config.to_prepare do
  SubmitterMailer.class_eval do
    def otp_verification_email(submitter, locale: nil)
      @submitter = submitter
      @otp_code = EmailVerificationCodes.generate([submitter.email.downcase.strip, submitter.slug].join(':'))

      assign_message_metadata('otp_verification_email', submitter)

      doc_name = submitter.submission.name.presence || submitter.submission.template.name
      from = ENV.fetch('SMTP_FROM', 'COOPVITTA Assinaturas <assinaturas@coopvitta.cloud>')
      reply_to = ENV.fetch('SMTP_REPLY_TO', 'contato@coopvitta.org')

      locale_name = locale || submitter.account.locale
      locale_name = 'pt-PT' if locale_name == 'pt-BR'

      I18n.with_locale(locale_name) do
        mail(
          to: submitter.email,
          from: from,
          reply_to: reply_to,
          subject: "COOPVITTA — código de verificação: #{doc_name.to_s.truncate(40)}"
        )
      end
    end
  end
end
