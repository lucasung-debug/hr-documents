import { getSheetsClient, SPREADSHEET_ID, withRetry } from './client'

// EMPLOYEE_CONTRACT sheet columns:
// A: employee_id, B: name, C: hire_date, D: intern_date,
// E: position, F: pay_sec, G: salary_basic, H: salary_OT,
// I: salary_fix, J: salary_total, K: work_hours,
// L: benefits, M: probation_period, N: special_terms,
// O: bank_name, P: account_number

export interface ContractConditions {
  employee_id: string
  name: string
  hire_date: string
  intern_date: string
  position: string
  salary_basic: string
  salary_OT: string
  salary_fix: string
  salary_total: string
  work_hours: string
  benefits: string
  probation_period: string
  special_terms: string
  bank_name: string
  account_number: string
}

const SHEET_NAME = 'EMPLOYEE_CONTRACT'

function rowToConditions(row: string[]): ContractConditions {
  return {
    employee_id: row[0] ?? '',
    name: row[1] ?? '',
    hire_date: row[2] ?? '',
    intern_date: row[3] ?? '',
    position: row[4] ?? '',
    salary_basic: row[6] ?? '',
    salary_OT: row[7] ?? '',
    salary_fix: row[8] ?? '',
    salary_total: row[9] ?? '',
    work_hours: row[10] ?? '',
    benefits: row[11] ?? '',
    probation_period: row[12] ?? '',
    special_terms: row[13] ?? '',
    bank_name: row[14] ?? '',
    account_number: row[15] ?? '',
  }
}

/**
 * Look up individual contract conditions from the EMPLOYEE_CONTRACT sheet.
 * Returns null if no matching employee_id is found.
 */
export async function getContractConditions(
  employeeId: string
): Promise<ContractConditions | null> {
  const sheets = getSheetsClient()

  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAME}!A2:P`,
    })
  )

  const rows = response.data.values ?? []
  for (const row of rows) {
    if ((row as string[])[0] === employeeId) {
      return rowToConditions(row as string[])
    }
  }
  return null
}

/**
 * Convert contract conditions to template variables for placeholder substitution.
 */
export function contractToVariables(
  conditions: ContractConditions
): Record<string, string> {
  return {
    salary_basic: conditions.salary_basic,
    salary_OT: conditions.salary_OT,
    salary_fix: conditions.salary_fix,
    salary_total: conditions.salary_total,
    work_hours: conditions.work_hours,
    benefits: conditions.benefits,
    probation_period: conditions.probation_period,
    special_terms: conditions.special_terms,
    bank_name: conditions.bank_name,
    account_number: conditions.account_number,
  }
}
