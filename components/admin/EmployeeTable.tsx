'use client'

import { useState } from 'react'
import type { DashboardEmployee } from '@/types/admin'
import { DOCUMENT_KEYS, DOCUMENT_LABELS } from '@/types/document'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/Button'

interface EmployeeTableProps {
  employees: DashboardEmployee[]
  onSendReminder: (employeeIds: string[]) => void
  reminderLoading: boolean
}

type FilterType = 'all' | 'incomplete' | 'completed'

export function EmployeeTable({ employees, onSendReminder, reminderLoading }: EmployeeTableProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = employees.filter(emp => {
    if (filter === 'completed' && !emp.all_completed_at && !emp.email_sent_at) return false
    if (filter === 'incomplete' && (emp.all_completed_at || emp.email_sent_at)) return false
    if (search && !emp.name.includes(search) && !emp.department.includes(search)) return false
    return true
  })

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
    return emp && !emp.all_completed_at && !emp.email_sent_at
  })

  return (
    <div className="bg-white rounded-apple-xl border border-apple-gray-100 shadow-apple-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 border-b border-apple-gray-100">
        <div className="flex gap-1">
          {(['all', 'incomplete', 'completed'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm rounded-full transition-colors min-h-[36px] ${
                filter === f
                  ? 'bg-apple-blue text-white'
                  : 'text-apple-gray-600 hover:bg-apple-gray-100'
              }`}
            >
              {f === 'all' ? '전체' : f === 'incomplete' ? '미완료' : '완료'}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="이름 또는 부서 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-apple-gray-200 rounded-apple focus:outline-none focus:ring-2 focus:ring-apple-blue/30 flex-1 sm:max-w-[240px]"
        />
        {incompleteSelected.length > 0 && (
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
              <th className="px-4 py-3 font-medium">진행상태</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">이메일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-apple-gray-100">
            {filtered.map(emp => (
              <>
                <tr
                  key={emp.employee_id}
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
                    <StatusBadge completed={emp.completed_count} total={DOCUMENT_KEYS.length} />
                  </td>
                  <td className="px-4 py-3 text-apple-gray-500 text-xs hidden lg:table-cell">
                    {emp.email_sent_at || '-'}
                  </td>
                </tr>
                {expandedId === emp.employee_id && (
                  <tr key={`${emp.employee_id}-detail`}>
                    <td colSpan={6} className="px-4 py-3 bg-apple-gray-50">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {DOCUMENT_KEYS.map(key => {
                          const status = emp.documents[key]
                          const isDone = status !== 'pending'
                          return (
                            <div key={key} className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isDone ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <span className={isDone ? 'text-apple-gray-900' : 'text-apple-gray-400'}>
                                {DOCUMENT_LABELS[key]}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      {emp.all_completed_at && (
                        <p className="text-xs text-apple-gray-500 mt-2">
                          전체 완료: {emp.all_completed_at}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </>
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
