'use client'

import { useState } from 'react'
import type { DocumentListItem } from '@/types/document'
import { DOCUMENT_DESCRIPTIONS, DOCUMENT_LABELS } from '@/types/document'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { apiFetch } from '@/lib/api/client-fetch'
import { DocumentPreviewModal } from './DocumentPreviewModal'

interface DocumentCardProps {
  doc: DocumentListItem
  onConsent: (key: string) => Promise<void>
}

const statusBadge = {
  pending: { label: '미완료', className: 'bg-apple-gray-100 text-apple-gray-500' },
  signed: { label: '서명완료', className: 'bg-green-100 text-green-700' },
  sent: { label: '발송완료', className: 'bg-apple-blue-light text-apple-blue' },
}

export function DocumentCard({ doc, onConsent }: DocumentCardProps) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewed, setPreviewed] = useState(false)

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPdf, setPreviewPdf] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const badge = statusBadge[doc.status]
  const isComplete = doc.status !== 'pending'

  const handlePreview = async () => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewPdf(null)

    try {
      const res = await apiFetch(`/api/docs/preview?documentKey=${doc.key}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '미리보기를 불러올 수 없습니다.')
      }
      const data = await res.json()
      setPreviewPdf(data.pdfBase64)
      setPreviewed(true)
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : '미리보기 로드 실패'
      )
    } finally {
      setPreviewLoading(false)
    }
  }

  const [consentError, setConsentError] = useState<string | null>(null)

  const handleConsent = async () => {
    if (!agreed || isComplete || !previewed) return
    setLoading(true)
    setConsentError(null)
    try {
      await onConsent(doc.key)
    } catch (err) {
      setConsentError(
        err instanceof Error ? err.message : '서류 처리 중 오류가 발생했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  const docLabel = DOCUMENT_LABELS[doc.key as keyof typeof DOCUMENT_LABELS] ?? doc.label

  return (
    <>
      <div className={`
        rounded-apple-lg border p-5 shadow-apple-sm transition-colors
        ${isComplete ? 'border-green-200 bg-green-50/60' : 'border-apple-gray-100 bg-white'}
      `}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-apple-gray-900 text-[15px]">{doc.label}</h3>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-[13px] text-apple-gray-500 mb-4">
          {DOCUMENT_DESCRIPTIONS[doc.key as keyof typeof DOCUMENT_DESCRIPTIONS]}
        </p>

        {!isComplete && (
          <div className="flex flex-col gap-3">
            {/* Preview button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreview}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                서류 미리보기
                {previewed && (
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
            </Button>

            {/* Consent checkbox - only enabled after preview */}
            <Checkbox
              label={
                previewed
                  ? '본 서류의 내용을 확인하였으며, 동의합니다.'
                  : '서류 미리보기를 먼저 확인해주세요.'
              }
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={loading || !previewed}
            />
            {consentError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-apple px-3 py-2">
                {consentError}
              </p>
            )}
            <Button
              size="sm"
              onClick={handleConsent}
              disabled={!agreed || loading || !previewed}
              loading={loading}
            >
              서명 및 제출
            </Button>
          </div>
        )}

        {isComplete && (
          <p className="text-sm text-green-700 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            서명이 완료되었습니다.
          </p>
        )}
      </div>

      {/* Preview modal */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        title={docLabel}
        pdfBase64={previewPdf}
        loading={previewLoading}
        error={previewError}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  )
}
