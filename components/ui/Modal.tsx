'use client'

import { useEffect } from 'react'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  'aria-labelledby'?: string
}

export function Modal({
  isOpen,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  loading = false,
  'aria-labelledby': ariaLabelledby,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledby ?? 'modal-title'}
        className="relative bg-white rounded-apple-xl shadow-apple-md max-w-md w-full mx-4 p-6"
      >
        <h2 id={ariaLabelledby ?? 'modal-title'} className="text-lg font-semibold text-apple-gray-900 mb-2">{title}</h2>
        <p className="text-apple-gray-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
