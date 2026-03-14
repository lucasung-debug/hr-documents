import { NextRequest, NextResponse } from 'next/server'
import { deleteSessionDir } from '@/lib/storage/temp-files'
import { cleanupExpiredSessions } from '@/lib/storage/scheduler'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[temp/cleanup]')

export async function DELETE(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    // Delete this session's files
    const deletedCount = deleteSessionDir(employeeId)

    // Also trigger a scan of expired sessions
    const expiredCount = cleanupExpiredSessions()

    return NextResponse.json({ deletedCount: deletedCount + expiredCount })
  } catch (err) {
    log.error({ err }, '임시 파일 삭제 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
