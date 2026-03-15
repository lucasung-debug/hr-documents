import { StepSidebar } from '@/components/navigation/StepSidebar'
import { MobileProgressHeader } from '@/components/navigation/MobileProgressHeader'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-apple-gray-50 flex">
      {/* 데스크탑 사이드바: lg 이상에서만 표시 */}
      <aside className="hidden lg:flex lg:w-72 flex-col bg-white border-r border-apple-gray-100 sticky top-0 h-screen shadow-apple-sm">
        <StepSidebar />
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 상단 ProgressBar: lg 미만에서만 표시, pathname 기반 동적 스텝 */}
        <MobileProgressHeader />

        <main className="flex-1 px-4 py-8 lg:px-12 lg:py-12 max-w-2xl xl:max-w-3xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
