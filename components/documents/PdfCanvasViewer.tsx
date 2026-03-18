'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface PdfCanvasViewerProps {
  pdfBase64: string
  className?: string
}

/**
 * Canvas-based PDF viewer using pdfjs-dist.
 * Renders all pages as stacked canvases for mobile compatibility
 * (no reliance on native browser PDF plugins).
 */
export function PdfCanvasViewer({ pdfBase64, className }: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const renderPdf = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    try {
      const pdfjsLib = await import('pdfjs-dist')

      // Configure worker (local file — CDN may not have this exact version)
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      }

      // Decode base64 to binary
      const binaryStr = atob(pdfBase64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      setPageCount(pdf.numPages)

      // Clear previous renders
      container.innerHTML = ''

      // Determine render scale based on container width
      const containerWidth = container.clientWidth
      const devicePixelRatio = window.devicePixelRatio || 1

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const unscaledViewport = page.getViewport({ scale: 1 })

        // Scale to fit container width
        const scale = containerWidth / unscaledViewport.width
        const viewport = page.getViewport({ scale: scale * devicePixelRatio })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${containerWidth}px`
        canvas.style.height = `${(viewport.height / viewport.width) * containerWidth}px`
        canvas.style.display = 'block'

        if (pageNum > 1) {
          canvas.style.marginTop = '4px'
        }

        const context = canvas.getContext('2d')
        if (!context) continue

        await page.render({ canvasContext: context, viewport, canvas } as Parameters<typeof page.render>[0]).promise
        container.appendChild(canvas)
      }

      setLoading(false)
    } catch (err) {
      setError('PDF를 렌더링할 수 없습니다.')
      setLoading(false)
      console.error('PDF render error:', err)
    }
  }, [pdfBase64])

  useEffect(() => {
    setLoading(true)
    setError(null)
    renderPdf()
  }, [renderPdf])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-apple-gray-500">
        <p className="text-sm">{error}</p>
        <a
          href={`data:application/pdf;base64,${pdfBase64}`}
          download="document.pdf"
          className="text-sm text-apple-blue underline"
        >
          PDF 다운로드
        </a>
      </div>
    )
  }

  return (
    <div className={className}>
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue" />
            <p className="text-sm text-apple-gray-500">PDF 렌더링 중...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      />
      {!loading && pageCount > 0 && (
        <p className="text-xs text-apple-gray-400 text-center mt-2">
          {pageCount}페이지
        </p>
      )}
    </div>
  )
}
