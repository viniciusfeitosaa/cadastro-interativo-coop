import { motion } from 'framer-motion'
import {
  Briefcase,
  Check,
  CreditCard,
  IdCard,
  MapPin,
  Paperclip,
  Shield,
  User,
} from 'lucide-react'
import { STEPS } from '../../schemas/formSchema'
import './StepIndicator.css'

const icons = {
  user: User,
  'id-card': IdCard,
  'map-pin': MapPin,
  briefcase: Briefcase,
  landmark: CreditCard,
  paperclip: Paperclip,
  shield: Shield,
} as const

type StepIndicatorProps = {
  currentStep: number
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav className="step-indicator" aria-label="Progresso do formulário">
      <ol className="step-list">
        {STEPS.map((step, index) => {
          const Icon = icons[step.icon as keyof typeof icons]
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
                  <Check size={16} strokeWidth={2.5} />
                ) : (
                  <Icon size={16} strokeWidth={2} />
                )}
              </div>
              <div className="step-text">
                <span className="step-title">{step.title}</span>
                <span className="step-subtitle">{step.subtitle}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="step-connector" aria-hidden="true">
                  <motion.div
                    className="step-connector-fill"
                    initial={false}
                    animate={{ scaleX: isComplete ? 1 : 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
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
          <motion.div
            className="progress-fill"
            initial={false}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>
    </nav>
  )
}
