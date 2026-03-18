import { NextRequest, NextResponse } from 'next/server'
import { DOCUMENT_KEYS } from '@/types/document'
import type { DocumentKey } from '@/types/document'
import { getEmployeeById } from '@/lib/sheets/employee'
import { generatePdf } from '@/lib/pdf/generate-pdf'
import { getContractConditions } from '@/lib/sheets/contract'
import { buildBaseVariables, buildContractVariables } from '@/lib/sheets/template-variables'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'
import { cache } from '@/lib/cache/memory-cache'

const log = createLogger('[docs/preview]')

/** Server-side PDF cache TTL: 5 minutes */
const PDF_CACHE_TTL_MS = 5 * 60 * 1000

function isValidDocumentKey(key: string): key is DocumentKey {
  return (DOCUMENT_KEYS as readonly string[]).includes(key)
}

/**
 * GET /api/docs/preview?documentKey=xxx
 * Returns a pre-signature PDF preview (base64) generated from Sheets template.
 */
export async function GET(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  const documentKey = request.nextUrl.searchParams.get('documentKey')
  if (!documentKey || !isValidDocumentKey(documentKey)) {
    return NextResponse.json(
      { error: '유효하지 않은 서류 키입니다.' },
      { status: 400 }
    )
  }

  try {
    // Get employee info for template variables
    const empResult = await getEmployeeById(employeeId)
    if (!empResult) {
      return NextResponse.json(
        { error: '직원 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { employee } = empResult
    const variables = buildBaseVariables(employee)
    // signature stays empty for preview

    // For labor_contract, add contract conditions
    if (documentKey === 'labor_contract') {
      const conditions = await getContractConditions(employeeId)
      if (conditions) {
        Object.assign(variables, buildContractVariables(conditions))
      }
    }

    // Check server-side PDF cache first to avoid redundant Google API calls
    const cacheKey = `pdf:${employeeId}:${documentKey}`
    const cachedBase64 = cache.get<string>(cacheKey)
    if (cachedBase64) {
      log.info(`PDF cache hit: ${documentKey}`)
      return NextResponse.json({ success: true, pdfBase64: cachedBase64 })
    }

    // Generate PDF from Sheets template (pay_sec selects monthly/daily)
    // Retry once on transient Sheets API failures
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generatePdf(
        documentKey,
        variables,
        employee.pay_sec
      )
    } catch (firstErr) {
      log.warn({ err: firstErr }, `미리보기 첫 시도 실패, 재시도 중: ${documentKey}`)
      pdfBuffer = await generatePdf(
        documentKey,
        variables,
        employee.pay_sec
      )
    }

    const pdfBase64 = pdfBuffer.toString('base64')

    // Cache the generated PDF to reduce Google API calls
    cache.set(cacheKey, pdfBase64, PDF_CACHE_TTL_MS)

    return NextResponse.json({
      success: true,
      pdfBase64,
    })
  } catch (err) {
    const errStatus = (err as { status?: number })?.status
    const errMsg = String((err as { message?: string })?.message ?? '')
    if (errStatus === 429 || errMsg.includes('429')) {
      log.warn({ err }, `Google API 429 rate limit: ${documentKey}`)
      return NextResponse.json(
        { error: 'Google API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }
    log.error({ err }, `서류 미리보기 생성 중 오류: ${documentKey}`)
    return apiFromUnknown(err)
  }
}
