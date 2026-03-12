import { NextRequest, NextResponse } from 'next/server'
import { DOCUMENT_KEYS } from '@/types/document'
import type { DocumentKey } from '@/types/document'
import {
  getDocumentStatuses,
  findDocStatusByEmployeeId,
  markAllCompleted,
} from '@/lib/sheets/document-status'
import type { CheckAllResponse } from '@/types/api'

export async function GET(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const statuses = await getDocumentStatuses(employeeId)

    const pending: DocumentKey[] = DOCUMENT_KEYS.filter(
      (key) => statuses[key] === 'pending'
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
    console.error('[docs/check-all] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: '서류 완료 여부 확인 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
