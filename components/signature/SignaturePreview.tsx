interface SignaturePreviewProps {
  dataUrl: string
  onReSign?: () => void
}

export function SignaturePreview({ dataUrl, onReSign }: SignaturePreviewProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="서명 미리보기"
          className="max-h-24 object-contain"
        />
      </div>
      {onReSign && (
        <button
          onClick={onReSign}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          다시 서명하기
        </button>
      )}
    </div>
  )
}
