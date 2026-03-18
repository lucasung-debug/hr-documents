import { NextRequest, NextResponse } from 'next/server'
import { docConsentSchema } from '@/lib/validators/input'
import { readSignature } from '@/lib/storage/temp-files'
import { generatePdfFromTemplate } from '@/lib/sheets/template'
import { getContractConditions } from '@/lib/sheets/contract'
import { buildBaseVariables, buildContractVariables } from '@/lib/sheets/template-variables'
import { getEmployeeById } from '@/lib/sheets/employee'
import {
  findDocStatusByEmployeeId,
  updateDocumentStatus,
} from '@/lib/sheets/document-status'
import { DOC_STATUS } from '@/types/document'
import { base64DataUrlToBuffer } from '@/lib/crypto/hash'
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

    const { documentKey, signatureBase64 } = parsed.data

    // Resolve signature: prefer request body, fallback to /tmp file
    const isPersonalInfoConsent = documentKey === 'personal_info_consent'
    let signatureBuffer: Buffer | null = null

    if (signatureBase64) {
      signatureBuffer = base64DataUrlToBuffer(signatureBase64)
    } else if (!isPersonalInfoConsent) {
      try {
        signatureBuffer = readSignature(employeeId)
      } catch {
        return NextResponse.json(
          { error: '서명이 필요합니다. 먼저 서명을 완료해주세요.' },
          { status: 400 }
        )
      }
    } else {
      try {
        signatureBuffer = readSignature(employeeId)
      } catch {
        signatureBuffer = null
      }
    }

    // Generate PDF from template and embed signature (no /tmp write needed)
    let pdfError: string | null = null

    // Parallel fetch: employee info + contract conditions (if labor_contract)
    const [empResult, conditions] = await Promise.all([
      getEmployeeById(employeeId),
      documentKey === 'labor_contract'
        ? getContractConditions(employeeId)
        : Promise.resolve(null),
    ])

    if (!empResult) {
      return NextResponse.json(
        { error: '직원 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { employee } = empResult
    const variables = buildBaseVariables(employee)

    if (documentKey === 'labor_contract' && conditions) {
      Object.assign(variables, buildContractVariables(conditions))
    }

    try {
      await generatePdfFromTemplate(
        documentKey,
        variables,
        employee.pay_sec
      )
      // PDF generation succeeded — no need to save to /tmp, just validate it works
    } catch (pdfErr) {
      log.error({ err: pdfErr, documentKey }, 'PDF 생성 실패 — 상태는 서명완료로 전환합니다.')
      pdfError = String((pdfErr as { message?: string })?.message ?? pdfErr)
    }

    // Update Google Sheets status — always attempt even if PDF generation failed
    const statusResult = await findDocStatusByEmployeeId(employeeId)
    if (statusResult) {
      await updateDocumentStatus(statusResult.rowIndex, documentKey, DOC_STATUS.SIGNED)
    }

    return NextResponse.json({
      success: true,
      status: DOC_STATUS.SIGNED,
      ...(pdfError ? { pdfWarning: 'PDF 생성 중 오류가 발생했으나 서명은 완료되었습니다.' } : {}),
    })
  } catch (err) {
    log.error({ err }, '서류 동의 처리 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
