import { NextRequest, NextResponse } from 'next/server'
import { DOCUMENT_KEYS } from '@/types/document'
import type { DocumentKey } from '@/types/document'
import { getEmployeeById } from '@/lib/sheets/employee'
import { generatePdfFromTemplate } from '@/lib/sheets/template'
import { getContractConditions } from '@/lib/sheets/contract'
import { buildBaseVariables, buildContractVariables } from '@/lib/sheets/template-variables'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[docs/preview]')

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

    // For labor_contract, add individual contract conditions
    if (documentKey === 'labor_contract') {
      const conditions = await getContractConditions(employeeId)
      if (conditions) {
        Object.assign(variables, buildContractVariables(conditions))
      }
    }

    // Generate PDF from Sheets template (pay_sec selects monthly/daily)
    const pdfBuffer = await generatePdfFromTemplate(
      documentKey,
      variables,
      employee.pay_sec
    )
    const pdfBase64 = pdfBuffer.toString('base64')

    return NextResponse.json({
      success: true,
      pdfBase64,
    })
  } catch (err) {
    log.error({ err }, `서류 미리보기 생성 중 오류: ${documentKey}`)
    return apiFromUnknown(err)
  }
}
