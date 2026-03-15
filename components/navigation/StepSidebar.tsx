'use client'

import { usePathname } from 'next/navigation'

const STEPS = [
  { label: '본인 확인', path: '/login', step: 1 },
  { label: '전자서명', path: '/onboarding/signature', step: 2 },
  { label: '서류 작성', path: '/onboarding/documents', step: 3 },
  { label: '최종 확인', path: '/onboarding/preview', step: 4 },
  { label: '사번 확인', path: '/onboarding/employee-id', step: 5 },
  { label: '완료', path: '/onboarding/complete', step: 6 },
]

function getCurrentStep(pathname: string): number {
  const match = [...STEPS].reverse().find((s) => pathname.startsWith(s.path))
  return match?.step ?? 1
}

export function StepSidebar() {
  const pathname = usePathname()
  const currentStep = getCurrentStep(pathname)

  return (
    <nav aria-label="온보딩 단계" className="flex flex-col h-full px-6 py-8">
      <div className="mb-10">
        <h1 className="text-[15px] font-semibold text-apple-gray-900 leading-tight">
          입사 서류<br />전자서명
        </h1>
      </div>

      <ol className="flex flex-col gap-1">
        {STEPS.map(({ label, step }) => {
          const isCompleted = step < currentStep
          const isActive = step === currentStep
          const isUpcoming = step > currentStep

          return (
            <li key={step}>
              <div
                aria-current={isActive ? 'step' : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-apple transition-colors
                  ${isActive ? 'bg-apple-blue-light' : ''}
                  ${isUpcoming ? 'opacity-40' : ''}
                `}
              >
                {/* 스텝 인디케이터 */}
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold transition-colors
                  ${isCompleted ? 'bg-apple-blue text-white' : ''}
                  ${isActive ? 'bg-apple-blue text-white' : ''}
                  ${isUpcoming ? 'bg-apple-gray-200 text-apple-gray-500' : ''}
                `}>
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>

                <span className={`
                  text-[14px] font-medium
                  ${isActive ? 'text-apple-blue' : ''}
                  ${isCompleted ? 'text-apple-gray-700' : ''}
                  ${isUpcoming ? 'text-apple-gray-500' : ''}
                `}>
                  {label}
                </span>
              </div>

              {/* 스텝 사이 연결선 */}
              {step < STEPS.length && (
                <div className={`
                  ml-[22px] w-px h-3 my-0.5
                  ${step < currentStep ? 'bg-apple-blue' : 'bg-apple-gray-200'}
                `} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
