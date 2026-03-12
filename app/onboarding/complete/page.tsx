'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SendConfirmModal } from '@/components/email/SendConfirmModal'
import { Button } from '@/components/ui/Button'

export default function CompletePage() {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Show the confirm modal automatically on mount
  useEffect(() => {
    setModalOpen(true)
  }, [])

  const handleSend = async () => {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/email/send', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '전송 중 오류가 발생했습니다.')
        setModalOpen(false)
        return
      }

      setModalOpen(false)
      setSent(true)
    } catch {
      setError('네트워크 오류가 발생했습니다. 인사팀에 문의해주세요.')
      setModalOpen(false)
    } finally {
      setSending(false)
    }
  }

  const handleCancel = () => {
    setModalOpen(false)
    router.push('/onboarding/employee-id')
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-6 text-center py-10">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">완료되었습니다.</h2>
          <p className="text-xl text-blue-600 font-semibold mt-1">입사를 축하드립니다!</p>
          <p className="text-gray-500 mt-3 text-sm leading-relaxed">
            입사 서류가 인사팀과 귀하의 이메일로 발송되었습니다.<br />
            이메일에서 서류 사본을 확인하실 수 있습니다.
          </p>
        </div>

        <div className="w-full bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm text-gray-600 text-left space-y-2">
          <p className="font-medium text-gray-800">안내 사항</p>
          <ul className="list-disc list-inside space-y-1">
            <li>입사 첫날 신분증을 지참해주세요.</li>
            <li>온보딩 교육 자료를 미리 확인해주세요.</li>
            <li>문의 사항은 인사팀으로 연락해주세요.</li>
          </ul>
        </div>

        <p className="text-xs text-gray-400">이 세션은 종료되었습니다.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">최종 전송</h2>
        <p className="text-gray-500 mt-1 text-sm">
          서명된 서류를 인사팀과 귀하의 이메일로 전송합니다.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{error}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => setModalOpen(true)}
          >
            다시 전송 시도
          </Button>
        </div>
      )}

      {!error && (
        <Button onClick={() => setModalOpen(true)} size="lg" className="w-full">
          전송하기
        </Button>
      )}

      <SendConfirmModal
        isOpen={modalOpen}
        onConfirm={handleSend}
        onCancel={handleCancel}
        loading={sending}
      />
    </div>
  )
}
