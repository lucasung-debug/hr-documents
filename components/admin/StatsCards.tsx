import type { DashboardStats } from '@/types/admin'

interface StatsCardsProps {
  stats: DashboardStats
}

const cards = [
  { key: 'total', label: '전체', color: 'bg-blue-50 text-blue-700' },
  { key: 'completed', label: '완료', color: 'bg-green-50 text-green-700' },
  { key: 'in_progress', label: '진행중', color: 'bg-yellow-50 text-yellow-700' },
  { key: 'pending', label: '대기', color: 'bg-gray-50 text-gray-700' },
  { key: 'action_required', label: '조치 필요', color: 'bg-red-50 text-red-700' },
  { key: 'sync_failed', label: '동기화 실패', color: 'bg-orange-50 text-orange-700' },
  { key: 'archive_pending', label: '보관 대기', color: 'bg-purple-50 text-purple-700' },
] as const

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
      {cards.map(({ key, label, color }) => (
        <div key={key} className={`rounded-apple-lg p-3 sm:p-4 ${color}`}>
          <p className="text-xs sm:text-sm font-medium opacity-70">{label}</p>
          <p className="text-xl sm:text-2xl font-bold mt-1">{stats[key]}</p>
        </div>
      ))}
      <div className="rounded-apple-lg p-3 sm:p-4 bg-indigo-50 text-indigo-700">
        <p className="text-xs sm:text-sm font-medium opacity-70">완료율</p>
        <p className="text-xl sm:text-2xl font-bold mt-1">{stats.completion_rate}%</p>
      </div>
    </div>
  )
}
