import { deriveCaseId } from '@/lib/onboarding/case-id'
import {
  computeActionRequired,
  computeCaseStatus,
  computeSignedDocumentCount,
} from '@/lib/onboarding/status'
import {
  findExtendedDocStatusByEmployeeId,
  initDocStatusRow,
  updateCaseMetadata,
  type ExtendedDocumentStatusRow,
} from '@/lib/sheets/document-status'
import { DOC_STATUS, DOCUMENT_KEYS, type DocumentKey, type DocumentStatus } from '@/types/document'
import type {
  NotificationStatus,
  OnboardingActionRequired,
  OnboardingCase,
  OnboardingCaseMetadata,
  OnboardingCaseMetadataPatch,
  OnboardingCaseStatus,
  PdfPacketStatus,
  WorkspaceSyncStatus,
} from '@/types/onboarding'
import type { OnboardingCaseRepository } from './repository'

const CASE_STATUSES: readonly OnboardingCaseStatus[] = [
  'collecting_documents',
  'docs_completed',
  'action_required',
  'archived',
  'failed',
]
const PDF_PACKET_STATUSES: readonly PdfPacketStatus[] = ['pending', 'generated', 'failed']
const WORKSPACE_SYNC_STATUSES: readonly WorkspaceSyncStatus[] = ['pending', 'synced', 'failed']
const NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  'none',
  'email_sent',
  'slack_sent',
  'both',
  'failed',
]
const ACTION_REQUIRED_VALUES: readonly OnboardingActionRequired[] = [
  'none',
  'hr_review',
  'pdf_packet_failed',
  'drive_sync_failed',
  'slack_notify_failed',
]

const isOneOf = <T extends string>(value: string, allowed: readonly T[]): value is T =>
  allowed.includes(value as T)

const parseDocumentStatus = (value: string): DocumentStatus => {
  if (value === '서명완료') return DOC_STATUS.SIGNED
  if (value === '발송완료') return DOC_STATUS.SENT
  return DOC_STATUS.PENDING
}

const parseDocuments = (row: ExtendedDocumentStatusRow): Record<DocumentKey, DocumentStatus> =>
  Object.fromEntries(
    DOCUMENT_KEYS.map((key) => [key, parseDocumentStatus(row[key])])
  ) as Record<DocumentKey, DocumentStatus>

const parseSchemaVersion = (value: string): number => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

const mapMetadata = (
  row: ExtendedDocumentStatusRow,
  documents: Record<DocumentKey, DocumentStatus>
): OnboardingCaseMetadata => {
  const pdfPacketStatus = isOneOf(row.pdf_packet_status, PDF_PACKET_STATUSES)
    ? row.pdf_packet_status
    : 'pending'
  const workspaceSyncStatus = isOneOf(row.workspace_sync_status, WORKSPACE_SYNC_STATUSES)
    ? row.workspace_sync_status
    : 'pending'
  const notificationStatus = isOneOf(row.notification_status, NOTIFICATION_STATUSES)
    ? row.notification_status
    : 'none'

  const computedInput = {
    documents,
    pdfPacketStatus,
    workspaceSyncStatus,
    notificationStatus,
  }
  const computedCaseStatus = computeCaseStatus(computedInput)
  const computedActionRequired = computeActionRequired(computedInput)

  return {
    case_id: row.case_id.trim() || deriveCaseId(row.employee_id),
    case_status: isOneOf(row.case_status, CASE_STATUSES) ? row.case_status : computedCaseStatus,
    pdf_packet_status: pdfPacketStatus,
    workspace_sync_status: workspaceSyncStatus,
    notification_status: notificationStatus,
    action_required: isOneOf(row.action_required, ACTION_REQUIRED_VALUES)
      ? row.action_required
      : computedActionRequired,
    blocked_reason: row.blocked_reason ?? '',
    drive_file_id: row.drive_file_id ?? '',
    drive_archived_at: row.drive_archived_at ?? '',
    slack_notified_at: row.slack_notified_at ?? '',
    last_case_event_at: row.last_case_event_at ?? '',
    case_schema_version: parseSchemaVersion(row.case_schema_version),
  }
}

const mapRowToCase = (row: ExtendedDocumentStatusRow): OnboardingCase => {
  const documents = parseDocuments(row)
  const metadata = mapMetadata(row, documents)

  return {
    employee_id: row.employee_id,
    name: row.name,
    phone: row.phone,
    documents,
    completed_count: computeSignedDocumentCount(documents),
    all_completed_at: row.all_completed_at,
    email_sent_at: row.email_sent_at,
    sign_hash: row.sign_hash,
    ...metadata,
  }
}

export const createSheetsOnboardingRepository = (): OnboardingCaseRepository => ({
  async findByEmployeeId(employeeId: string): Promise<OnboardingCase | null> {
    const result = await findExtendedDocStatusByEmployeeId(employeeId)
    return result ? mapRowToCase(result.row) : null
  },

  async initCase(employeeId: string, name: string, phone: string): Promise<void> {
    await initDocStatusRow(employeeId, name, phone)
  },

  async updateMetadata(employeeId: string, patch: OnboardingCaseMetadataPatch): Promise<void> {
    const result = await findExtendedDocStatusByEmployeeId(employeeId)
    if (!result) return

    await updateCaseMetadata(result.rowIndex, patch)
  },
})
