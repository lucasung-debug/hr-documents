import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from '@/lib/sheets/client'
import { DOCUMENT_KEYS, DOC_STATUS } from '@/types/document'
import type { DocumentKey, DocumentStatus } from '@/types/document'
import type { SessionStatus } from '@/types/employee'
import type { DashboardEmployee } from '@/types/admin'
import { apiOk, apiFromUnknown } from '@/lib/api'
import { createLogger } from '@/lib/logger'

const log = createLogger('[admin/incomplete]')

/**
 * GET /api/admin/incomplete?sort=hire_date&order=asc
 * Returns employees who have not completed all documents.
 */
export async function GET(request: NextRequest) {
  const blocked = requireAdmin(request.headers)
  if (blocked) return blocked

  const sortBy = request.nextUrl.searchParams.get('sort') ?? 'hire_date'
  const order = request.nextUrl.searchParams.get('order') ?? 'asc'

  try {
    const sheets = getSheetsClient()

    const [empResponse, docResponse] = await Promise.all([
      withRetry(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID(),
          range: `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:N`,
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

    const docStatusMap = new Map<string, string[]>()
    for (const row of docRows) {
      const r = row as string[]
      if (r[0]) docStatusMap.set(r[0], r)
    }

    const incomplete: DashboardEmployee[] = []

    for (const row of empRows) {
      const r = row as string[]
      const employeeId = r[0] ?? ''
      const role = r[13] || 'employee'
      if (role === 'admin' || !employeeId) continue

      const docRow = docStatusMap.get(employeeId)
      const allCompletedAt = docRow?.[9] ?? ''
      const emailSentAt = docRow?.[10] ?? ''

      // Skip completed employees
      if (allCompletedAt || emailSentAt) continue

      const documents: Record<DocumentKey, DocumentStatus> = {} as Record<DocumentKey, DocumentStatus>
      let completedCount = 0

      for (let i = 0; i < DOCUMENT_KEYS.length; i++) {
        const key = DOCUMENT_KEYS[i]
        const raw = docRow?.[i + 3] ?? '미완료'
        let status: DocumentStatus
        if (raw === '서명완료' || raw === '발송완료') {
          status = raw === '서명완료' ? DOC_STATUS.SIGNED : DOC_STATUS.SENT
          completedCount++
        } else {
          status = DOC_STATUS.PENDING
        }
        documents[key] = status
      }

      incomplete.push({
        employee_id: employeeId,
        name: r[1] ?? '',
        department: r[7] ?? '',
        hire_date: r[6] ?? '',
        session_status: (r[11] as SessionStatus) ?? 'PENDING',
        documents,
        completed_count: completedCount,
        all_completed_at: '',
        email_sent_at: '',
      })
    }

    // Sort
    incomplete.sort((a, b) => {
      const aVal = sortBy === 'name' ? a.name : a.hire_date
      const bVal = sortBy === 'name' ? b.name : b.hire_date
      const cmp = aVal.localeCompare(bVal, 'ko')
      return order === 'desc' ? -cmp : cmp
    })

    return apiOk({ employees: incomplete })
  } catch (err) {
    log.error({ err }, '미완료 직원 조회 중 오류')
    return apiFromUnknown(err)
  }
}
