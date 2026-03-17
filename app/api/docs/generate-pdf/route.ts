import { NextRequest, NextResponse } from 'next/server'
import { generatePdfSchema } from '@/lib/validators/input'
import { generatePreviewWithFallback } from '@/lib/pdf/puppeteer'
import { pdfExists } from '@/lib/storage/temp-files'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[docs/generate-pdf]')

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
        { error: `서명된 PDF가 없습니다 (${documentKey}). 먼저 동의를 완료해주세요.` },
        { status: 404 }
      )
    }

    let result: { dataUrl: string; type: 'png' | 'pdf' }
    try {
      result = await generatePreviewWithFallback(employeeId, documentKey)
    } catch (previewErr) {
      log.error({ err: previewErr, documentKey }, 'PDF 미리보기 파일 읽기 실패')
      return NextResponse.json(
        { error: 'PDF 파일을 읽을 수 없습니다. 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      previewUrl: result.dataUrl,
      previewType: result.type,
    })
  } catch (err) {
    log.error({ err }, 'PDF 미리보기 생성 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
