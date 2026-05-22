import type { DocumentKey, DocumentStatus } from './document'
import type { SessionStatus } from './employee'
import type {
  NotificationStatus,
  OnboardingActionRequired,
  OnboardingCaseStatus,
  PdfPacketStatus,
  WorkspaceSyncStatus,
} from './onboarding'

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
  case_id: string
  case_status: OnboardingCaseStatus
  pdf_packet_status: PdfPacketStatus
  workspace_sync_status: WorkspaceSyncStatus
  notification_status: NotificationStatus
  action_required: OnboardingActionRequired
  blocked_reason: string
  drive_archived_at: string
  slack_notified_at: string
  case_schema_version: number
}

export interface DashboardStats {
  total: number
  completed: number
  in_progress: number
  pending: number
  action_required: number
  sync_failed: number
  archive_pending: number
  completion_rate: number
}

export interface DashboardResponse {
  employees: DashboardEmployee[]
  stats: DashboardStats
}
