import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, Send } from 'lucide-react'
import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import {
  defaultFormValues,
  STEPS,
  stepSchemas,
  type FormData,
} from '../../schemas/formSchema'
import { submitCadastro } from '../../services/api'
import { buildCadastroFormData } from '../../utils/submitForm'
import { BrandLogo } from '../brand/BrandLogo'
import { StepIndicator } from './StepIndicator'
import { STEP_COMPONENTS } from './WizardSteps'
import './FormWizard.css'

export function FormWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const methods = useForm<FormData>({
    defaultValues: defaultFormValues,
    mode: 'onBlur',
  })

  const StepComponent = STEP_COMPONENTS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1

  async function goNext() {
    const schema = stepSchemas[currentStep]
    const values = methods.getValues()
    const stepFields = Object.keys(schema.shape) as (keyof FormData)[]
    const stepData = Object.fromEntries(
      stepFields.map((key) => [key, values[key]]),
    )

    const result = schema.safeParse(stepData)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormData
        methods.setError(field, { message: issue.message })
      }
      return
    }

    if (isLastStep) {
      setSubmitting(true)
      setSubmitError('')
      try {
        const allValues = methods.getValues()
        const payload = buildCadastroFormData(allValues)
        await submitCadastro(payload)
        setSubmitted(true)
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : 'Erro ao enviar cadastro. Tente novamente.',
        )
      } finally {
        setSubmitting(false)
      }
      return
    }

    setCurrentStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setCurrentStep((s) => Math.max(0, s - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (submitted) {
    return (
      <motion.div
        className="success-screen"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="success-icon">
          <CheckCircle2 size={48} strokeWidth={1.5} />
        </div>
        <h2>Pré-cadastro enviado!</h2>
        <p>
          Recebemos suas informações. Nossa equipe analisará seu perfil e entrará em
          contato em breve.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Novo cadastro
        </button>
      </motion.div>
    )
  }

  return (
    <FormProvider {...methods}>
      <div className="wizard-layout">
        <header className="wizard-topbar">
          <BrandLogo tagline="Cooperativa de Trabalho dos Profissionais Assistenciais à Vida e à Saúde" />
          <a href="https://coopvitta.org" target="_blank" rel="noopener noreferrer" className="topbar-link">
            Voltar ao site
          </a>
        </header>

        <aside className="wizard-sidebar">
          <StepIndicator currentStep={currentStep} />
        </aside>

        <main className="wizard-main">
          <header className="step-header">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <span className="step-eyebrow">
                Etapa {currentStep + 1} — {STEPS[currentStep].subtitle}
              </span>
              <h1>{STEPS[currentStep].title}</h1>
            </motion.div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className="step-content"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <StepComponent />
            </motion.div>
          </AnimatePresence>

          <footer className="wizard-footer">
            {submitError && <p className="submit-error">{submitError}</p>}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={goBack}
              disabled={currentStep === 0 || submitting}
            >
              <ArrowLeft size={18} />
              Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void goNext()}
              disabled={submitting}
            >
              {isLastStep ? (
                <>
                  {submitting ? 'Enviando...' : 'Enviar pré-cadastro'}
                  <Send size={18} />
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </footer>
        </main>
      </div>
    </FormProvider>
  )
}
