import Link from 'next/link'

export function AccessDenied() {
  return (
    <div className="min-h-screen bg-apple-gray-50 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white rounded-apple-xl shadow-apple-md border border-apple-gray-100 p-6 sm:p-8 text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
        </div>

        <h2 className="text-[24px] font-bold text-apple-gray-900 tracking-[-0.01em]">
          접근 권한이 없습니다
        </h2>
        <p className="mt-3 text-[15px] text-apple-gray-700">
          관리자 권한이 필요합니다
        </p>
        <p className="mt-2 text-sm text-apple-gray-500">
          이 접근 시도는 감사 이력에 기록됩니다.
        </p>

        <Link
          href="/onboarding/privacy-consent"
          className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-apple-blue px-5 py-2.5 text-base font-medium text-white transition-all duration-150 hover:bg-apple-blue-hover focus:outline-none focus:ring-2 focus:ring-apple-blue focus:ring-offset-2 active:scale-[0.98]"
        >
          본인 온보딩 화면으로 돌아가기
        </Link>
      </section>
    </div>
  )
}
