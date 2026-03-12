import { NextRequest, NextResponse } from 'next/server'
import { generatePdfSchema } from '@/lib/validators/input'
import { generatePreviewImage, previewToBase64 } from '@/lib/pdf/puppeteer'
import { pdfExists } from '@/lib/storage/temp-files'

export async function POST(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = generatePdfSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { documentKey } = parsed.data

    if (!pdfExists(employeeId, documentKey)) {
      return NextResponse.json(
        { error: '서명된 PDF가 없습니다. 먼저 동의를 완료해주세요.' },
        { status: 404 }
      )
    }

    const previewPath = await generatePreviewImage(employeeId, documentKey)
    const previewUrl = await previewToBase64(previewPath)

    return NextResponse.json({ success: true, previewUrl })
  } catch (err) {
    console.error('[docs/generate-pdf] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'PDF 미리보기 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
