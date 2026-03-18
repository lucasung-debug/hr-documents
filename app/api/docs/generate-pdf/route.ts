import { NextRequest, NextResponse } from 'next/server'
import { generatePdfSchema } from '@/lib/validators/input'
import { generatePdfFromTemplate } from '@/lib/sheets/template'
import { getContractConditions } from '@/lib/sheets/contract'
import { buildBaseVariables, buildContractVariables } from '@/lib/sheets/template-variables'
import { getEmployeeById } from '@/lib/sheets/employee'
import { embedSignatureInPdf } from '@/lib/pdf/embed-signature'
import { base64DataUrlToBuffer } from '@/lib/crypto/hash'
import { cache } from '@/lib/cache/memory-cache'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[docs/generate-pdf]')

const SIGNED_PDF_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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

    const { documentKey, signatureBase64 } = parsed.data

    // Check cache first
    const cacheKey = `signedPdf:${employeeId}:${documentKey}`
    const cachedDataUrl = cache.get<string>(cacheKey)
    if (cachedDataUrl) {
      return NextResponse.json({
        success: true,
        previewUrl: cachedDataUrl,
        previewType: 'pdf',
      })
    }

    // Get employee info and contract conditions
    const empResult = await getEmployeeById(employeeId)
    if (!empResult) {
      return NextResponse.json({ error: '직원 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { employee } = empResult
    const variables = buildBaseVariables(employee)

    if (documentKey === 'labor_contract') {
      const conditions = await getContractConditions(employeeId)
      if (conditions) {
        Object.assign(variables, buildContractVariables(conditions))
      }
    }

    // Generate PDF from template
    const pdfBuffer = await generatePdfFromTemplate(
      documentKey,
      variables,
      employee.pay_sec
    )

    // Embed signature if provided
    let finalPdfBytes: Uint8Array | Buffer = pdfBuffer
    if (signatureBase64) {
      const sigBuffer = base64DataUrlToBuffer(signatureBase64)
      finalPdfBytes = await embedSignatureInPdf(pdfBuffer, sigBuffer, documentKey, employee.pay_sec)
    }

    const dataUrl = `data:application/pdf;base64,${Buffer.from(finalPdfBytes).toString('base64')}`

    // Cache the result
    cache.set(cacheKey, dataUrl, SIGNED_PDF_CACHE_TTL)

    return NextResponse.json({
      success: true,
      previewUrl: dataUrl,
      previewType: 'pdf',
    })
  } catch (err) {
    log.error({ err }, 'PDF 미리보기 생성 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
