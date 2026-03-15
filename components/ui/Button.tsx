import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variantClasses = {
  primary: 'bg-apple-blue hover:bg-apple-blue-hover text-white disabled:bg-apple-blue/40',
  secondary: 'bg-apple-gray-100 hover:bg-apple-gray-200 text-apple-gray-900 disabled:bg-apple-gray-50 disabled:text-apple-gray-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300',
}

const sizeClasses = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        rounded-full font-medium transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-apple-blue focus:ring-offset-2
        active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          처리 중...
        </span>
      ) : children}
    </button>
  )
}
