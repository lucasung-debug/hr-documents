'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentList } from '@/components/documents/DocumentList'
import { Button } from '@/components/ui/Button'
import type { DocListItem } from '@/types/api'

export default function DocumentsPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [allCompleted, setAllCompleted] = useState(false)
  const [checkingAll, setCheckingAll] = useState(false)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/docs/list')
      if (!res.ok) throw new Error('서류 목록 조회 실패')
      const data = await res.json()
      setDocs(data.docs)

      const completed = data.docs.every((d: DocListItem) => d.status !== 'pending')
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
    const res = await fetch('/api/docs/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentKey: key }),
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
      const res = await fetch('/api/docs/check-all')
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
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">입사 서류 작성</h2>
        <p className="text-gray-500 mt-1 text-sm">
          아래 서류를 순서대로 확인하고 동의해주세요.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <DocumentList docs={docs} onConsent={handleConsent} />

      <Button
        onClick={handleCheckAll}
        disabled={!allCompleted}
        loading={checkingAll}
        size="lg"
        className="w-full"
      >
        다음 단계로
      </Button>
    </div>
  )
}
