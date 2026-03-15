interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  stepLabels?: string[]
}

export function ProgressBar({ currentStep, totalSteps, stepLabels }: ProgressBarProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100)

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-apple-gray-500 mb-1">
        {stepLabels ? (
          stepLabels.map((label, i) => (
            <span
              key={i}
              className={i + 1 <= currentStep ? 'text-apple-blue font-medium' : ''}
            >
              {label}
            </span>
          ))
        ) : (
          <>
            <span>시작</span>
            <span className="text-apple-blue font-medium">{percentage}%</span>
            <span>완료</span>
          </>
        )}
      </div>
      <div className="h-1.5 bg-apple-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-apple-blue rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
