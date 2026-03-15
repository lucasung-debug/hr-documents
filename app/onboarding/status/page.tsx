'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { DOCUMENT_LABELS } from '@/types/document'
import type { DocumentKey } from '@/types/document'

export default function StatusPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [allCompleted, setAllCompleted] = useState(false)
  const [pending, setPending] = useState<DocumentKey[]>([])

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/docs/check-all')
        const data = await res.json()
        setAllCompleted(data.allCompleted)
        setPending(data.pending ?? [])
      } catch {
        // Non-fatal
      } finally {
        setChecking(false)
      }
    }
    checkStatus()
  }, [])

  return (
    <div className="flex flex-col gap-6 text-center">
      {checking ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue" />
        </div>
      ) : (
        <>
          {allCompleted ? (
            <>
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-[22px] font-bold text-apple-gray-900 tracking-[-0.01em]">서류 작성이 완료되었습니다.</h2>
                  <p className="text-apple-gray-500 text-[15px] mt-1">
                    자동 전송되었습니다. 다음 단계에서 사번을 확인해주세요.
                  </p>
                </div>
              </div>
              <Button onClick={() => router.push('/onboarding/employee-id')} size="lg">
                다음 단계로
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-[22px] font-bold text-apple-gray-900 tracking-[-0.01em]">미완료 서류가 있습니다.</h2>
                  <div className="text-left mt-3 bg-yellow-50 rounded-apple-lg border border-yellow-200 p-4">
                    <p className="text-sm font-medium text-yellow-800 mb-2">다음 서류를 완료해주세요:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {pending.map((key) => (
                        <li key={key} className="text-sm text-yellow-700">
                          {DOCUMENT_LABELS[key]}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => router.push('/onboarding/documents')}
                size="lg"
              >
                서류 작성으로 돌아가기
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}
