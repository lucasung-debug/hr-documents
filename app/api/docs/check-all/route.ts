import { NextRequest, NextResponse } from 'next/server'
import { DOCUMENT_KEYS, DOC_STATUS } from '@/types/document'
import type { DocumentKey } from '@/types/document'
import {
  getDocumentStatuses,
  findDocStatusByEmployeeId,
  markAllCompleted,
} from '@/lib/sheets/document-status'
import type { CheckAllResponse } from '@/types/api'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[docs/check-all]')

export async function GET(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const statuses = await getDocumentStatuses(employeeId)

    const pending: DocumentKey[] = DOCUMENT_KEYS.filter(
      (key) => statuses[key] === DOC_STATUS.PENDING
    )
    const allCompleted = pending.length === 0

    if (allCompleted) {
      const statusResult = await findDocStatusByEmployeeId(employeeId)
      if (statusResult && !statusResult.row.all_completed_at) {
        await markAllCompleted(statusResult.rowIndex)
      }
    }

    const response: CheckAllResponse = {
      allCompleted,
      statuses,
      pending,
    }

    return NextResponse.json(response)
  } catch (err) {
    log.error({ err }, '서류 완료 여부 확인 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
