const MAX_EMPLOYEE_ID_LENGTH = 64
const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9_-]+$/

export const deriveCaseId = (employeeId: string): string => {
  const normalizedEmployeeId = employeeId.trim()

  if (normalizedEmployeeId.length === 0) {
    throw new Error('employeeId is required')
  }

  if (normalizedEmployeeId.length > MAX_EMPLOYEE_ID_LENGTH) {
    throw new Error('employeeId must be 64 characters or fewer')
  }

  if (!EMPLOYEE_ID_PATTERN.test(normalizedEmployeeId)) {
    throw new Error('employeeId may only contain ASCII letters, digits, underscores, and hyphens')
  }

  return `ONB-${normalizedEmployeeId}`
}
