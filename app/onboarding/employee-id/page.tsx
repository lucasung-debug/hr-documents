'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { MaterialsSection } from '@/components/employee/MaterialsSection'
import { apiFetch } from '@/lib/api/client-fetch'
import type { EmployeeInfoResponse } from '@/types/api'

type Tab = 'info' | 'materials'

export default function EmployeeIdPage() {
  const router = useRouter()
  const [info, setInfo] = useState<EmployeeInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('info')

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await apiFetch('/api/employee/info')
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: '내 정보' },
    { key: 'materials', label: '입사 안내자료' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[24px] font-bold text-apple-gray-900 tracking-[-0.01em]">사번 배정 안내</h2>
        <p className="text-apple-gray-500 mt-1 text-[15px]">
          배정된 사번과 온보딩 자료를 확인해주세요.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">{error}</p>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-apple-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              px-5 py-3 text-sm font-medium transition-colors relative
              ${activeTab === tab.key
                ? 'text-apple-blue'
                : 'text-apple-gray-500 hover:text-apple-gray-700'
              }
            `}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-apple-blue rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'info' && info && (
        <>
          <div className="bg-apple-blue-light border border-apple-blue/20 rounded-apple-lg p-6">
            <p className="text-xs text-apple-blue font-semibold uppercase tracking-wide mb-2">배정 사번</p>
            <p className="text-[48px] font-bold text-apple-blue leading-none">{info.employee_id}</p>
          </div>

          <div className="bg-white border border-apple-gray-100 rounded-apple-lg shadow-apple-sm p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[
                { label: '성명', value: info.name },
                { label: '부서', value: info.department },
                { label: '직책', value: info.position },
                { label: '입사일', value: info.hire_date },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-apple-gray-100 last:border-0 lg:last:border-0">
                  <span className="text-[13px] text-apple-gray-500">{label}</span>
                  <span className="text-[14px] font-medium text-apple-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>


        </>
      )}

      {activeTab === 'materials' && (
        <MaterialsSection />
      )}

      <div className="flex lg:justify-end">
        <Button
          onClick={() => router.push('/onboarding/complete')}
          size="lg"
          className="w-full lg:w-auto lg:min-w-[160px]"
        >
          서류 최종 전송
        </Button>
      </div>
    </div>
  )
}
