export type SessionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export interface EmployeeMasterRow {
  employee_id: string
  name: string
  phone: string
  email: string
  hire_date: string
  department: string
  position: string
  session_status: SessionStatus
  onboarding_link: string
}

export interface DocumentStatusRow {
  employee_id: string
  name: string
  phone: string
  labor_contract: string
  personal_info_consent: string
  bank_account: string
  health_certificate: string
  criminal_check_consent: string
  emergency_contact: string
  data_security_pledge: string
  all_completed_at: string
  email_sent_at: string
  sign_hash: string
}

export interface SessionPayload {
  employee_id: string
  name: string
  phone: string
  iat?: number
  exp?: number
}
