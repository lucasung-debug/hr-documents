import {
  computeActionRequired,
  computeCaseStatus,
  computeSignedDocumentCount,
} from '@/lib/onboarding/status'
import { DOC_STATUS, DOCUMENT_KEYS, type DocumentKey, type DocumentStatus } from '@/types/document'
import type { ComputeCaseStatusInput } from '@/types/onboarding'

const documentsWithStatus = (status: DocumentStatus): Record<DocumentKey, DocumentStatus> =>
  Object.fromEntries(DOCUMENT_KEYS.map((key) => [key, status])) as Record<DocumentKey, DocumentStatus>

const input = (overrides: Partial<ComputeCaseStatusInput> = {}): ComputeCaseStatusInput => ({
  documents: documentsWithStatus(DOC_STATUS.SIGNED),
  pdfPacketStatus: 'generated',
  workspaceSyncStatus: 'synced',
  notificationStatus: 'both',
  ...overrides,
})

describe('computeSignedDocumentCount', () => {
  it('counts signed and sent documents as completed', () => {
    const documents: Record<DocumentKey, DocumentStatus> = {
      ...documentsWithStatus(DOC_STATUS.PENDING),
      labor_contract: DOC_STATUS.SIGNED,
      personal_info_consent: DOC_STATUS.SENT,
    }

    expect(computeSignedDocumentCount(documents)).toBe(2)
  })
})

describe('computeActionRequired', () => {
  it('returns none while documents are still being collected', () => {
    expect(
      computeActionRequired(input({ documents: documentsWithStatus(DOC_STATUS.PENDING) }))
    ).toBe('none')
  })

  it('requires HR review after all documents are complete but Drive is not synced', () => {
    expect(computeActionRequired(input({ workspaceSyncStatus: 'pending' }))).toBe('hr_review')
  })

  it('prioritizes Drive sync failures', () => {
    expect(
      computeActionRequired(
        input({ workspaceSyncStatus: 'failed', notificationStatus: 'failed' })
      )
    ).toBe('drive_sync_failed')
  })

  it('prioritizes PDF packet failures before Drive and notification failures', () => {
    expect(
      computeActionRequired(
        input({
          pdfPacketStatus: 'failed',
          workspaceSyncStatus: 'failed',
          notificationStatus: 'failed',
        })
      )
    ).toBe('pdf_packet_failed')
  })

  it('reports Slack notification failures after Drive sync succeeds', () => {
    expect(computeActionRequired(input({ notificationStatus: 'failed' }))).toBe(
      'slack_notify_failed'
    )
  })

  it('requires HR review when documents are complete but PDF generation is pending', () => {
    expect(computeActionRequired(input({ pdfPacketStatus: 'pending' }))).toBe('hr_review')
  })

  it('requires HR review when notifications have not been sent after sync completes', () => {
    expect(computeActionRequired(input({ notificationStatus: 'none' }))).toBe('hr_review')
  })

  it('returns none after Drive sync and notification are complete', () => {
    expect(computeActionRequired(input())).toBe('none')
  })
})

describe('computeCaseStatus', () => {
  it('collects documents until every document is signed or sent', () => {
    expect(
      computeCaseStatus(input({ documents: documentsWithStatus(DOC_STATUS.PENDING) }))
    ).toBe('collecting_documents')
  })

  it('marks completed documents as docs_completed while Drive sync is pending', () => {
    expect(computeCaseStatus(input({ workspaceSyncStatus: 'pending' }))).toBe('docs_completed')
  })

  it('marks completed documents as docs_completed while PDF generation is pending', () => {
    expect(computeCaseStatus(input({ pdfPacketStatus: 'pending' }))).toBe('docs_completed')
  })

  it('marks completed documents as docs_completed until a notification is sent', () => {
    expect(computeCaseStatus(input({ notificationStatus: 'none' }))).toBe('docs_completed')
  })

  it('marks explicit Drive failures as failed', () => {
    expect(computeCaseStatus(input({ workspaceSyncStatus: 'failed' }))).toBe('failed')
  })

  it('marks explicit notification failures as action_required', () => {
    expect(computeCaseStatus(input({ notificationStatus: 'failed' }))).toBe('action_required')
  })

  it('archives the case after documents, Drive sync, and notification are complete', () => {
    expect(computeCaseStatus(input())).toBe('archived')
  })
})
