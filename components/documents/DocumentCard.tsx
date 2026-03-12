'use client'

import { useState } from 'react'
import type { DocumentListItem } from '@/types/document'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'

interface DocumentCardProps {
  doc: DocumentListItem
  onConsent: (key: string) => Promise<void>
}

const statusBadge = {
  pending: { label: '미완료', className: 'bg-gray-100 text-gray-600' },
  signed: { label: '서명완료', className: 'bg-green-100 text-green-700' },
  sent: { label: '발송완료', className: 'bg-blue-100 text-blue-700' },
}

export function DocumentCard({ doc, onConsent }: DocumentCardProps) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  const badge = statusBadge[doc.status]
  const isComplete = doc.status !== 'pending'

  const handleConsent = async () => {
    if (!agreed || isComplete) return
    setLoading(true)
    try {
      await onConsent(doc.key)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`rounded-xl border p-4 ${isComplete ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">{doc.label}</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {!isComplete && (
        <div className="flex flex-col gap-3">
          <Checkbox
            label="본 서류의 내용을 확인하였으며, 동의합니다."
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={loading}
          />
          <Button
            size="sm"
            onClick={handleConsent}
            disabled={!agreed || loading}
            loading={loading}
          >
            서명 및 제출
          </Button>
        </div>
      )}

      {isComplete && (
        <p className="text-sm text-green-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          서명이 완료되었습니다.
        </p>
      )}
    </div>
  )
}
