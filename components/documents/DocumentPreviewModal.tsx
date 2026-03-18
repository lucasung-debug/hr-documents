'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { PdfCanvasViewer } from './PdfCanvasViewer'

interface DocumentPreviewModalProps {
  isOpen: boolean
  title: string
  pdfBase64: string | null
  loading: boolean
  error: string | null
  onClose: () => void
}

export function DocumentPreviewModal({
  isOpen,
  title,
  pdfBase64,
  loading,
  error,
  onClose,
}: DocumentPreviewModalProps) {
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
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
        className="relative bg-white rounded-apple-xl shadow-apple-md w-full max-w-3xl mx-2 sm:mx-4 flex flex-col max-h-[95vh] sm:max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-apple-gray-100">
          <h2
            id="preview-modal-title"
            className="text-base sm:text-lg font-semibold text-apple-gray-900 truncate mr-2"
          >
            {title} — 미리보기
          </h2>
          <button
            onClick={onClose}
            className="text-apple-gray-400 hover:text-apple-gray-600 transition-colors p-2 -m-2 touch-target flex-shrink-0"
            aria-label="닫기"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 min-h-[400px]">
          {loading && (
            <div className="flex justify-center items-center h-full min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-apple-blue" />
                <p className="text-sm text-apple-gray-500">서류를 불러오는 중...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center items-center h-full min-h-[400px]">
              <div className="text-center">
                <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">
                  {error}
                </p>
              </div>
            </div>
          )}

          {!loading && !error && pdfBase64 && (
            <PdfCanvasViewer
              pdfBase64={pdfBase64}
              className="w-full rounded-apple h-[55vh] sm:h-[70vh] overflow-y-auto"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-apple-gray-100">
          {pdfBase64 ? (
            <a
              href={`data:application/pdf;base64,${pdfBase64}`}
              download={`${title}.pdf`}
              className="text-sm text-apple-blue underline"
            >
              PDF 다운로드
            </a>
          ) : <span />}
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
}
