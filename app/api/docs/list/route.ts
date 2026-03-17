import { NextRequest, NextResponse } from 'next/server'
import { DOCUMENT_KEYS, DOCUMENT_LABELS, SIGNATURE_REQUIRED } from '@/types/document'
import { getDocumentStatuses } from '@/lib/sheets/document-status'
import { withCacheHeaders } from '@/lib/api/cache-headers'
import type { DocListItem } from '@/types/api'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[docs/list]')

export async function GET(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const statuses = await getDocumentStatuses(employeeId)

    const docs: DocListItem[] = DOCUMENT_KEYS.map((key) => ({
      key,
      label: DOCUMENT_LABELS[key],
      status: statuses[key],
      signatureRequired: SIGNATURE_REQUIRED[key],
    }))

    return withCacheHeaders(NextResponse.json({ docs }), 60) // 1min
  } catch (err) {
    log.error({ err }, '서류 목록 조회 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
