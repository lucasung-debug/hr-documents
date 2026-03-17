import { InputHTMLAttributes } from 'react'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function Checkbox({ label, id, className = '', ...props }: CheckboxProps) {
  const checkboxId = id ?? `checkbox-${label.replace(/\s/g, '-')}`

  return (
    <label htmlFor={checkboxId} className={`flex items-center gap-3 cursor-pointer group min-h-[44px] ${className}`}>
      <span className="flex items-center justify-center w-[44px] h-[44px] -m-3 flex-shrink-0">
        <input
          type="checkbox"
          id={checkboxId}
          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          {...props}
        />
      </span>
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
    </label>
  )
}
