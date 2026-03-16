'use client'

import { useState } from 'react'

interface AccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  checked?: boolean
  onCheck?: (checked: boolean) => void
  checkboxId?: string
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
  checked,
  onCheck,
  checkboxId,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-apple-gray-200 rounded-apple-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-apple-gray-50 cursor-pointer select-none hover:bg-apple-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {onCheck && (
          <input
            type="checkbox"
            id={checkboxId}
            checked={checked}
            onChange={(e) => {
              e.stopPropagation()
              onCheck(e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
          />
        )}
        <span className="flex-1 text-[15px] font-semibold text-apple-gray-900">
          {title}
        </span>
        <svg
          className={`w-5 h-5 text-apple-gray-500 transition-transform duration-200 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="px-4 py-3 border-t border-apple-gray-200 bg-white text-sm text-apple-gray-700 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}
