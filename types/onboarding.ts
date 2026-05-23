import type { DocumentKey, DocumentStatus } from './document'

export type OnboardingCaseStatus =
  | 'collecting_documents'
  | 'docs_completed'
  | 'action_required'
  | 'archived'
  | 'failed'

export type PdfPacketStatus = 'pending' | 'generated' | 'failed'
export type WorkspaceSyncStatus = 'pending' | 'synced' | 'failed'
export type NotificationStatus = 'none' | 'email_sent' | 'slack_sent' | 'both' | 'failed'

export type OnboardingActionRequired =
  | 'none'
  | 'hr_review'
  | 'pdf_packet_failed'
  | 'drive_sync_failed'
  | 'slack_notify_failed'

export interface ComputeCaseStatusInput {
  documents: Record<DocumentKey, DocumentStatus>
  pdfPacketStatus: PdfPacketStatus
  workspaceSyncStatus: WorkspaceSyncStatus
  notificationStatus: NotificationStatus
}

export type ComputeActionRequiredInput = ComputeCaseStatusInput

export interface OnboardingCaseMetadata {
  case_id: string
  case_status: OnboardingCaseStatus
  pdf_packet_status: PdfPacketStatus
  workspace_sync_status: WorkspaceSyncStatus
  notification_status: NotificationStatus
  action_required: OnboardingActionRequired
  blocked_reason: string
  drive_file_id: string
  drive_archived_at: string
  slack_notified_at: string
  last_case_event_at: string
  case_schema_version: number
}

export type OnboardingCaseMetadataPatch = Partial<OnboardingCaseMetadata>

export interface OnboardingCase extends OnboardingCaseMetadata {
  employee_id: string
  name: string
  phone: string
  documents: Record<DocumentKey, DocumentStatus>
  completed_count: number
  all_completed_at: string
  email_sent_at: string
  sign_hash: string
}
