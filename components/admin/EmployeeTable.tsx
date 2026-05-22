'use client'

import { Fragment, useState } from 'react'
import type { DashboardEmployee } from '@/types/admin'
import { DOCUMENT_KEYS, DOCUMENT_LABELS } from '@/types/document'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/Button'
import { filterDashboardEmployees, isReminderEligible } from './dashboard-filters'
import type { DashboardFilter } from './dashboard-filters'

interface EmployeeTableProps {
  employees: DashboardEmployee[]
  onSendReminder: (employeeIds: string[]) => void
  reminderLoading: boolean
  demoMode?: boolean
}

const filters: { key: DashboardFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'action_required', label: '조치 필요' },
  { key: 'archive_pending', label: '보관 대기' },
  { key: 'sync_failed', label: '동기화 실패' },
  { key: 'completed', label: '완료' },
]

const caseStatusLabels: Record<string, string> = {
  collecting_documents: '서류 수집',
  docs_completed: 'PDF 생성 완료',
  action_required: '조치 필요',
  archived: '보관 완료',
  failed: '실패',
}

const pipelineStatusLabels: Record<string, string> = {
  pending: '대기',
  generated: '생성 완료',
  failed: '실패',
  synced: '동기화 완료',
  none: '없음',
  email_sent: '이메일 발송',
  slack_sent: 'Slack 발송',
  both: '이메일/Slack 발송',
}

