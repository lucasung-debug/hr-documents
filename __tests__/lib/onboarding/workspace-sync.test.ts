import { syncOnboardingWorkspace } from '@/lib/onboarding/workspace-sync'
import { DOC_STATUS } from '@/types/document'
import type { DriveArchiveUploadClient } from '@/lib/google/drive-archive'
import type { OnboardingCaseRepository } from '@/lib/onboarding/repository'
import type { OnboardingCase, OnboardingCaseMetadataPatch } from '@/types/onboarding'

const fixedNow = new Date('2026-05-23T16:00:00.000Z')
const pdfContent = '%PDF private Kim Sensitive kim@example.com drive-file-secret'

const bothEnabledEnv = {
  GOOGLE_DRIVE_ARCHIVE_ENABLED: 'true',
  GOOGLE_DRIVE_ARCHIVE_FOLDER_ID: 'folder-secret',
  SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'true',
  SLACK_ONBOARDING_WEBHOOK_URL: 'https://hooks.slack.com/services/T000/B000/secret',
  NEXT_PUBLIC_BASE_URL: 'https://hr.example.com',
}

const bothDisabledEnv = {
  GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false',
  GOOGLE_DRIVE_ARCHIVE_FOLDER_ID: 'folder-secret',
  SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'false',
  SLACK_ONBOARDING_WEBHOOK_URL: 'https://hooks.slack.com/services/T000/B000/secret',
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
    sign_hash: 'sign-secret-hash',
    case_id: 'ONB-20260523-0001',
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

function makeRepository(initialCase: OnboardingCase | null = makeCase()): {
  repository: OnboardingCaseRepository
  findByEmployeeId: jest.Mock
  updateMetadata: jest.Mock
  patches: OnboardingCaseMetadataPatch[]
  current: () => OnboardingCase | null
} {
  let currentCase = initialCase
  const patches: OnboardingCaseMetadataPatch[] = []
  const findByEmployeeId = jest.fn().mockImplementation(async () => currentCase)
  const updateMetadata = jest.fn().mockImplementation(async (_employeeId: string, patch: OnboardingCaseMetadataPatch) => {
    patches.push(patch)
    if (currentCase) {
      currentCase = { ...currentCase, ...patch }
    }
  })

  return {
    findByEmployeeId,
    updateMetadata,
    patches,
    current: () => currentCase,
    repository: {
      findByEmployeeId,
      updateMetadata,
      initCase: jest.fn(),
    },
  }
}

function makeUploadClient(id = 'drive-file-secret'): {
  uploadClient: DriveArchiveUploadClient
  uploadPdf: jest.Mock
} {
  const uploadPdf = jest.fn().mockResolvedValue({ id })
  return {
    uploadPdf,
    uploadClient: { uploadPdf },
  }
}

function expectNoSensitiveValues(serialized: string) {
  expect(serialized).not.toContain('Kim Sensitive')
  expect(serialized).not.toContain('010-1234-5678')
  expect(serialized).not.toContain('kim@example.com')
  expect(serialized).not.toContain('sign-secret-hash')
  expect(serialized).not.toContain('PDF private')
  expect(serialized).not.toContain('folder-secret')
  expect(serialized).not.toContain('drive-file-secret')
  expect(serialized).not.toContain('hooks.slack.com')
  expect(serialized).not.toContain('oauth-token-secret')
  expect(serialized).not.toContain('raw thrown secret')
}

function getFetchBody(fetchImpl: jest.Mock): string {
  const init = fetchImpl.mock.calls[0]?.[1] as { body?: unknown } | undefined
  if (typeof init?.body !== 'string') {
    throw new Error('Expected fetch body to be a string')
  }
  return init.body
}

describe('workspace sync orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('short-circuits without repository, upload, fetch, or write when both integrations are disabled', async () => {
    const { repository, findByEmployeeId, updateMetadata } = makeRepository()
    const { uploadClient, uploadPdf } = makeUploadClient()
    const fetchImpl = jest.fn()

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      fetchImpl,
      env: bothDisabledEnv,
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'disabled' }, slack: 'disabled' })
    expect(findByEmployeeId).not.toHaveBeenCalled()
    expect(updateMetadata).not.toHaveBeenCalled()
    expect(uploadPdf).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('runs Drive archive and skips Slack fetch when Slack is disabled', async () => {
    const { repository, updateMetadata } = makeRepository()
    const { uploadClient, uploadPdf } = makeUploadClient()
    const fetchImpl = jest.fn()

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [{ filename: 'packet.pdf', content: Buffer.from(pdfContent), contentType: 'application/pdf' }],
      repository,
      uploadClient,
      fetchImpl,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from(pdfContent)),
      env: { ...bothEnabledEnv, SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'false' },
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'synced' }, slack: 'disabled' })
    expect(uploadPdf).toHaveBeenCalledTimes(1)
    expect(updateMetadata).toHaveBeenCalledWith('EMP001', expect.objectContaining({ drive_file_id: 'drive-file-secret' }))
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('skips Slack when the latest case has no action required after Drive success', async () => {
    const { repository } = makeRepository()
    const { uploadClient } = makeUploadClient()
    const fetchImpl = jest.fn()

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      fetchImpl,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from('%PDF safe')),
      env: bothEnabledEnv,
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'synced' }, slack: 'skipped_not_required' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('notifies Slack after Drive failure without clobbering drive_sync_failed', async () => {
    const { repository, patches, current } = makeRepository()
    const uploadClient: DriveArchiveUploadClient = {
      uploadPdf: jest.fn().mockRejectedValue(new Error('raw thrown secret for Kim Sensitive')),
    }
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      fetchImpl,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from('%PDF safe')),
      env: bothEnabledEnv,
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'failed', reason: 'drive_sync_failed' }, slack: 'sent' })
    expect(current()?.action_required).toBe('drive_sync_failed')
    expect(current()?.notification_status).toBe('both')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(patches.at(-1)).toEqual({
      notification_status: 'both',
      slack_notified_at: '2026-05-23T16:00:00.000Z',
      last_case_event_at: '2026-05-23T16:00:00.000Z',
    })
  })

  it('notifies Slack after PDF packet failure without clobbering pdf_packet_failed', async () => {
    const { repository, current } = makeRepository()
    const { uploadClient, uploadPdf } = makeUploadClient()
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      fetchImpl,
      buildPacket: jest.fn().mockRejectedValue(new Error('raw thrown secret with PDF content')),
      env: bothEnabledEnv,
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'failed', reason: 'pdf_packet_failed' }, slack: 'sent' })
    expect(uploadPdf).not.toHaveBeenCalled()
    expect(current()?.action_required).toBe('pdf_packet_failed')
    expect(current()?.notification_status).toBe('both')
  })

  it('writes only a partial Slack success metadata patch', async () => {
    const { repository, patches } = makeRepository(
      makeCase({ action_required: 'hr_review', case_status: 'action_required', notification_status: 'email_sent' })
    )
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      fetchImpl,
      env: { ...bothEnabledEnv, GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' },
      now: () => fixedNow,
    })

    expect(result.slack).toBe('sent')
    expect(patches).toEqual([
      {
        notification_status: 'both',
        slack_notified_at: '2026-05-23T16:00:00.000Z',
        last_case_event_at: '2026-05-23T16:00:00.000Z',
      },
    ])
    expect(Object.keys(patches[0])).not.toContain('drive_file_id')
    expect(Object.keys(patches[0])).not.toContain('case_id')
    expect(Object.keys(patches[0])).not.toContain('blocked_reason')
    expectNoSensitiveValues(JSON.stringify({ result, patch: patches[0], body: getFetchBody(fetchImpl) }))
  })

  it('writes a safe partial Slack failure patch without clobbering Drive or PDF failures', async () => {
    const { repository, patches, current } = makeRepository(
      makeCase({
        action_required: 'drive_sync_failed',
        case_status: 'action_required',
        pdf_packet_status: 'generated',
        workspace_sync_status: 'failed',
        notification_status: 'email_sent',
        blocked_reason: 'Drive archive failed',
      })
    )
    const fetchImpl = jest.fn().mockRejectedValue(new Error('raw thrown secret for Kim Sensitive'))

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      fetchImpl,
      env: { ...bothEnabledEnv, GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' },
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'disabled' }, slack: 'failed' })
    expect(current()?.action_required).toBe('drive_sync_failed')
    expect(current()?.blocked_reason).toBe('Drive archive failed')
    expect(patches).toEqual([
      {
        notification_status: 'failed',
        last_case_event_at: '2026-05-23T16:00:00.000Z',
      },
    ])
    expect(patches[0]).not.toHaveProperty('blocked_reason')
    expectNoSensitiveValues(JSON.stringify({ result, patch: patches[0] }))
  })

  it('keeps Drive failure action and reason when Slack also fails after archive failure', async () => {
    const { repository, patches, current } = makeRepository()
    const uploadClient: DriveArchiveUploadClient = {
      uploadPdf: jest.fn().mockRejectedValue(new Error('raw thrown secret for Kim Sensitive')),
    }
    const fetchImpl = jest.fn().mockRejectedValue(new Error('raw thrown secret for Kim Sensitive'))

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      fetchImpl,
      buildPacket: jest.fn().mockResolvedValue(Buffer.from('%PDF safe')),
      env: bothEnabledEnv,
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'failed', reason: 'drive_sync_failed' }, slack: 'failed' })
    expect(current()?.action_required).toBe('drive_sync_failed')
    expect(current()?.blocked_reason).toBe('Drive archive failed')
    expect(patches).toEqual([
      expect.objectContaining({
        action_required: 'drive_sync_failed',
        blocked_reason: 'Drive archive failed',
      }),
      {
        notification_status: 'failed',
        last_case_event_at: '2026-05-23T16:00:00.000Z',
      },
    ])
    expect(patches[1]).not.toHaveProperty('action_required')
    expect(patches[1]).not.toHaveProperty('blocked_reason')
  })

  it('writes Slack failure action and reason for an existing Slack-only failure', async () => {
    const { repository, patches, current } = makeRepository(
      makeCase({
        action_required: 'slack_notify_failed',
        case_status: 'action_required',
        notification_status: 'failed',
        blocked_reason: 'Previous notification failure',
      })
    )
    const fetchImpl = jest.fn().mockRejectedValue(new Error('raw thrown secret for Kim Sensitive'))

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      fetchImpl,
      env: { ...bothEnabledEnv, GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' },
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'disabled' }, slack: 'failed' })
    expect(current()?.action_required).toBe('slack_notify_failed')
    expect(current()?.blocked_reason).toBe('Slack notification failed')
    expect(patches).toEqual([
      {
        notification_status: 'failed',
        last_case_event_at: '2026-05-23T16:00:00.000Z',
        action_required: 'slack_notify_failed',
        blocked_reason: 'Slack notification failed',
      },
    ])
  })

  it('does not upload or build packet on existing Drive archive retry and still evaluates Slack', async () => {
    const { repository, updateMetadata, patches } = makeRepository(
      makeCase({
        drive_file_id: 'drive-file-secret',
        action_required: 'hr_review',
        case_status: 'action_required',
        notification_status: 'email_sent',
      })
    )
    const { uploadClient, uploadPdf } = makeUploadClient()
    const buildPacket = jest.fn()
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      uploadClient,
      fetchImpl,
      buildPacket,
      env: bothEnabledEnv,
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'skipped_existing_archive' }, slack: 'sent' })
    expect(buildPacket).not.toHaveBeenCalled()
    expect(uploadPdf).not.toHaveBeenCalled()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(updateMetadata).toHaveBeenCalledTimes(1)
    expect(patches).toEqual([
      {
        notification_status: 'both',
        slack_notified_at: '2026-05-23T16:00:00.000Z',
        last_case_event_at: '2026-05-23T16:00:00.000Z',
      },
    ])
  })

  it('does not duplicate Slack notification when already notified', async () => {
    const alreadyAt = makeRepository(
      makeCase({ action_required: 'hr_review', slack_notified_at: '2026-05-22T00:00:00.000Z' })
    )
    const alreadyBoth = makeRepository(makeCase({ action_required: 'hr_review', notification_status: 'both' }))
    const fetchImpl = jest.fn()

    await expect(
      syncOnboardingWorkspace({
        employeeId: 'EMP001',
        attachments: [],
        repository: alreadyAt.repository,
        fetchImpl,
        env: { ...bothEnabledEnv, GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' },
        now: () => fixedNow,
      })
    ).resolves.toEqual({ archive: { status: 'disabled' }, slack: 'skipped_already_notified' })

    await expect(
      syncOnboardingWorkspace({
        employeeId: 'EMP001',
        attachments: [],
        repository: alreadyBoth.repository,
        fetchImpl,
        env: { ...bothEnabledEnv, GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' },
        now: () => fixedNow,
      })
    ).resolves.toEqual({ archive: { status: 'disabled' }, slack: 'skipped_already_notified' })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(alreadyAt.updateMetadata).not.toHaveBeenCalled()
    expect(alreadyBoth.updateMetadata).not.toHaveBeenCalled()
  })

  it('catches metadata update failure in the Slack patch and returns failed', async () => {
    const { repository, updateMetadata } = makeRepository(
      makeCase({ action_required: 'hr_review', case_status: 'action_required', notification_status: 'email_sent' })
    )
    updateMetadata.mockRejectedValueOnce(new Error('raw thrown secret for Kim Sensitive'))
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP001',
      attachments: [],
      repository,
      fetchImpl,
      env: { ...bothEnabledEnv, GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' },
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'disabled' }, slack: 'failed' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns skipped_no_case when Slack is enabled and no case exists', async () => {
    const { repository, updateMetadata } = makeRepository(null)
    const fetchImpl = jest.fn()

    const result = await syncOnboardingWorkspace({
      employeeId: 'EMP404',
      attachments: [],
      repository,
      fetchImpl,
      env: { ...bothEnabledEnv, GOOGLE_DRIVE_ARCHIVE_ENABLED: 'false' },
      now: () => fixedNow,
    })

    expect(result).toEqual({ archive: { status: 'disabled' }, slack: 'skipped_no_case' })
    expect(updateMetadata).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
