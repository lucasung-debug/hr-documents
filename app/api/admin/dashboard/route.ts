import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from '@/lib/sheets/client'
import { DOCUMENT_KEYS, DOC_STATUS } from '@/types/document'
import type { DocumentKey, DocumentStatus } from '@/types/document'
import type { SessionStatus } from '@/types/employee'
import type { DashboardEmployee, DashboardStats, DashboardResponse } from '@/types/admin'
import { apiOk, apiFromUnknown } from '@/lib/api'
import { createLogger } from '@/lib/logger'

const log = createLogger('[admin/dashboard]')

/**
 * GET /api/admin/dashboard
 * Returns all employees with their onboarding status and aggregate stats.
 */
export async function GET(request: NextRequest) {
  const blocked = requireAdmin(request.headers)
  if (blocked) return blocked

  try {
    const sheets = getSheetsClient()

    // Parallel fetch: employee master + document status
    const [empResponse, docResponse] = await Promise.all([
      withRetry(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID(),
          range: `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:M`,
        })
      ),
      withRetry(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID(),
          range: `${SHEET_NAMES.DOCUMENT_STATUS}!A2:L`,
        })
      ),
    ])

    const empRows = empResponse.data.values ?? []
    const docRows = docResponse.data.values ?? []

    // Build document status lookup by employee_id
    const docStatusMap = new Map<string, string[]>()
    for (const row of docRows) {
      const r = row as string[]
      if (r[0]) docStatusMap.set(r[0], r)
    }

    const employees: DashboardEmployee[] = []
    let completed = 0
    let inProgress = 0
    let pending = 0

    for (const row of empRows) {
      const r = row as string[]
      const employeeId = r[0] ?? ''
      const role = r[12] || 'employee'

      // Skip admin users from the dashboard
      if (role === 'admin') continue
      if (!employeeId) continue

      const docRow = docStatusMap.get(employeeId)

      const documents: Record<DocumentKey, DocumentStatus> = {} as Record<DocumentKey, DocumentStatus>
      let completedCount = 0

      for (let i = 0; i < DOCUMENT_KEYS.length; i++) {
        const key = DOCUMENT_KEYS[i]
        const raw = docRow?.[i + 3] ?? '미완료' // columns D-I (index 3-8)
        let status: DocumentStatus
        if (raw === '서명완료') {
          status = DOC_STATUS.SIGNED
          completedCount++
        } else if (raw === '발송완료') {
          status = DOC_STATUS.SENT
          completedCount++
        } else {
          status = DOC_STATUS.PENDING
        }
        documents[key] = status
      }

      const sessionStatus = (r[10] as SessionStatus) ?? 'PENDING'
      const allCompletedAt = docRow?.[9] ?? ''
      const emailSentAt = docRow?.[10] ?? ''

      employees.push({
        employee_id: employeeId,
        name: r[1] ?? '',
        department: r[7] ?? '',
        hire_date: r[6] ?? '',
        session_status: sessionStatus,
        documents,
        completed_count: completedCount,
        all_completed_at: allCompletedAt,
        email_sent_at: emailSentAt,
      })

      // Stats
      if (allCompletedAt || emailSentAt) {
        completed++
      } else if (sessionStatus === 'IN_PROGRESS') {
        inProgress++
      } else {
        pending++
      }
    }

    const total = employees.length
    const stats: DashboardStats = {
      total,
      completed,
      in_progress: inProgress,
      pending,
      completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    }

    const response: DashboardResponse = { employees, stats }
    return apiOk(response)
  } catch (err) {
    log.error({ err }, '대시보드 데이터 조회 중 오류')
    return apiFromUnknown(err)
  }
}
