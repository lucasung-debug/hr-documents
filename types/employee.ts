export const SESSION_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const
export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS]

export type PaySection = 'monthly' | 'daily'

export type UserRole = 'employee' | 'admin'

export interface EmployeeMasterRow {
  employee_id: string
  name: string
  address: string
  birthday: string
  phone: string
  email: string
  hire_date: string
  department: string
  position: string
  pay_sec: PaySection
  session_status: SessionStatus
  onboarding_link: string
  role: UserRole
}

export interface DocumentStatusRow {
  employee_id: string
  name: string
  phone: string
  labor_contract: string
  personal_info_consent: string
  holiday_extension: string
  data_security_pledge: string
  compliance: string
  overtime_work: string
  all_completed_at: string
  email_sent_at: string
  sign_hash: string
}

export interface SessionPayload {
  employee_id: string
  name: string
  phone: string
  role: UserRole
  iat?: number
  exp?: number
}
