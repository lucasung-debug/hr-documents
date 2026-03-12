import { ProgressBar } from '@/components/ui/ProgressBar'

const STEPS = ['로그인', '서명', '서류작성', '미리보기', '완료']

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto">
          <h1 className="text-base font-semibold text-gray-900 mb-3">입사 서류 전자서명</h1>
          <ProgressBar currentStep={2} totalSteps={5} stepLabels={STEPS} />
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="max-w-lg mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
