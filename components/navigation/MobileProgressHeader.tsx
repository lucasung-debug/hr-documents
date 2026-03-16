'use client'

import { usePathname } from 'next/navigation'
import { ProgressBar } from '@/components/ui/ProgressBar'

const STEPS = ['로그인', '개인정보동의', '서명', '서류작성', '최종확인', '사번확인', '완료']

const STEP_MAP: Record<string, number> = {
  '/onboarding/privacy-consent': 2,
  '/onboarding/signature': 3,
  '/onboarding/documents': 4,
  '/onboarding/preview': 5,
  '/onboarding/employee-id': 6,
  '/onboarding/complete': 7,
}

function getCurrentStep(pathname: string): number {
  for (const [prefix, step] of Object.entries(STEP_MAP)) {
    if (pathname.startsWith(prefix)) return step
  }
  return 1
}

export function MobileProgressHeader() {
  const pathname = usePathname()
  const currentStep = getCurrentStep(pathname)

  return (
    <header className="lg:hidden bg-white border-b border-apple-gray-100 px-4 py-4 sticky top-0 z-10">
      <div className="max-w-lg mx-auto">
        <h1 className="text-[15px] font-semibold text-apple-gray-900 mb-3">입사 서류 전자서명</h1>
        <ProgressBar currentStep={currentStep} totalSteps={7} stepLabels={STEPS} />
      </div>
    </header>
  )
}
