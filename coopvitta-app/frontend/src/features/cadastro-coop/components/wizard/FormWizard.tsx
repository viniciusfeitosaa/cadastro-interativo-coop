import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { BrandLogo } from '../../../../components/brand/BrandLogo';
import {
  defaultFormValues,
  STEPS,
  stepSchemas,
  type FormData,
} from '../../schemas/formSchema';
import { submitCadastroRegister } from '../../utils/submitRegister';
import { StepIndicator } from './StepIndicator';
import { STEP_COMPONENTS } from './WizardSteps';
import './FormWizard.css';

type FormWizardProps = {
  embedded?: boolean;
};

function keysFromStepSchema(schema: z.ZodTypeAny): (keyof FormData)[] {
  let inner: z.ZodTypeAny = schema;
  while (inner instanceof z.ZodEffects) {
    inner = inner._def.schema;
  }
  if (inner instanceof z.ZodObject) {
    return Object.keys(inner.shape) as (keyof FormData)[];
  }
  return [];
}

export function FormWizard({ embedded = false }: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const methods = useForm<FormData>({
    defaultValues: defaultFormValues,
    mode: 'onBlur',
  });

  const StepComponent = STEP_COMPONENTS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  async function goNext() {
    const schema = stepSchemas[currentStep];
    const values = methods.getValues();
    const stepFields = keysFromStepSchema(schema);
    const stepData = Object.fromEntries(
      stepFields.map((key) => [key, values[key]]),
    );

    const result = schema.safeParse(stepData);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormData;
        methods.setError(field, { message: issue.message });
      }
      return;
    }

    if (isLastStep) {
      setSubmitting(true);
      setSubmitError('');
      try {
        const allValues = methods.getValues();
        await submitCadastroRegister(allValues);
        setSubmitted(true);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : 'Erro ao enviar cadastro. Tente novamente.',
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setCurrentStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    setCurrentStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (submitted) {
    return (
      <div className="success-screen animate-fade-in">
        <div className="success-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2>Pré-cadastro enviado!</h2>
        <p>
          Recebemos suas informações. Sua conta está em análise na COOPVITTA; você será
          notificado quando for aprovada para acessar a plataforma.
        </p>
        {embedded ? (
          <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            Ir para o login
          </Link>
        ) : (
          <button type="button" onClick={() => window.location.reload()}>
            Novo cadastro
          </button>
        )}
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="wizard-layout">
        <header className="wizard-topbar">
          <BrandLogo className="h-14 w-auto" linkToSite />
          {embedded ? (
            <Link to="/login" className="topbar-link">
              Já tenho conta
            </Link>
          ) : (
            <a href="https://coopvitta.org" target="_blank" rel="noopener noreferrer" className="topbar-link">
              Voltar ao site
            </a>
          )}
        </header>

        <aside className="wizard-sidebar">
          <StepIndicator currentStep={currentStep} />
        </aside>

        <main className="wizard-main">
          <header className="step-header">
            <div key={currentStep} className="animate-fade-in-up">
              <span className="step-eyebrow">
                Etapa {currentStep + 1} — {STEPS[currentStep].subtitle}
              </span>
              <h1>{STEPS[currentStep].title}</h1>
            </div>
          </header>

          <div key={currentStep} className="step-content animate-fade-in">
            <StepComponent />
          </div>

          <footer className="wizard-footer">
            {submitError && <p className="submit-error">{submitError}</p>}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={goBack}
              disabled={currentStep === 0 || submitting}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </>
              ) : (
                <>
                  Continuar
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </>
              )}
            </button>
          </footer>
        </main>
      </div>
    </FormProvider>
  );
}
