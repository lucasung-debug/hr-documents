import { DOC_STATUS, DOCUMENT_KEYS, type DocumentKey, type DocumentStatus } from '@/types/document'
import type {
  ComputeActionRequiredInput,
  ComputeCaseStatusInput,
  OnboardingActionRequired,
  OnboardingCaseStatus,
} from '@/types/onboarding'

const isCompletedDocumentStatus = (status: DocumentStatus): boolean =>
  status === DOC_STATUS.SIGNED || status === DOC_STATUS.SENT

const areAllDocumentsCompleted = (documents: Record<DocumentKey, DocumentStatus>): boolean =>
  DOCUMENT_KEYS.every((key) => isCompletedDocumentStatus(documents[key]))

export const computeSignedDocumentCount = (
  documents: Record<DocumentKey, DocumentStatus>
): number => DOCUMENT_KEYS.filter((key) => isCompletedDocumentStatus(documents[key])).length

export const computeActionRequired = (
  input: ComputeActionRequiredInput
): OnboardingActionRequired => {
  if (input.pdfPacketStatus === 'failed') {
    return 'pdf_packet_failed'
  }

  if (input.workspaceSyncStatus === 'failed') {
    return 'drive_sync_failed'
  }

  if (input.notificationStatus === 'failed') {
    return 'slack_notify_failed'
  }

  if (!areAllDocumentsCompleted(input.documents)) {
    return 'none'
  }

  if (input.pdfPacketStatus !== 'generated') {
    return 'hr_review'
  }

  if (input.workspaceSyncStatus !== 'synced') {
    return 'hr_review'
  }

  if (input.notificationStatus === 'none') {
    return 'hr_review'
  }

  return 'none'
}

export const computeCaseStatus = (input: ComputeCaseStatusInput): OnboardingCaseStatus => {
  if (input.workspaceSyncStatus === 'failed' || input.pdfPacketStatus === 'failed') {
    return 'failed'
  }

  if (input.notificationStatus === 'failed') {
    return 'action_required'
  }

  if (!areAllDocumentsCompleted(input.documents)) {
    return 'collecting_documents'
  }

  if (input.pdfPacketStatus !== 'generated') {
    return 'docs_completed'
  }

  if (input.workspaceSyncStatus !== 'synced') {
    return 'docs_completed'
  }

  if (input.notificationStatus === 'none') {
    return 'docs_completed'
  }

  return 'archived'
}
