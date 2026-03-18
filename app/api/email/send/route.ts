import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeById, updateSessionStatus } from '@/lib/sheets/employee'
import {
  findDocStatusByEmployeeId,
  setEmailSentinel,
  markEmailSent,
  updateDocumentStatus,
} from '@/lib/sheets/document-status'
import { sendOnboardingEmails } from '@/lib/email/client'
import { deleteSessionDir } from '@/lib/storage/temp-files'
import { generatePdfFromTemplate } from '@/lib/sheets/template'
import { getContractConditions } from '@/lib/sheets/contract'
import { buildBaseVariables, buildContractVariables } from '@/lib/sheets/template-variables'
import { embedSignatureInPdf } from '@/lib/pdf/embed-signature'
import { base64DataUrlToBuffer, sha256 } from '@/lib/crypto/hash'
import { DOCUMENT_KEYS } from '@/types/document'
import type { DocumentKey } from '@/types/document'
import { SESSION_STATUS } from '@/types/employee'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[email/send]')

export async function POST(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    // Parse optional signature from request body
    let signatureBase64: string | undefined
    try {
      const body = await request.json()
      signatureBase64 = body?.signatureBase64
    } catch {
      // Empty body is OK
    }

    // 1. Get employee info
    const empResult = await getEmployeeById(employeeId)
    if (!empResult) {
      return NextResponse.json({ error: '직원 정보를 찾을 수 없습니다.' }, { status: 404 })
    }
    const { employee } = empResult

    // 2. Check idempotency — prevent duplicate sends
    const statusResult = await findDocStatusByEmployeeId(employeeId)
    if (!statusResult) {
      return NextResponse.json({ error: '서류 현황 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { row, rowIndex } = statusResult

    if (row.email_sent_at && row.email_sent_at !== '' && row.email_sent_at !== 'sending') {
      return NextResponse.json(
        { error: '이미 발송된 서류입니다. 중복 발송은 허용되지 않습니다.' },
        { status: 409 }
      )
    }

    // 3. Write 'sending' sentinel to prevent race conditions
    await setEmailSentinel(rowIndex)

    // 4. Compute signature hash for audit trail
    let signHash = ''
    let sigBuffer: Buffer | null = null
    if (signatureBase64) {
      sigBuffer = base64DataUrlToBuffer(signatureBase64)
      signHash = sha256(sigBuffer)
    }

    // 5. Generate all PDFs on-demand (no /tmp dependency)
    const variables = buildBaseVariables(employee)
    const conditions = await getContractConditions(employeeId)
    if (conditions) {
      Object.assign(variables, buildContractVariables(conditions))
    }

    const attachments: { filename: string; content: Buffer; contentType: string }[] = []
    const PDF_FILENAME_SUFFIXES: Record<DocumentKey, string> = {
      labor_contract: '근로계약서',
      personal_info_consent: '개인정보동의서',
      holiday_extension: '연차유급휴가동의서',
      data_security_pledge: '보안서약서',
      compliance: '준법행동서약서',
      overtime_work: '연장근로동의서',
    }

    for (const key of DOCUMENT_KEYS) {
      const pdfBuffer = await generatePdfFromTemplate(key, variables, employee.pay_sec)

      let finalPdfBytes: Uint8Array | Buffer = pdfBuffer
      if (sigBuffer) {
        finalPdfBytes = await embedSignatureInPdf(pdfBuffer, sigBuffer, key, employee.pay_sec)
      }

      const suffix = PDF_FILENAME_SUFFIXES[key]
      const filename = `${employee.name}_${employee.employee_id}_${suffix}.pdf`
      attachments.push({
        filename,
        content: Buffer.from(finalPdfBytes),
        contentType: 'application/pdf',
      })
    }

    // 6. Send emails with generated attachments
    const { sentAt } = await sendOnboardingEmails(employee, attachments)

    // 7-9. Update all statuses, mark email sent, and update session in parallel
    await Promise.all([
      ...DOCUMENT_KEYS.map(key => updateDocumentStatus(rowIndex, key, 'sent')),
      markEmailSent(rowIndex, signHash),
      updateSessionStatus(empResult.rowIndex, SESSION_STATUS.COMPLETED),
    ])

    // 10. Delete temp files (fire and forget — don't block response)
    try {
      deleteSessionDir(employeeId)
    } catch (cleanupErr) {
      log.error({ err: cleanupErr }, `Failed to delete session dir for ${employeeId.slice(0, 8)}...`)
    }

    return NextResponse.json({ success: true, sentAt })
  } catch (err) {
    log.error({ err }, '이메일 발송 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
