import type { EmployeeMasterRow } from '@/types/employee'
import type { ContractConditions } from './contract'

/**
 * Build the base template variables from employee info.
 * Handles date_yy/mm/dd splitting and maps address/birthday.
 */
export function buildBaseVariables(
  employee: EmployeeMasterRow
): Record<string, string> {
  const today = new Date()
  const hireDate = parseKoreanDate(employee.hire_date)

  return {
    employee_name: employee.name,
    name: employee.name,
    department: employee.department,
    position: employee.position,
    hire_date: employee.hire_date,
    adrress: employee.address, // Template uses {{adrress}} (typo preserved)
    address: employee.address, // overtime_work uses {{address}} (correct spelling)
    birthday: employee.birthday,
    phone: employee.phone,
    // Today's date split
    date_yy: String(today.getFullYear()),
    date_mm: padTwo(today.getMonth() + 1),
    date_dd: padTwo(today.getDate()),
    // Hire date split (for contract date fields)
    hire_date_yy: String(hireDate.getFullYear()),
    hire_date_mm: padTwo(hireDate.getMonth() + 1),
    hire_date_dd: padTwo(hireDate.getDate()),
    // Position name for {{position_name}} template variable
    position_name: employee.position,
    // Signature placeholder (empty for preview, name for final)
    signature: '',
  }
}

/**
 * Build labor contract variables from EMPLOYEE_CONTRACT data.
 * Includes position, salary fields, work_hours, and intern_date split.
 */
export function buildContractVariables(
  conditions: ContractConditions
): Record<string, string> {
  const internDate = parseKoreanDate(conditions.intern_date)

  return {
    position: conditions.position,
    salary_basic: conditions.salary_basic,
    salary_OT: conditions.salary_OT,
    salary_fix: conditions.salary_fix,
    salary_total: conditions.salary_total,
    work_hours: conditions.work_hours,
    // Intern (probation) end date from EMPLOYEE_CONTRACT sheet
    intern_date_yy: String(internDate.getFullYear()),
    intern_date_mm: padTwo(internDate.getMonth() + 1),
    intern_date_dd: padTwo(internDate.getDate()),
  }
}

/**
 * Parse Korean-style date string like "2026.03.16" into a Date.
 */
function parseKoreanDate(dateStr: string): Date {
  const parts = dateStr.replace(/[^0-9.\-/]/g, '').split(/[.\-/]/).filter(Boolean)
  const year = parseInt(parts[0] ?? '2026', 10)
  const month = parseInt(parts[1] ?? '1', 10) - 1
  const day = parseInt(parts[2] ?? '1', 10)
  return new Date(year, month, day)
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}
