'use client'

import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui/Button'

interface SignaturePadProps {
  onCapture: (dataUrl: string) => void
  disabled?: boolean
}

export function SignaturePad({ onCapture, disabled = false }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  const handleClear = () => {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  const handleEnd = () => {
    setIsEmpty(padRef.current?.isEmpty() ?? true)
  }

  const handleConfirm = () => {
    if (!padRef.current || padRef.current.isEmpty()) return
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL('image/png')
    onCapture(dataUrl)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white touch-none">
        <SignatureCanvas
          ref={padRef}
          onEnd={handleEnd}
          penColor="#1a1a1a"
          canvasProps={{
            className: 'w-full',
            style: { width: '100%', height: '200px', touchAction: 'none' },
          }}
        />
      </div>
      <p className="text-xs text-gray-500 text-center">위 박스 안에 서명해주세요</p>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={handleClear}
          disabled={disabled || isEmpty}
          className="flex-1"
        >
          다시 서명
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={disabled || isEmpty}
          className="flex-1"
        >
          서명 완료
        </Button>
      </div>
    </div>
  )
}
