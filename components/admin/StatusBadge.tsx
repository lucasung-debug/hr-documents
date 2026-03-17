interface StatusBadgeProps {
  completed: number
  total: number
}

export function StatusBadge({ completed, total }: StatusBadgeProps) {
  const isComplete = completed === total
  const ratio = total > 0 ? completed / total : 0

  let bgColor = 'bg-gray-100 text-gray-600'
  if (isComplete) bgColor = 'bg-green-100 text-green-700'
  else if (ratio > 0) bgColor = 'bg-yellow-100 text-yellow-700'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor}`}>
      {completed}/{total}{isComplete ? ' \u2713' : ''}
    </span>
  )
}
