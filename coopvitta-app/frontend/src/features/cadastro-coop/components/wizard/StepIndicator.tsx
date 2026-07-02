import { STEPS } from '../../schemas/formSchema'
import './StepIndicator.css'

type StepIndicatorProps = {
  currentStep: number
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const progressPct = ((currentStep + 1) / STEPS.length) * 100

  return (
    <nav className="step-indicator" aria-label="Progresso do formulário">
      <ol className="step-list">
        {STEPS.map((step, index) => {
          const isComplete = index < currentStep
          const isActive = index === currentStep

          return (
            <li
              key={step.id}
              className={`step-item ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="step-marker">
                {isComplete ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="step-text">
                <span className="step-title">{step.title}</span>
                <span className="step-subtitle">{step.subtitle}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="step-connector" aria-hidden="true">
                  <div
                    className="step-connector-fill"
                    style={{ transform: `scaleX(${isComplete ? 1 : 0})` }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <div className="step-progress-mobile">
        <span>
          Etapa {currentStep + 1} de {STEPS.length}
        </span>
        <strong>{STEPS[currentStep].title}</strong>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </nav>
  )
}
