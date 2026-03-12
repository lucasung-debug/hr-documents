interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  stepLabels?: string[]
}

export function ProgressBar({ currentStep, totalSteps, stepLabels }: ProgressBarProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100)

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        {stepLabels ? (
          stepLabels.map((label, i) => (
            <span
              key={i}
              className={i + 1 <= currentStep ? 'text-blue-600 font-medium' : ''}
            >
              {label}
            </span>
          ))
        ) : (
          <>
            <span>시작</span>
            <span className="text-blue-600 font-medium">{percentage}%</span>
            <span>완료</span>
          </>
        )}
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
