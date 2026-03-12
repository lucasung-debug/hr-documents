import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from './client'
import type { EmployeeMasterRow, SessionStatus } from '@/types/employee'

// Column order must match EMPLOYEE_MASTER sheet exactly:
// A: employee_id, B: name, C: phone, D: email, E: hire_date,
// F: department, G: position, H: session_status, I: onboarding_link

function rowToEmployee(row: string[]): EmployeeMasterRow {
  return {
    employee_id: row[0] ?? '',
    name: row[1] ?? '',
    phone: row[2] ?? '',
    email: row[3] ?? '',
    hire_date: row[4] ?? '',
    department: row[5] ?? '',
    position: row[6] ?? '',
    session_status: (row[7] as SessionStatus) ?? 'PENDING',
    onboarding_link: row[8] ?? '',
  }
}

export async function findEmployeeByNameAndPhone(
  name: string,
  phone: string
): Promise<{ employee: EmployeeMasterRow; rowIndex: number } | null> {
  const sheets = getSheetsClient()
  const range = `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:I`

  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range,
    })
  )

  const rows = response.data.values ?? []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (row[1] === name && row[2] === phone) {
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
      range: `${SHEET_NAMES.EMPLOYEE_MASTER}!H${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[status]] },
    })
  )
}

export async function getEmployeeById(
  employeeId: string
): Promise<{ employee: EmployeeMasterRow; rowIndex: number } | null> {
  const sheets = getSheetsClient()
  const range = `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:I`

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