export function EmployeeTable({ employees, onSendReminder, reminderLoading, demoMode = false }: EmployeeTableProps) {
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = filterDashboardEmployees(employees, { filter, search })

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(e => e.employee_id)))
    }
  }

  const incompleteSelected = [...selected].filter(id => {
    const emp = employees.find(e => e.employee_id === id)
    return emp && isReminderEligible(emp)
  })

  return (
    <div className="bg-white rounded-apple-xl border border-apple-gray-100 shadow-apple-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 border-b border-apple-gray-100">
        <div className="flex flex-wrap gap-1">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 text-sm rounded-full transition-colors min-h-[36px] ${
                filter === key
                  ? 'bg-apple-blue text-white'
                  : 'text-apple-gray-600 hover:bg-apple-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="이름, 부서, 케이스 ID 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-apple-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/30 flex-1 sm:max-w-[240px]"
        />
        {!demoMode && incompleteSelected.length > 0 && (
          <Button
            size="sm"
            loading={reminderLoading}
            onClick={() => onSendReminder(incompleteSelected)}
          >
            선택 알림 ({incompleteSelected.length})
          </Button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-apple-gray-50 text-apple-gray-600 text-left">
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">부서</th>
              <th className="px-4 py-3 font-medium">입사일</th>
              <th className="px-4 py-3 font-medium">케이스</th>
              <th className="px-4 py-3 font-medium">서류</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-apple-gray-100">
            {filtered.map(emp => (
              <Fragment key={emp.employee_id}>
                <tr
                  className="hover:bg-apple-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === emp.employee_id ? null : emp.employee_id)}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(emp.employee_id)}
                      onChange={() => toggleSelect(emp.employee_id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-apple-gray-900">{emp.name}</td>
                  <td className="px-4 py-3 text-apple-gray-600">{emp.department}</td>
                  <td className="px-4 py-3 text-apple-gray-600">{emp.hire_date}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-apple-gray-900">{emp.case_id || '-'}</div>
                    <div className="text-xs text-apple-gray-500">{caseStatusLabels[emp.case_status] ?? emp.case_status}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge completed={emp.completed_count} total={DOCUMENT_KEYS.length} />
                  </td>
                  <td className="px-4 py-3 text-apple-gray-500 text-xs hidden lg:table-cell">
                    {emp.action_required !== 'none' ? emp.action_required : emp.workspace_sync_status}
                  </td>
                </tr>
                {expandedId === emp.employee_id && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 bg-apple-gray-50">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                          <p className="text-xs font-semibold text-apple-gray-700 mb-2">문서 체크리스트</p>
                          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 text-xs">
                        {DOCUMENT_KEYS.map(key => {
                          const status = emp.documents[key]
                          const isDone = status !== 'pending'
                          return (
                            <div key={key} className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isDone ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <span className={isDone ? 'text-apple-gray-900' : 'text-apple-gray-400'}>
                                {DOCUMENT_LABELS[key]} · {status}
                              </span>
                            </div>
                          )
                        })}
                          </div>
                        </div>
                        <div className="text-xs text-apple-gray-600 space-y-1">
                          <p><span className="font-semibold">PDF</span> {pipelineStatusLabels[emp.pdf_packet_status] ?? emp.pdf_packet_status}</p>
                          <p><span className="font-semibold">Workspace</span> {pipelineStatusLabels[emp.workspace_sync_status] ?? emp.workspace_sync_status}</p>
                          <p><span className="font-semibold">Notification</span> {pipelineStatusLabels[emp.notification_status] ?? emp.notification_status}</p>
                          {emp.drive_archived_at && <p><span className="font-semibold">Drive 보관</span> {emp.drive_archived_at}</p>}
                          {emp.slack_notified_at && <p><span className="font-semibold">Slack 알림</span> {emp.slack_notified_at}</p>}
                          {emp.blocked_reason && (
                            <p className="rounded-apple bg-red-50 px-2 py-1 text-red-700">
                              {emp.blocked_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      {emp.all_completed_at && (
                        <p className="text-xs text-apple-gray-500 mt-2">
                          전체 완료: {emp.all_completed_at}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-apple-gray-500">
                  {search ? '검색 결과가 없습니다.' : '직원 데이터가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-apple-gray-500 text-sm">
            {search ? '검색 결과가 없습니다.' : '직원 데이터가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y divide-apple-gray-100">
            {filtered.map(emp => (
              <div key={emp.employee_id} className="p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(emp.employee_id)}
                    onChange={() => toggleSelect(emp.employee_id)}
                    className="rounded mt-1 flex-shrink-0"
                  />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === emp.employee_id ? null : emp.employee_id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-apple-gray-900 truncate">{emp.name}</p>
                        <p className="text-xs text-apple-gray-500">{emp.department} · {emp.hire_date}</p>
                        <p className="text-xs text-apple-gray-500">{emp.case_id || '-'} · {caseStatusLabels[emp.case_status] ?? emp.case_status}</p>
                      </div>
                      <StatusBadge completed={emp.completed_count} total={DOCUMENT_KEYS.length} />
                    </div>
                    {expandedId === emp.employee_id && (
                      <div className="mt-3 pt-3 border-t border-apple-gray-100">
                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                          {DOCUMENT_KEYS.map(key => {
                            const status = emp.documents[key]
                            const isDone = status !== 'pending'
                            return (
                              <div key={key} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDone ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className={`truncate ${isDone ? 'text-apple-gray-900' : 'text-apple-gray-400'}`}>
                                  {DOCUMENT_LABELS[key]}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-3 text-xs text-apple-gray-600 space-y-1">
                          <p><span className="font-semibold">PDF</span> {pipelineStatusLabels[emp.pdf_packet_status] ?? emp.pdf_packet_status}</p>
                          <p><span className="font-semibold">Workspace</span> {pipelineStatusLabels[emp.workspace_sync_status] ?? emp.workspace_sync_status}</p>
                          <p><span className="font-semibold">Notification</span> {pipelineStatusLabels[emp.notification_status] ?? emp.notification_status}</p>
                          {emp.drive_archived_at && <p><span className="font-semibold">Drive 보관</span> {emp.drive_archived_at}</p>}
                          {emp.slack_notified_at && <p><span className="font-semibold">Slack 알림</span> {emp.slack_notified_at}</p>}
                          {emp.blocked_reason && (
                            <p className="rounded-apple bg-red-50 px-2 py-1 text-red-700">
                              {emp.blocked_reason}
                            </p>
                          )}
                        </div>
                        {emp.all_completed_at && (
                          <p className="text-xs text-apple-gray-500 mt-2">
                            전체 완료: {emp.all_completed_at}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
