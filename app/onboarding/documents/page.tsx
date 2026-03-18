'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentList } from '@/components/documents/DocumentList'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/client-fetch'
import { useSession } from '@/components/providers/SessionProvider'
import type { DocListItem } from '@/types/api'

export default function DocumentsPage() {
  const router = useRouter()
  const { signatureBase64 } = useSession()
  const [docs, setDocs] = useState<DocListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [allCompleted, setAllCompleted] = useState(false)
  const [checkingAll, setCheckingAll] = useState(false)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/docs/list?_t=${Date.now()}`)
      if (!res.ok) throw new Error('서류 목록 조회 실패')
      const data = await res.json()
      // Filter out personal_info_consent (handled in privacy-consent step)
      const filteredDocs = data.docs.filter(
        (d: DocListItem) => d.key !== 'personal_info_consent'
      )
      setDocs(filteredDocs)

      const completed = filteredDocs.every((d: DocListItem) => d.status !== 'pending')
      setAllCompleted(completed)
    } catch {
      setError('서류 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  const handleConsent = async (key: string) => {
    const res = await apiFetch('/api/docs/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentKey: key, signatureBase64 }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? '서류 처리 중 오류가 발생했습니다.')
    }
    await fetchDocs()
  }

  const handleCheckAll = async () => {
    setCheckingAll(true)
    try {
      const res = await apiFetch('/api/docs/check-all')
      const data = await res.json()
      if (data.allCompleted) {
        router.push('/onboarding/preview')
      } else {
        setError(`아직 완료되지 않은 서류가 있습니다: ${data.pending.join(', ')}`)
      }
    } catch {
      setError('완료 확인 중 오류가 발생했습니다.')
    } finally {
      setCheckingAll(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="h-7 w-48 bg-apple-gray-100 rounded-apple animate-pulse" />
          <div className="h-4 w-72 bg-apple-gray-100 rounded-apple animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-apple-lg border border-apple-gray-100 p-5 shadow-apple-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="h-5 w-32 bg-apple-gray-100 rounded animate-pulse" />
                <div className="h-5 w-16 bg-apple-gray-100 rounded-full animate-pulse" />
              </div>
              <div className="h-3 w-full bg-apple-gray-100 rounded animate-pulse mb-2" />
              <div className="h-8 w-28 bg-apple-gray-100 rounded-apple animate-pulse mt-4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[24px] font-bold text-apple-gray-900 tracking-[-0.01em]">입사 서류 작성</h2>
        <p className="text-apple-gray-500 mt-1 text-[15px]">
          아래 서류를 순서대로 확인하고 동의해주세요.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">{error}</p>
      )}

      <DocumentList docs={docs} onConsent={handleConsent} />

      <div className="flex lg:justify-end">
        <Button
          onClick={handleCheckAll}
          disabled={!allCompleted}
          loading={checkingAll}
          size="lg"
          className="w-full lg:w-auto lg:min-w-[160px]"
        >
          다음 단계로
        </Button>
      </div>
    </div>
  )
}
