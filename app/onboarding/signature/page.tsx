'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { SignaturePreview } from '@/components/signature/SignaturePreview'
import { useSession } from '@/components/providers/SessionProvider'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/client-fetch'

export default function SignaturePage() {
  const router = useRouter()
  const { employeeName, setSignHash, setSignatureBase64 } = useSession()

  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCapture = (dataUrl: string) => {
    setCapturedDataUrl(dataUrl)
    setError('')
  }

  const handleReSign = () => {
    setCapturedDataUrl(null)
    setError('')
  }

  const handleSubmit = async () => {
    if (!capturedDataUrl) return
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('/api/sign/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureBase64: capturedDataUrl }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '서명 저장에 실패했습니다.')
        return
      }

      setSignHash(data.signHash)
      setSignatureBase64(capturedDataUrl)
      router.push('/onboarding/documents')
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[24px] font-bold text-apple-gray-900 tracking-[-0.01em]">전자서명</h2>
        {employeeName && (
          <p className="text-apple-gray-700 mt-1 text-[15px]">{employeeName}님, 아래에 서명해주세요.</p>
        )}
        <p className="text-sm text-apple-gray-500 mt-1">
          이 서명은 모든 입사 서류에 동일하게 사용됩니다.
        </p>
      </div>

      {!capturedDataUrl ? (
        <SignaturePad onCapture={handleCapture} disabled={loading} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-apple-lg border border-green-200 p-5">
            <p className="text-sm font-medium text-green-700 mb-3">서명이 완료되었습니다.</p>
            <SignaturePreview dataUrl={capturedDataUrl} onReSign={handleReSign} />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading}
            loading={loading}
            size="lg"
            className="w-full"
          >
            다음 단계로
          </Button>
        </div>
      )}
    </div>
  )
}
