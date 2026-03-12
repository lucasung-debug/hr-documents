'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DOCUMENT_KEYS, DOCUMENT_LABELS } from '@/types/document'
import type { DocumentKey } from '@/types/document'
import { Button } from '@/components/ui/Button'

interface PreviewItem {
  key: DocumentKey
  label: string
  previewUrl: string | null
  loading: boolean
}

export default function PreviewPage() {
  const router = useRouter()
  const [previews, setPreviews] = useState<PreviewItem[]>(
    DOCUMENT_KEYS.map((key) => ({
      key,
      label: DOCUMENT_LABELS[key],
      previewUrl: null,
      loading: true,
    }))
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    const fetchPreviews = async () => {
      for (const key of DOCUMENT_KEYS) {
        try {
          const res = await fetch('/api/docs/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentKey: key }),
          })
          const data = await res.json()
          setPreviews((prev) =>
            prev.map((p) =>
              p.key === key
                ? { ...p, previewUrl: data.previewUrl ?? null, loading: false }
                : p
            )
          )
        } catch {
          setPreviews((prev) =>
            prev.map((p) => (p.key === key ? { ...p, loading: false } : p))
          )
        }
      }
    }
    fetchPreviews()
  }, [])

  const current = previews[currentIndex]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">서류 최종 확인</h2>
        <p className="text-gray-500 mt-1 text-sm">
          서명된 서류를 확인해주세요. ({currentIndex + 1}/{previews.length})
        </p>
      </div>

      {globalError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{globalError}</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">{current?.label}</h3>
        </div>
        <div className="p-4 flex justify-center min-h-48">
          {current?.loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <span className="text-sm">미리보기 생성 중...</span>
            </div>
          ) : current?.previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={current.previewUrl} alt={current.label} className="max-w-full h-auto" />
          ) : (
            <p className="text-sm text-gray-400 flex items-center">미리보기를 불러올 수 없습니다.</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          이전
        </Button>
        {currentIndex < previews.length - 1 ? (
          <Button
            onClick={() => setCurrentIndex((i) => i + 1)}
            className="flex-1"
          >
            다음 서류
          </Button>
        ) : (
          <Button
            onClick={() => router.push('/onboarding/status')}
            className="flex-1"
          >
            확인 완료
          </Button>
        )}
      </div>
    </div>
  )
}
