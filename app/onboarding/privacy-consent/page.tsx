'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion } from '@/components/ui/Accordion'
import { Checkbox } from '@/components/ui/Checkbox'
import { Button } from '@/components/ui/Button'
import { apiFetch } from '@/lib/api/client-fetch'
import { useSession } from '@/components/providers/SessionProvider'
import {
  PRIVACY_CONSENT_INTRO,
  PRIVACY_CONSENT_SECTIONS,
  PRIVACY_CONSENT_FOOTER,
} from '@/config/privacy-consent'

export default function PrivacyConsentPage() {
  const router = useRouter()
  const { employeeName } = useSession()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 각 섹션별 동의 상태
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PRIVACY_CONSENT_SECTIONS.map((s) => [s.id, false]))
  )

  const allChecked = PRIVACY_CONSENT_SECTIONS.every((s) => checkedMap[s.id])

  const handleToggle = (id: string, checked: boolean) => {
    setCheckedMap((prev) => ({ ...prev, [id]: checked }))
  }

  const handleToggleAll = () => {
    const next = !allChecked
    setCheckedMap(
      Object.fromEntries(PRIVACY_CONSENT_SECTIONS.map((s) => [s.id, next]))
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
      const res = await apiFetch('/api/docs/consent', {
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
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
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

      {/* Intro */}
      <div className="bg-apple-gray-50 rounded-apple-lg p-4 text-sm text-apple-gray-700 leading-relaxed">
        {PRIVACY_CONSENT_INTRO}
      </div>

      {/* Toggle All */}
      <div className="bg-apple-blue-light rounded-apple-lg p-4 border border-apple-blue-200">
        <Checkbox
          label="전체 동의"
          checked={allChecked}
          onChange={handleToggleAll}
          id="consent-all"
          className="text-[15px] font-semibold text-apple-gray-900"
        />
      </div>

      {/* Consent Sections */}
      <div className="space-y-3">
        {PRIVACY_CONSENT_SECTIONS.map((section) => (
          <Accordion
            key={section.id}
            title={section.title}
            checked={checkedMap[section.id]}
            onCheck={(checked) => handleToggle(section.id, checked)}
            checkboxId={`consent-${section.id}`}
          >
            {section.description && (
              <p className="mb-3 text-apple-gray-600">{section.description}</p>
            )}

            <table className="w-full border-collapse mb-3">
              <tbody>
                {section.table.map((row, i) => (
                  <tr key={i} className="border border-apple-gray-200">
                    <td className="bg-apple-gray-50 px-3 py-2 font-medium text-apple-gray-800 w-[140px] align-top whitespace-nowrap">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 text-apple-gray-700 whitespace-pre-line">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-apple-gray-500 bg-apple-gray-50 rounded-apple px-3 py-2">
              {section.refusalNotice}
            </p>
          </Accordion>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-apple-gray-50 rounded-apple-lg p-4 text-xs text-apple-gray-500 leading-relaxed">
        {PRIVACY_CONSENT_FOOTER}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">
          {error}
        </p>
      )}

      {/* Submit */}
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
