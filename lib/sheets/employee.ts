import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from './client'
import { SESSION_STATUS } from '@/types/employee'
import type { EmployeeMasterRow, SessionStatus, UserRole } from '@/types/employee'
import { cache, CACHE_TTL } from '@/lib/cache/memory-cache'

// Column order must match EMPLOYEE_MASTER sheet exactly:
// A: employee_id, B: name, C: address, D: birthday, E: phone,
// F: email, G: hire_date, H: department, I: position, J: position_name,
// K: pay_sec, L: session_status, M: onboarding_link, N: role

function rowToEmployee(row: string[]): EmployeeMasterRow {
  const paySec = (row[10] ?? '').toLowerCase()
  return {
    employee_id: row[0] ?? '',
    name: row[1] ?? '',
    address: row[2] ?? '',
    birthday: row[3] ?? '',
    phone: row[4] ?? '',
    email: row[5] ?? '',
    hire_date: row[6] ?? '',
    department: row[7] ?? '',
    position: row[8] ?? '',
    position_name: row[9] ?? '',
    pay_sec: paySec === 'daily' ? 'daily' : 'monthly',
    session_status: (row[11] as SessionStatus) ?? SESSION_STATUS.PENDING,
    onboarding_link: row[12] ?? '',
    role: (row[13] as UserRole) || 'employee',
  }
}

export async function findEmployeeByNameAndPhone(
  name: string,
  phone: string
): Promise<{ employee: EmployeeMasterRow; rowIndex: number } | null> {
  const sheets = getSheetsClient()
  const range = `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:N`

  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range,
    })
  )

  const rows = response.data.values ?? []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (row[1] === name && row[4] === phone) {
      return { employee: rowToEmployee(row), rowIndex: i + 2 } // +2 for 1-based index + header
    }
  }
  return null
}

export async function updateSessionStatus(
  rowIndex: number,
  status: SessionStatus
): Promise<void> {
  const sheets = getSheetsClient()
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.EMPLOYEE_MASTER}!L${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[status]] },
    })
  )
  // Invalidate employee cache since status changed
  cache.invalidate('employee:')
}

export async function getEmployeeById(
  employeeId: string
): Promise<{ employee: EmployeeMasterRow; rowIndex: number } | null> {
  const cacheKey = `employee:id:${employeeId}`
  const cached = cache.get<{ employee: EmployeeMasterRow; rowIndex: number }>(cacheKey)
  if (cached) return cached

  const sheets = getSheetsClient()
  const range = `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:N`

  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range,
    })
  )

  const rows = response.data.values ?? []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (row[0] === employeeId) {
      const result = { employee: rowToEmployee(row), rowIndex: i + 2 }
      cache.set(cacheKey, result, CACHE_TTL.EMPLOYEE)
      return result
    }
  }
  return null
}
