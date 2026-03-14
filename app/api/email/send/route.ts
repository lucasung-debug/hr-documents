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
import { DOCUMENT_KEYS } from '@/types/document'
import { SESSION_STATUS } from '@/types/employee'
import { sha256 } from '@/lib/crypto/hash'
import { readSignature } from '@/lib/storage/temp-files'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[email/send]')

export async function POST(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
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

    if (row.email_sent_at && row.email_sent_at !== '') {
      return NextResponse.json(
        { error: '이미 발송된 서류입니다. 중복 발송은 허용되지 않습니다.' },
        { status: 409 }
      )
    }

    // 3. Write 'sending' sentinel to prevent race conditions
    await setEmailSentinel(rowIndex)

    // 4. Compute signature hash for audit trail
    let signHash = ''
    try {
      const sigBuffer = readSignature(employeeId)
      signHash = sha256(sigBuffer)
    } catch {
      // Non-fatal: signature file may already be gone
    }

    // 5. Send emails
    const { sentAt } = await sendOnboardingEmails(employee, [...DOCUMENT_KEYS])

    // 6. Update all document statuses to 'sent' in Sheets
    for (const key of DOCUMENT_KEYS) {
      await updateDocumentStatus(rowIndex, key, 'sent')
    }

    // 7. Mark email sent with timestamp and signature hash
    await markEmailSent(rowIndex, signHash)

    // 8. Update employee session status to COMPLETED
    await updateSessionStatus(empResult.rowIndex, SESSION_STATUS.COMPLETED)

    // 9. Delete temp files (fire and forget — don't block response)
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
