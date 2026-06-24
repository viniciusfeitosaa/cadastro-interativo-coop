import type { InputHTMLAttributes } from 'react'
import { useFormContext } from 'react-hook-form'
import type { FormData } from '../../schemas/formSchema'
import './FormControls.css'

type FieldProps = {
  name: keyof FormData
  label: string
  hint?: string
  required?: boolean
  className?: string
}

export function TextField({
  name,
  label,
  hint,
  required = true,
  className = '',
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormData>()
  const error = errors[name]?.message as string | undefined

  const registration = 'onChange' in props && props.onChange ? {} : register(name)

  return (
    <div className={`field ${className}`}>
      <label htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input id={name} {...registration} {...props} />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

export function SelectField({
  name,
  label,
  options,
  required = true,
  className = '',
  placeholder = 'Selecione...',
}: FieldProps & {
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormData>()
  const error = errors[name]?.message as string | undefined

  return (
    <div className={`field ${className}`}>
      <label htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <select id={name} defaultValue="" {...register(name)}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

export function PhoneGroup({
  dddName,
  phoneName,
  label,
}: {
  dddName: keyof FormData
  phoneName: keyof FormData
  label: string
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormData>()
  const dddError = errors[dddName]?.message as string | undefined
  const phoneError = errors[phoneName]?.message as string | undefined

  return (
    <div className="field phone-group">
      <label>
        {label}
        <span className="required">*</span>
      </label>
      <div className="phone-row">
        <input
          placeholder="DDD"
          maxLength={2}
          inputMode="numeric"
          aria-label={`${label} — DDD`}
          {...register(dddName)}
        />
        <input
          placeholder="00000-0000"
          maxLength={10}
          inputMode="tel"
          aria-label={`${label} — número`}
          {...register(phoneName)}
        />
      </div>
      {(dddError || phoneError) && (
        <span className="field-error">{dddError || phoneError}</span>
      )}
    </div>
  )
}

export function FileField({
  name,
  label,
  accept = '.pdf,.jpg,.jpeg,.png',
  hint = 'PDF, JPG ou PNG — máx. 10 MB',
}: {
  name: keyof FormData
  label: string
  accept?: string
  hint?: string
}) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<FormData>()
  const error = errors[name]?.message as string | undefined
  const files = watch(name) as FileList | undefined
  const fileName = files?.[0]?.name

  return (
    <div className="field file-field">
      <label htmlFor={name}>
        {label}
        <span className="required">*</span>
      </label>
      <div className="file-drop">
        <input
          id={name}
          type="file"
          accept={accept}
          {...register(name)}
        />
        <div className="file-drop-content">
          <span className="file-drop-icon">↑</span>
          <span>{fileName ?? 'Clique ou arraste o arquivo'}</span>
          <span className="file-drop-hint">{hint}</span>
        </div>
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
