'use client'

interface DemoDocumentPreviewProps {
  docLabel: string
  signatureBase64?: string | null
  className?: string
}

/**
 * Demo-only document preview. Renders a stylized signed-document card with
 * dummy data — intentionally NOT a real company form (forms can be confidential).
 * Pure HTML/CSS so it always renders, including in headless recording browsers.
 */
export function DemoDocumentPreview({ docLabel, signatureBase64, className }: DemoDocumentPreviewProps) {
  return (
    <div className={className}>
      <div
        data-testid="demo-document"
        className="mx-auto w-full max-w-2xl rounded-apple-lg border border-apple-gray-200 bg-white p-8 text-left text-apple-gray-800 shadow-inner sm:p-10"
      >
        <h4 className="text-center text-[20px] font-bold tracking-[-0.01em] text-apple-gray-900">
          {docLabel}
        </h4>
        <p className="mt-1 text-center text-xs text-apple-gray-400">
          데모 시연용 샘플 · 실제 회사 양식이 아닙니다
        </p>

        <div className="mt-7 space-y-2.5 text-[14px] leading-7">
          <p><span className="inline-block w-24 text-apple-gray-500">성명</span>홍길동</p>
          <p><span className="inline-block w-24 text-apple-gray-500">입사일</span>2026-01-15</p>
          <p><span className="inline-block w-24 text-apple-gray-500">부서</span>개발팀</p>
          <p className="mt-4 border-t border-apple-gray-100 pt-4 text-apple-gray-500">
            본 문서는 더미 데이터로 작성된 데모 미리보기입니다. 모든 항목은 가상입니다.
          </p>
        </div>

        <div className="mt-10 flex items-end justify-between border-t border-apple-gray-200 pt-5">
          <span className="text-xs text-apple-gray-500">서명일: 2026-01-15</span>
          <div className="flex items-center gap-2 text-right">
            <span className="text-xs text-apple-gray-500">서명</span>
            {signatureBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signatureBase64} alt="전자서명" className="inline-block h-12 align-middle" />
            ) : (
              <span className="font-semibold text-apple-gray-900">홍길동 (인)</span>
            )}
            <span className="text-sm font-medium text-green-600">✓ 서명 완료</span>
          </div>
        </div>
      </div>
    </div>
  )
}
