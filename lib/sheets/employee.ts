import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from './client'
import { SESSION_STATUS } from '@/types/employee'
import type { EmployeeMasterRow, SessionStatus, UserRole } from '@/types/employee'

// Column order must match EMPLOYEE_MASTER sheet exactly:
// A: employee_id, B: name, C: address, D: birthday, E: phone,
// F: email, G: hire_date, H: department, I: position, J: pay_sec,
// K: session_status, L: onboarding_link, M: role

function rowToEmployee(row: string[]): EmployeeMasterRow {
  const paySec = (row[9] ?? '').toLowerCase()
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
    pay_sec: paySec === 'daily' ? 'daily' : 'monthly',
    session_status: (row[10] as SessionStatus) ?? SESSION_STATUS.PENDING,
    onboarding_link: row[11] ?? '',
    role: (row[12] as UserRole) || 'employee',
  }
}

export async function findEmployeeByNameAndPhone(
  name: string,
  phone: string
): Promise<{ employee: EmployeeMasterRow; rowIndex: number } | null> {
  const sheets = getSheetsClient()
  const range = `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:M`

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
      range: `${SHEET_NAMES.EMPLOYEE_MASTER}!K${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[status]] },
    })
  )
}

export async function getEmployeeById(
  employeeId: string
): Promise<{ employee: EmployeeMasterRow; rowIndex: number } | null> {
  const sheets = getSheetsClient()
  const range = `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:M`

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
      return { employee: rowToEmployee(row), rowIndex: i + 2 }
    }
  }
  return null
}
