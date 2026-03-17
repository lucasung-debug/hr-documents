import type { DocumentKey, DocumentStatus } from './document'
import type { SessionStatus } from './employee'

export interface DashboardEmployee {
  employee_id: string
  name: string
  department: string
  hire_date: string
  session_status: SessionStatus
  documents: Record<DocumentKey, DocumentStatus>
  completed_count: number
  all_completed_at: string
  email_sent_at: string
}

export interface DashboardStats {
  total: number
  completed: number
  in_progress: number
  pending: number
  completion_rate: number
}

export interface DashboardResponse {
  employees: DashboardEmployee[]
  stats: DashboardStats
}
