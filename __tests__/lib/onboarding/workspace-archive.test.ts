import { archiveEmailOnboardingPacket, isDriveArchiveEnabled } from '@/lib/onboarding/workspace-archive'
import { DOC_STATUS } from '@/types/document'
import type { DriveArchiveUploadClient } from '@/lib/google/drive-archive'
import type { OnboardingCaseRepository } from '@/lib/onboarding/repository'
import type { OnboardingCase } from '@/types/onboarding'

const fixedNow = new Date('2026-05-23T12:00:00.000Z')
const envEnabled = {
  GOOGLE_DRIVE_ARCHIVE_ENABLED: 'true',
  GOOGLE_DRIVE_ARCHIVE_FOLDER_ID: 'folder-123',
}
const envDisabled = {
  GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false',
  GOOGLE_DRIVE_ARCHIVE_FOLDER_ID: 'folder-123',
}

function makeCase(overrides: Partial<OnboardingCase> = {}): OnboardingCase {
  return {
    employee_id: 'EMP001',
    name: 'Kim Sensitive',
    phone: '010-1234-5678',
    documents: {
      labor_contract: DOC_STATUS.SENT,
      personal_info_consent: DOC_STATUS.SENT,
      holiday_extension: DOC_STATUS.SENT,
      data_security_pledge: DOC_STATUS.SENT,
      compliance: DOC_STATUS.SENT,
      overtime_work: DOC_STATUS.SENT,
    },
    completed_count: 6,
    all_completed_at: '2026-05-23',
    email_sent_at: '2026-05-23',
    sign_hash: 'hash',
    case_id: 'ONB-EMP001',
    case_status: 'archived',
    pdf_packet_status: 'pending',
    workspace_sync_status: 'pending',
    notification_status: 'none',
    action_required: 'none',
    blocked_reason: '',
    drive_file_id: '',
    drive_archived_at: '',
    slack_notified_at: '',
    last_case_event_at: '',
    case_schema_version: 1,
    ...overrides,
  }
}

function makeRepository(onboardingCase: OnboardingCase | null = makeCase()): {
  repository: OnboardingCaseRepository
  findByEmployeeId: jest.Mock
  updateMetadata: jest.Mock
} {
  const findByEmployeeId = jest.fn().mockResolvedValue(onboardingCase)
  const updateMetadata = jest.fn().mockResolvedValue(undefined)
  return {
    findByEmployeeId,
    updateMetadata,
    repository: {
      findByEmployeeId,
      updateMetadata,
      initCase: jest.fn(),
    },
  }
}

function makeUploadClient(id = 'drive-file-123'): {
  uploadClient: DriveArchiveUploadClient
  uploadPdf: jest.Mock
} {
  const uploadPdf = jest.fn().mockResolvedValue({ id })
  return {
    uploadPdf,
    uploadClient: { uploadPdf },
  }
}

