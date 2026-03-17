'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DOCUMENT_KEYS, DOCUMENT_LABELS } from '@/types/document'
import type { DocumentKey } from '@/types/document'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/client-fetch'
import { getCachedPreview, setCachedPreview } from '@/lib/api/preview-cache'

interface PreviewItem {
  key: DocumentKey
  label: string
  previewUrl: string | null
  previewType: 'png' | 'pdf' | null
  loading: boolean
  error: string | null
}

export default function PreviewPage() {
  const router = useRouter()
  const [previews, setPreviews] = useState<PreviewItem[]>(
    DOCUMENT_KEYS.map((key) => ({
      key,
      label: DOCUMENT_LABELS[key],
      previewUrl: null,
      previewType: null,
      loading: true,
      error: null,
    }))
  )
  const [currentIndex, setCurrentIndex] = useState(0)

  const fetchSinglePreview = useCallback(async (key: DocumentKey) => {
    // Check client-side cache first
    const cached = getCachedPreview(key)
    if (cached) {
      setPreviews((prev) =>
        prev.map((p) =>
          p.key === key
            ? { ...p, previewUrl: cached.previewUrl, previewType: cached.previewType, loading: false, error: null }
            : p
        )
      )
      return
    }

    setPreviews((prev) =>
      prev.map((p) => (p.key === key ? { ...p, loading: true, error: null } : p))
    )
    try {
      const res = await apiFetch('/api/docs/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentKey: key }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? '미리보기 생성에 실패했습니다.')
      }
      const url = data.previewUrl ?? null
      const type = data.previewType ?? 'pdf'
      if (url) {
        setCachedPreview(key, url, type)
      }
      setPreviews((prev) =>
        prev.map((p) =>
          p.key === key
            ? { ...p, previewUrl: url, previewType: type, loading: false, error: null }
            : p
        )
      )
    } catch (err) {
      setPreviews((prev) =>
        prev.map((p) =>
          p.key === key
            ? {
                ...p,
                loading: false,
                error: err instanceof Error ? err.message : '미리보기 로드 실패',
              }
            : p
        )
      )
    }
  }, [])

  useEffect(() => {
    // Parallel loading for all documents
    const results = DOCUMENT_KEYS.map((key) => fetchSinglePreview(key))
    Promise.allSettled(results)
  }, [fetchSinglePreview])

  const current = previews[currentIndex]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[24px] font-bold text-apple-gray-900 tracking-[-0.01em]">서류 최종 확인</h2>
        <p className="text-apple-gray-500 mt-1 text-[15px]">
          서명된 서류를 확인해주세요.
        </p>
      </div>

      {/* lg 이상: 2컬럼 (좌: 탭 목록, 우: PDF 미리보기) */}
      <div className="lg:flex lg:gap-6">
        {/* 좌측 서류 탭 목록 */}
        <div className="lg:w-48 flex-shrink-0 mb-4 lg:mb-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {previews.map((p, i) => (
              <button
                key={p.key}
                onClick={() => setCurrentIndex(i)}
                className={`
                  flex-shrink-0 text-left px-3 py-3 rounded-apple text-sm font-medium transition-colors min-h-[44px]
                  ${i === currentIndex
                    ? 'bg-apple-blue-light text-apple-blue'
                    : 'text-apple-gray-700 hover:bg-apple-gray-100'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {!p.loading && p.previewUrl && (
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {!p.loading && p.error && (
                    <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  {p.label}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* 우측 PDF 미리보기 */}
        <div className="flex-1">
          <div className="bg-white rounded-apple-lg border border-apple-gray-100 shadow-apple-sm overflow-hidden">
            <div className="bg-apple-gray-50 px-4 py-3 border-b border-apple-gray-100">
              <h3 className="font-medium text-apple-gray-900 text-[14px]">{current?.label}</h3>
            </div>
            <div className="p-4 flex justify-center min-h-48">
              {current?.loading ? (
                <div className="flex items-center gap-2 text-apple-gray-500">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-apple-blue" />
                  <span className="text-sm">미리보기 생성 중...</span>
                </div>
              ) : current?.error ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">
                    {current.error}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchSinglePreview(current.key)}
                  >
                    다시 시도
                  </Button>
                </div>
              ) : current?.previewUrl ? (
                current.previewType === 'pdf' ? (
                  <object
                    data={current.previewUrl}
                    type="application/pdf"
                    className="w-full h-[50vh] sm:h-[60vh] lg:h-[600px]"
                  >
                    <iframe
                      src={current.previewUrl}
                      className="w-full border-0 h-[50vh] sm:h-[60vh] lg:h-[600px]"
                      title={current.label}
                    />
                  </object>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={current.previewUrl} alt={current.label} className="max-w-full h-auto" />
                )
              ) : (
                <p className="text-sm text-apple-gray-500 flex items-center">미리보기를 불러올 수 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 전용 이전/다음 네비게이션 */}
      <div className="flex gap-3 lg:hidden">
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          이전
        </Button>
        {currentIndex < previews.length - 1 ? (
          <Button onClick={() => setCurrentIndex((i) => i + 1)} className="flex-1">
            다음 서류
          </Button>
        ) : (
          <Button onClick={() => router.push('/onboarding/employee-id')} className="flex-1">
            확인 완료
          </Button>
        )}
      </div>

      {/* 데스크탑 완료 버튼 */}
      <div className="hidden lg:flex justify-end">
        <Button onClick={() => router.push('/onboarding/employee-id')} size="lg" className="min-w-[160px]">
          확인 완료
        </Button>
      </div>
    </div>
  )
}
