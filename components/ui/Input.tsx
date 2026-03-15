import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedby, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[13px] font-medium text-apple-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={ariaInvalid ?? (error ? true : undefined)}
          aria-describedby={ariaDescribedby ?? (error && inputId ? `${inputId}-error` : undefined)}
          className={`
            w-full rounded-apple border px-4 py-3 text-base text-apple-gray-900
            focus:outline-none focus:ring-2 focus:ring-apple-blue focus:border-transparent
            disabled:bg-apple-gray-50 disabled:text-apple-gray-500
            ${error ? 'border-red-400 bg-red-50' : 'border-apple-gray-200 bg-white'}
            ${className}
          `}
          {...props}
        />
        {error && <p id={inputId ? `${inputId}-error` : undefined} className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
