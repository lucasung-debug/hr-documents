'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/Checkbox'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/components/providers/SessionProvider'

interface ConsentItem {
  id: string
  label: string
  checked: boolean
}

export default function PrivacyConsentPage() {
  const router = useRouter()
  const { employeeName } = useSession()

  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [consentItems, setConsentItems] = useState<ConsentItem[]>([
    { id: 'collection', label: '개인정보 수집 목적 동의', checked: false },
    { id: 'items', label: '수집 항목 확인', checked: false },
    { id: 'retention', label: '보유·이용 기간 동의', checked: false },
    { id: 'third_party', label: '제3자 제공 동의', checked: false },
    { id: 'sensitive', label: '민감정보 처리 동의', checked: false },
  ])

  const allChecked = consentItems.every((item) => item.checked)
  const anyChecked = consentItems.some((item) => item.checked)

  // Load preview PDF
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch('/api/docs/preview?documentKey=personal_info_consent')
        if (!res.ok) {
          throw new Error('미리보기 조회 실패')
        }
        const data = await res.json()
        setPdfBase64(data.pdfBase64)
      } catch (err) {
        setError('개인정보 동의서를 불러오는 중 오류가 발생했습니다.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [])

  const handleToggleItem = (id: string) => {
    setConsentItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    )
  }

  const handleToggleAll = () => {
    setConsentItems((prev) =>
      prev.map((item) => ({ ...item, checked: !allChecked }))
    )
  }

  const handleSubmit = async () => {
    if (!allChecked) {
      setError('모든 항목에 동의해주세요.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/docs/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentKey: 'personal_info_consent' }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '동의 처리 중 오류가 발생했습니다.')
        return
      }

      router.push('/onboarding/signature')
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[24px] font-bold text-apple-gray-900 tracking-[-0.01em]">
          개인정보 수집·이용 동의
        </h2>
        {employeeName && (
          <p className="text-apple-gray-700 mt-1 text-[15px]">
            {employeeName}님, 아래 동의 항목을 확인하고 체크해주세요.
          </p>
        )}
      </div>

      {/* PDF Preview Area */}
      {loading ? (
        <div className="bg-apple-gray-100 rounded-apple-lg h-96 flex items-center justify-center">
          <p className="text-apple-gray-500">문서를 로드 중입니다...</p>
        </div>
      ) : error && !pdfBase64 ? (
        <div className="bg-red-50 border border-red-200 rounded-apple-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      ) : pdfBase64 ? (
        <div className="bg-white border border-apple-gray-200 rounded-apple-lg overflow-hidden">
          <div className="h-96 overflow-auto bg-apple-gray-50 flex items-center justify-center">
            <embed
              src={`data:application/pdf;base64,${pdfBase64}`}
              type="application/pdf"
              className="w-full h-full"
            />
          </div>
        </div>
      ) : null}

      {/* Consent Checkboxes */}
      <div className="space-y-3">
        <div className="bg-apple-blue-light rounded-apple-lg p-4 border border-apple-blue-200">
          <Checkbox
            label="전체 동의"
            checked={allChecked}
            onChange={handleToggleAll}
            id="consent-all"
            className="text-[15px] font-semibold text-apple-gray-900"
          />
        </div>

        <div className="space-y-2 pl-1">
          {consentItems.map((item) => (
            <Checkbox
              key={item.id}
              label={item.label}
              checked={item.checked}
              onChange={() => handleToggleItem(item.id)}
              id={`consent-${item.id}`}
              className="p-2 rounded-apple hover:bg-apple-gray-50 transition-colors"
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">
          {error}
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!allChecked || submitting}
        loading={submitting}
        size="lg"
        className="w-full"
      >
        동의 후 다음 단계
      </Button>
    </div>
  )
}
