'use client'

import { useEffect, useState, useCallback } from 'react'
import type { DashboardResponse } from '@/types/admin'
import { StatsCards } from '@/components/admin/StatsCards'
import { StatusDistributionChart } from '@/components/admin/StatusDistributionChart'
import { EmployeeTable } from '@/components/admin/EmployeeTable'
import { IntegrationSetupPanel } from '@/components/admin/IntegrationSetupPanel'

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reminderLoading, setReminderLoading] = useState(false)
  const [demoMode, setDemoMode] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'
      setDemoMode(isDemo)
      const res = await fetch(`/api/admin/dashboard${isDemo ? '?demo=1' : ''}`)
      if (!res.ok) {
        if (res.status === 403) {
          setError('관리자 권한이 필요합니다.')
          return
        }
        throw new Error('데이터 조회 실패')
      }
      const json = await res.json()
      setData(json)
      setError('')
    } catch {
      setError('대시보드 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleSendReminder = async (employeeIds: string[]) => {
    if (!confirm(`${employeeIds.length}명에게 리마인더를 발송하시겠습니까?`)) return

    setReminderLoading(true)
    try {
      const res = await fetch('/api/admin/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_ids: employeeIds }),
      })
      const result = await res.json()
      if (res.ok) {
        alert(`${result.sent}건 발송 완료${result.failed.length > 0 ? `, ${result.failed.length}건 실패` : ''}`)
      } else {
        alert(result.error ?? '발송 실패')
      }
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setReminderLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-apple-gray-500">불러오는 중...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchDashboard}
          className="text-apple-blue hover:underline text-sm"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-bold text-apple-gray-900">온보딩 현황</h2>
        <button
          onClick={fetchDashboard}
          className="text-sm text-apple-blue hover:underline"
        >
          새로고침
        </button>
      </div>

      {demoMode && (
        <div className="rounded-apple-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          데모 모드: 가상 입사자 데이터로 표시되며 Google Sheets 인증과 외부 연동을 사용하지 않습니다.
        </div>
      )}

      <StatsCards stats={data.stats} />

      <StatusDistributionChart employees={data.employees} />

      <IntegrationSetupPanel />

      <EmployeeTable
        employees={data.employees}
        onSendReminder={handleSendReminder}
        reminderLoading={reminderLoading}
        demoMode={demoMode}
      />
    </div>
  )
}
