import { NextRequest, NextResponse } from 'next/server'
import { docConsentSchema } from '@/lib/validators/input'
import { readSignature } from '@/lib/storage/temp-files'
import { generateSignedPdf } from '@/lib/pdf/generator'
import { generatePreviewImage, previewToBase64 } from '@/lib/pdf/puppeteer'
import {
  findDocStatusByEmployeeId,
  updateDocumentStatus,
} from '@/lib/sheets/document-status'
import { DOC_STATUS } from '@/types/document'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[docs/consent]')

export async function POST(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = docConsentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { documentKey } = parsed.data

    // Read signature from temp storage
    const signatureBuffer = readSignature(employeeId)

    // Generate signed PDF
    const result = await generateSignedPdf(employeeId, documentKey, signatureBuffer)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'PDF 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // Generate preview image
    let previewUrl: string | undefined
    try {
      const previewPath = await generatePreviewImage(employeeId, documentKey)
      previewUrl = await previewToBase64(previewPath)
    } catch (previewErr) {
      // Preview generation failure is non-fatal
      log.error({ err: previewErr }, `Preview generation failed for ${documentKey}`)
    }

    // Update Google Sheets status
    const statusResult = await findDocStatusByEmployeeId(employeeId)
    if (statusResult) {
      await updateDocumentStatus(statusResult.rowIndex, documentKey, DOC_STATUS.SIGNED)
    }

    return NextResponse.json({
      success: true,
      status: DOC_STATUS.SIGNED,
      previewUrl,
    })
  } catch (err) {
    log.error({ err }, '서류 동의 처리 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
