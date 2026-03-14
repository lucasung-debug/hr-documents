import { InputHTMLAttributes } from 'react'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function Checkbox({ label, id, className = '', ...props }: CheckboxProps) {
  const checkboxId = id ?? `checkbox-${label.replace(/\s/g, '-')}`

  return (
    <label htmlFor={checkboxId} className={`flex items-center gap-3 cursor-pointer group ${className}`}>
      <input
        type="checkbox"
        id={checkboxId}
        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        {...props}
      />
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
    </label>
  )
}
