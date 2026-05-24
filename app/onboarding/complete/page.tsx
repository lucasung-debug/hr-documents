'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SendConfirmModal } from '@/components/email/SendConfirmModal'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/components/providers/SessionProvider'
import { apiFetch } from '@/lib/api/client-fetch'
import { isClientDemoSession } from '@/lib/onboarding/demo-mode'
import { DemoDocumentPreview } from '@/components/documents/DemoDocumentPreview'

export default function CompletePage() {
  const router = useRouter()
  const { signatureBase64 } = useSession()
  const [modalOpen, setModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    const isDemo = isClientDemoSession()
    setDemoMode(isDemo)
    if (isDemo) {
      setSending(true)
      window.setTimeout(() => {
        setSent(true)
        setSending(false)
      }, 700)
      return
    }
    setModalOpen(true)
  }, [])

  const handleSend = async () => {
    setSending(true)
    setError('')
    try {
      if (demoMode) {
        window.setTimeout(() => {
          setModalOpen(false)
          setSent(true)
          setSending(false)
        }, 700)
        return
      }

      const res = await apiFetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureBase64 }),
      })
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
      if (!demoMode) setSending(false)
    }
  }

  const handleCancel = () => {
    setModalOpen(false)
    router.push('/onboarding/employee-id')
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-6 text-center py-10">
        <div className="w-28 h-28 bg-apple-blue-light rounded-full flex items-center justify-center">
          <svg className="w-14 h-14 text-apple-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div>
          <h2 className="text-[28px] font-bold text-apple-gray-900 tracking-[-0.02em]">완료되었습니다.</h2>
          <p className="text-xl text-apple-blue font-semibold mt-1">입사를 축하드립니다!</p>
          <p className="text-apple-gray-500 mt-3 text-[15px] leading-relaxed">
            {demoMode ? (
              '데모 서류 흐름이 완료되었습니다.'
            ) : (
              <>
                입사 서류가 인사팀과 귀하의 이메일로 발송되었습니다.<br />
                이메일에서 서류 사본을 확인하실 수 있습니다.
              </>
            )}
          </p>
        </div>

        {demoMode && (
          <div className="w-full bg-white rounded-apple-lg border border-apple-gray-100 shadow-apple-sm overflow-hidden">
            <div className="bg-apple-gray-50 px-4 py-3 border-b border-apple-gray-100 text-left">
              <h3 className="font-medium text-apple-gray-900 text-[14px]">샘플 서명 계약서</h3>
            </div>
            <div className="p-4">
              <DemoDocumentPreview docLabel="근로계약서" signatureBase64={signatureBase64} className="w-full" />
            </div>
          </div>
        )}

        {!demoMode && (
          <div className="w-full bg-apple-gray-50 rounded-apple-lg border border-apple-gray-100 p-5 text-sm text-apple-gray-700 text-left space-y-2">
          <p className="font-semibold text-apple-gray-900">안내 사항</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>입사 첫날 신분증을 지참해주세요.</li>
            <li>온보딩 교육 자료를 미리 확인해주세요.</li>
            <li>문의 사항은 인사팀으로 연락해주세요.</li>
          </ul>
          </div>
        )}

        <p className="text-xs text-apple-gray-500">이 세션은 종료되었습니다.</p>
      </div>
    )
  }

  if (demoMode && sending) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-apple-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue" />
        <p className="text-sm">샘플 PDF 준비 중...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[24px] font-bold text-apple-gray-900 tracking-[-0.01em]">최종 전송</h2>
        <p className="text-apple-gray-500 mt-1 text-[15px]">
          {demoMode ? '서명된 샘플 서류를 확인합니다.' : '서명된 서류를 인사팀과 귀하의 이메일로 전송합니다.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-apple-lg p-5">
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
          {demoMode ? '샘플 PDF 보기' : '전송하기'}
        </Button>
      )}

      <SendConfirmModal
        isOpen={!demoMode && modalOpen}
        onConfirm={handleSend}
        onCancel={handleCancel}
        loading={sending}
      />
    </div>
  )
}