describe('workspace archive orchestration', () => {
  it('enables Drive archive only for exact true', () => {
    expect(isDriveArchiveEnabled({})).toBe(false)
    expect(isDriveArchiveEnabled({ GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' })).toBe(false)
    expect(isDriveArchiveEnabled({ GOOGLE_DRIVE_ARCHIVE_ENABLED: 'TRUE' })).toBe(false)
    expect(isDriveArchiveEnabled({ GOOGLE_DRIVE_ARCHIVE_ENABLED: ' true ' })).toBe(false)
    expect(isDriveArchiveEnabled({ GOOGLE_DRIVE_ARCHIVE_ENABLED: 'true' })).toBe(true)
  })

  it('returns disabled without repository or Drive calls when the gate is off', async () => {
    const { repository, findByEmployeeId, updateMetadata } = makeRepository()
    const { uploadClient, uploadPdf } = makeUploadClient()

    const result = await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      env: envDisabled,
      now: () => fixedNow,
    })

    expect(result).toEqual({ status: 'disabled' })
    expect(findByEmployeeId).not.toHaveBeenCalled()
    expect(updateMetadata).not.toHaveBeenCalled()
    expect(uploadPdf).not.toHaveBeenCalled()
  })

  it('uploads a packet with case id and writes synced metadata', async () => {
    const { repository, updateMetadata } = makeRepository()
    const { uploadClient, uploadPdf } = makeUploadClient()

    const result = await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [{ filename: 'ignored.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }],
      repository,
      uploadClient,
      env: envEnabled,
      now: () => fixedNow,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 packet')),
    })

    expect(result).toEqual({ status: 'synced' })
    expect(uploadPdf).toHaveBeenCalledWith({
      folderId: 'folder-123',
      filename: 'ONB-EMP001-onboarding-packet.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('%PDF-1.4 packet'),
    })
    expect(updateMetadata).toHaveBeenCalledWith('EMP001', {
      case_id: 'ONB-EMP001',
      pdf_packet_status: 'generated',
      workspace_sync_status: 'synced',
      notification_status: 'email_sent',
      action_required: 'none',
      blocked_reason: '',
      drive_file_id: 'drive-file-123',
      drive_archived_at: '2026-05-23T12:00:00.000Z',
      last_case_event_at: '2026-05-23T12:00:00.000Z',
      case_schema_version: 1,
    })
  })

  it('uses derived case id when the existing case id is blank', async () => {
    const { repository, updateMetadata } = makeRepository(makeCase({ case_id: '' }))
    const { uploadClient } = makeUploadClient()

    await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      env: envEnabled,
      now: () => fixedNow,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 packet')),
    })

    expect(updateMetadata).toHaveBeenCalledWith('EMP001', expect.objectContaining({ case_id: 'ONB-EMP001' }))
  })

  it('skips upload when a Drive file id already exists', async () => {
    const { repository, updateMetadata } = makeRepository(makeCase({ drive_file_id: 'drive-existing' }))
    const { uploadClient, uploadPdf } = makeUploadClient()

    const result = await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      env: envEnabled,
      now: () => fixedNow,
    })

    expect(result).toEqual({ status: 'skipped_existing_archive' })
    expect(uploadPdf).not.toHaveBeenCalled()
    expect(updateMetadata).toHaveBeenCalledWith('EMP001', {
      case_id: 'ONB-EMP001',
      pdf_packet_status: 'generated',
      workspace_sync_status: 'synced',
      notification_status: 'email_sent',
      action_required: 'none',
      blocked_reason: '',
      last_case_event_at: '2026-05-23T12:00:00.000Z',
      case_schema_version: 1,
    })
  })

  it('writes safe failure metadata and does not throw on upload failure', async () => {
    const { repository, updateMetadata } = makeRepository()
    const uploadClient: DriveArchiveUploadClient = {
      uploadPdf: jest.fn().mockRejectedValue(new Error('permission denied for Kim Sensitive')),
    }

    const result = await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      env: envEnabled,
      now: () => fixedNow,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 packet')),
    })

    expect(result).toEqual({ status: 'failed', reason: 'drive_sync_failed' })
    expect(updateMetadata).toHaveBeenCalledWith('EMP001', {
      case_id: 'ONB-EMP001',
      pdf_packet_status: 'generated',
      workspace_sync_status: 'failed',
      notification_status: 'email_sent',
      action_required: 'drive_sync_failed',
      blocked_reason: 'Drive archive failed',
      last_case_event_at: '2026-05-23T12:00:00.000Z',
      case_schema_version: 1,
    })
  })

  it('writes pdf_packet_failed metadata and does not throw on packet failure', async () => {
    const { repository, updateMetadata } = makeRepository()
    const { uploadClient, uploadPdf } = makeUploadClient()

    const result = await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      env: envEnabled,
      now: () => fixedNow,
      buildPacket: jest.fn().mockRejectedValue(new Error('PDF contains Kim Sensitive')),
    })

    expect(result).toEqual({ status: 'failed', reason: 'pdf_packet_failed' })
    expect(uploadPdf).not.toHaveBeenCalled()
    expect(updateMetadata).toHaveBeenCalledWith('EMP001', {
      case_id: 'ONB-EMP001',
      pdf_packet_status: 'failed',
      workspace_sync_status: 'failed',
      notification_status: 'email_sent',
      action_required: 'pdf_packet_failed',
      blocked_reason: 'PDF packet generation failed',
      last_case_event_at: '2026-05-23T12:00:00.000Z',
      case_schema_version: 1,
    })
  })

  it('returns a safe failure result without throwing on repository failure', async () => {
    const findByEmployeeId = jest.fn().mockRejectedValue(new Error('sheet failure for Kim Sensitive'))
    const updateMetadata = jest.fn()
    const repository: OnboardingCaseRepository = {
      findByEmployeeId,
      updateMetadata,
      initCase: jest.fn(),
    }
    const { uploadClient, uploadPdf } = makeUploadClient()

    const result = await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      env: envEnabled,
      now: () => fixedNow,
    })

    expect(result).toEqual({ status: 'failed', reason: 'metadata_update_failed' })
    expect(updateMetadata).not.toHaveBeenCalled()
    expect(uploadPdf).not.toHaveBeenCalled()
  })

  it('does not expose employee PII in helper results or metadata', async () => {
    const { repository, updateMetadata } = makeRepository()
    const { uploadClient } = makeUploadClient()

    const result = await archiveEmailOnboardingPacket({
      employeeId: 'EMP001',
      attachments: [{ filename: 'Kim Sensitive_010-1234-5678_kim@example.com.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }],
      repository,
      uploadClient,
      env: envEnabled,
      now: () => fixedNow,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 packet')),
    })
    const serialized = JSON.stringify({ result, patch: updateMetadata.mock.calls[0][1] })

    expect(serialized).not.toContain('Kim Sensitive')
    expect(serialized).not.toContain('010-1234-5678')
    expect(serialized).not.toContain('kim@example.com')
  })
})
