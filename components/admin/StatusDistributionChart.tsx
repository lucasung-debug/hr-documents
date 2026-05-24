import type { DashboardEmployee } from '@/types/admin'

interface StatusDistributionChartProps {
  employees: DashboardEmployee[]
}

type StatusKey = 'completed' | 'in_progress' | 'action_required' | 'sync_failed' | 'archive_pending'

const statuses: {
  key: StatusKey
  label: string
  color: string
  textColor: string
}[] = [
  { key: 'completed', label: '완료', color: 'bg-green-500', textColor: 'text-green-700' },
  { key: 'in_progress', label: '진행중', color: 'bg-yellow-400', textColor: 'text-yellow-700' },
  { key: 'action_required', label: '조치 필요', color: 'bg-red-500', textColor: 'text-red-700' },
  { key: 'sync_failed', label: '동기화 실패', color: 'bg-orange-500', textColor: 'text-orange-700' },
  { key: 'archive_pending', label: '보관 대기', color: 'bg-purple-500', textColor: 'text-purple-700' },
]

function getStatus(employee: DashboardEmployee): StatusKey {
  if (employee.workspace_sync_status === 'failed') return 'sync_failed'
  if (employee.case_status === 'action_required') return 'action_required'
  if (employee.case_status === 'docs_completed' && employee.pdf_packet_status === 'generated' && !employee.drive_archived_at) {
    return 'archive_pending'
  }
  if (employee.case_status === 'archived' || employee.all_completed_at || employee.email_sent_at) return 'completed'
  return 'in_progress'
}

export function StatusDistributionChart({ employees }: StatusDistributionChartProps) {
  const total = employees.length
  const counts = employees.reduce<Record<StatusKey, number>>(
    (acc, employee) => {
      acc[getStatus(employee)] += 1
      return acc
    },
    {
      completed: 0,
      in_progress: 0,
      action_required: 0,
      sync_failed: 0,
      archive_pending: 0,
    }
  )
  const completedRate = total > 0 ? Math.round((counts.completed / total) * 1000) / 10 : 0

  return (
    <section
      id="progress_chart"
      aria-labelledby="progress-chart-title"
      className="bg-white rounded-apple-xl border border-apple-gray-100 shadow-apple-sm p-4 sm:p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 mb-4">
        <div>
          <h3 id="progress-chart-title" className="text-base font-semibold text-apple-gray-900">
            진행률·상태 분포
          </h3>
          <p className="text-xs sm:text-sm text-apple-gray-500 mt-1">온보딩 케이스 {total}건 기준</p>
        </div>
        <p className="text-sm font-medium text-apple-gray-700">완료율 {completedRate}%</p>
      </div>

      <div
        className="flex h-4 overflow-hidden rounded-full bg-apple-gray-100"
        role="img"
        aria-label={`완료 ${counts.completed}건, 진행중 ${counts.in_progress}건, 조치 필요 ${counts.action_required}건, 동기화 실패 ${counts.sync_failed}건, 보관 대기 ${counts.archive_pending}건`}
      >
        {statuses.map(({ key, color, label }) => {
          const percentage = total > 0 ? (counts[key] / total) * 100 : 0
          if (percentage === 0) return null

          return (
            <div
              key={key}
              className={`${color} min-w-[3px]`}
              style={{ width: `${percentage}%` }}
              title={`${label} ${counts[key]}건`}
            />
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
        {statuses.map(({ key, label, color, textColor }) => {
          const percentage = total > 0 ? Math.round((counts[key] / total) * 1000) / 10 : 0

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${color}`} />
                  <span className="text-xs font-medium text-apple-gray-700 truncate">{label}</span>
                </div>
                <span className={`text-xs font-semibold ${textColor}`}>{counts[key]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-apple-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
              </div>
              <p className="text-[11px] text-apple-gray-500">{percentage}%</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
