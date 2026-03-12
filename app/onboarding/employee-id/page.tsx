'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { EmployeeInfoResponse } from '@/types/api'

export default function EmployeeIdPage() {
  const router = useRouter()
  const [info, setInfo] = useState<EmployeeInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch('/api/employee/info')
        if (!res.ok) throw new Error('정보 조회 실패')
        const data = await res.json()
        setInfo(data)
      } catch {
        setError('직원 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [])

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
        <h2 className="text-xl font-bold text-gray-900">사번 배정 안내</h2>
        <p className="text-gray-500 mt-1 text-sm">
          배정된 사번과 온보딩 자료를 확인해주세요.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {info && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">배정 사번</p>
            <p className="text-3xl font-bold text-blue-700">{info.employee_id}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            {[
              { label: '성명', value: info.name },
              { label: '부서', value: info.department },
              { label: '직책', value: info.position },
              { label: '입사일', value: info.hire_date },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          {info.onboarding_link && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-medium text-green-800 mb-2">온보딩 자료</p>
              <a
                href={info.onboarding_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 underline break-all"
              >
                다운로드 링크 열기
              </a>
            </div>
          )}
        </>
      )}

      <Button
        onClick={() => router.push('/onboarding/complete')}
        size="lg"
        className="w-full"
      >
        서류 최종 전송
      </Button>
    </div>
  )
}
