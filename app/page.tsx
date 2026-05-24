import Link from 'next/link'

export default function Home() {
  const features = [
    {
      title: '전자서명',
      description: '신입 구성원이 모바일에서 입사 서류 서명을 바로 완료합니다.',
    },
    {
      title: '서명 박힌 PDF 자동 생성',
      description: '동일 서명을 필요한 서류에 반영해 확인 가능한 PDF로 정리합니다.',
    },
    {
      title: 'HR 운영 대시보드',
      description: '진행 상태, 누락 서류, 발송 결과를 한 화면에서 확인합니다.',
    },
  ]

  const badges = ['PII 무유출', '121 테스트', '프로덕션급']

  return (
    <main className="min-h-screen bg-apple-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center gap-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="text-[15px] font-semibold text-apple-blue">HR Onboarding Hub</p>
            <h1 className="mt-4 max-w-3xl text-[40px] font-bold leading-[1.12] tracking-[-0.03em] text-apple-gray-900 sm:text-[56px]">
              출근 첫날, 서류는 아직도 종이로?
            </h1>
            <p className="mt-5 max-w-2xl text-[18px] leading-8 text-apple-gray-700 sm:text-[20px]">
              입사 서류 작성부터 서명된 PDF 생성, HR 운영 현황까지 5분 안에 이어지는 온보딩 데모입니다.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-apple-blue px-6 py-3 text-base font-medium text-white transition-all duration-150 hover:bg-apple-blue-hover focus:outline-none focus:ring-2 focus:ring-apple-blue focus:ring-offset-2 active:scale-[0.98]"
              >
                신입 데모 체험
              </Link>
              <Link
                href="/admin/dashboard?demo=1"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-6 py-3 text-base font-medium text-apple-gray-900 shadow-apple-sm ring-1 ring-apple-gray-100 transition-all duration-150 hover:bg-apple-gray-100 focus:outline-none focus:ring-2 focus:ring-apple-blue focus:ring-offset-2 active:scale-[0.98]"
              >
                관리자 데모 보기
              </Link>
            </div>
          </div>

          <div className="rounded-apple-xl border border-apple-gray-100 bg-white p-5 shadow-apple-md sm:p-6">
            <div className="rounded-apple-lg bg-apple-gray-50 p-4">
              <div className="flex items-center justify-between border-b border-apple-gray-100 pb-3">
                <div>
                  <p className="text-sm font-semibold text-apple-gray-900">온보딩 진행률</p>
                  <p className="mt-1 text-xs text-apple-gray-500">신입 입사 서류 7종</p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  86%
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {['개인정보 동의', '전자서명 완료', 'PDF 생성 대기'].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-apple bg-white px-4 py-3">
                    <span className="text-sm font-medium text-apple-gray-900">{item}</span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        index < 2 ? 'bg-green-500' : 'bg-yellow-400'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-apple-lg border border-apple-gray-100 bg-white p-5 shadow-apple-sm"
            >
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-apple-gray-900">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-apple-gray-500">{feature.description}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-apple-blue/20 bg-apple-blue-light px-4 py-2 text-sm font-semibold text-apple-blue"
            >
              {badge}
            </span>
          ))}
        </div>
      </section>
    </main>
  )
}
