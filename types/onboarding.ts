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
