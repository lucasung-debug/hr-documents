import { shouldArchivePdfPacket, type DriveArchiveUploadClient } from '@/lib/google/drive-archive'
import { createSheetsOnboardingRepository } from '@/lib/onboarding/sheets-repository'
import {
  archiveEmailOnboardingPacket,
  isDriveArchiveEnabled,
  type ArchiveEmailOnboardingPacketResult,
} from '@/lib/onboarding/workspace-archive'
import { isSlackNotificationEnabled, safelyNotifyOnboardingActionRequiredSlack } from '@/lib/slack/onboarding-notification'
import type { SlackFetch } from '@/lib/slack/onboarding-notification'
import type { PdfPacketAttachment } from '@/lib/onboarding/pdf-packet'
import type { OnboardingCaseRepository } from '@/lib/onboarding/repository'
import type { OnboardingCase, OnboardingCaseMetadataPatch } from '@/types/onboarding'

interface WorkspaceSyncEnv extends Record<string, string | undefined> {
  GOOGLE_DRIVE_ARCHIVE_ENABLED?: string
  GOOGLE_DRIVE_ARCHIVE_FOLDER_ID?: string
  SLACK_ONBOARDING_NOTIFICATIONS_ENABLED?: string
  SLACK_ONBOARDING_WEBHOOK_URL?: string
  NEXT_PUBLIC_BASE_URL?: string
}

export interface SyncOnboardingWorkspaceInput {
  employeeId: string
  attachments: readonly PdfPacketAttachment[]
  repository?: OnboardingCaseRepository
  uploadClient?: DriveArchiveUploadClient
  fetchImpl?: SlackFetch
  buildPacket?: (attachments: readonly PdfPacketAttachment[]) => Promise<Buffer>
  now?: () => Date
  env?: WorkspaceSyncEnv
}

export type SyncOnboardingWorkspaceResult = {
  archive: ArchiveEmailOnboardingPacketResult
  slack:
    | 'disabled'
    | 'skipped_no_case'
    | 'skipped_not_required'
    | 'skipped_already_notified'
    | 'sent'
    | 'failed'
}

const SLACK_FAILURE_REASON = 'Slack notification failed'

export async function syncOnboardingWorkspace(
  input: SyncOnboardingWorkspaceInput
): Promise<SyncOnboardingWorkspaceResult> {
  const env = input.env ?? process.env
  const driveEnabled = isDriveArchiveEnabled(env)
  const slackEnabled = isSlackNotificationEnabled(env)

  if (!driveEnabled && !slackEnabled) {
    return { archive: { status: 'disabled' }, slack: 'disabled' }
  }

  const now = input.now ?? (() => new Date())
  const repository = input.repository ?? createSheetsOnboardingRepository()

  let archive: ArchiveEmailOnboardingPacketResult = { status: 'disabled' }
  let latestCase: OnboardingCase | null | undefined

  if (driveEnabled) {
    try {
      const existingCase = await repository.findByEmployeeId(input.employeeId)

      if (!existingCase) {
        archive = { status: 'case_not_found' }
        latestCase = null
      } else if (!shouldArchivePdfPacket(existingCase)) {
        archive = { status: 'skipped_existing_archive' }
        latestCase = existingCase
      } else {
        archive = await archiveEmailOnboardingPacket({
          employeeId: input.employeeId,
          attachments: input.attachments,
          repository,
          uploadClient: input.uploadClient,
          buildPacket: input.buildPacket,
          now,
          env,
        })
        latestCase = undefined
      }
    } catch {
      archive = { status: 'failed', reason: 'metadata_update_failed' }
      latestCase = undefined
    }
  }

  if (!slackEnabled) {
    return { archive, slack: 'disabled' }
  }

  const slack = await syncSlackNotification({
    employeeId: input.employeeId,
    repository,
    latestCase,
    fetchImpl: input.fetchImpl,
    now,
    env,
  })

  return { archive, slack }
}

async function syncSlackNotification(input: {
  employeeId: string
  repository: OnboardingCaseRepository
  latestCase?: OnboardingCase | null
  fetchImpl?: SlackFetch
  now: () => Date
  env: WorkspaceSyncEnv
}): Promise<SyncOnboardingWorkspaceResult['slack']> {
  let onboardingCase = input.latestCase

  if (onboardingCase === undefined) {
    try {
      onboardingCase = await input.repository.findByEmployeeId(input.employeeId)
    } catch {
      return 'failed'
    }
  }

  if (!onboardingCase) {
    return 'skipped_no_case'
  }

  if (onboardingCase.action_required === 'none') {
    return 'skipped_not_required'
  }

  if (onboardingCase.slack_notified_at.trim() || onboardingCase.notification_status === 'both') {
    return 'skipped_already_notified'
  }

  const notifyResult = await safelyNotifyOnboardingActionRequiredSlack({
    case_id: onboardingCase.case_id,
    action_required: onboardingCase.action_required,
    case_status: onboardingCase.case_status,
    pdf_packet_status: onboardingCase.pdf_packet_status,
    workspace_sync_status: onboardingCase.workspace_sync_status,
    notification_status: onboardingCase.notification_status,
    env: input.env,
    fetchImpl: input.fetchImpl,
    now: input.now,
  })

  if (!notifyResult.ok) {
    return writeSlackFailureMetadata(input.repository, input.employeeId, onboardingCase, input.now)
  }

  if (notifyResult.status === 'disabled') {
    return 'disabled'
  }

  if (notifyResult.status === 'not_action_required') {
    return 'skipped_not_required'
  }

  if (notifyResult.status !== 'slack_sent') {
    return 'failed'
  }

  try {
    const patch: OnboardingCaseMetadataPatch = {
      notification_status: 'both',
      slack_notified_at: notifyResult.slack_notified_at,
      last_case_event_at: input.now().toISOString(),
    }

    if (onboardingCase.action_required === 'slack_notify_failed') {
      patch.action_required = 'none'
      patch.blocked_reason = ''
    }

    await input.repository.updateMetadata(input.employeeId, patch)
    return 'sent'
  } catch {
    return 'failed'
  }
}

async function writeSlackFailureMetadata(
  repository: OnboardingCaseRepository,
  employeeId: string,
  onboardingCase: OnboardingCase,
  now: () => Date
): Promise<SyncOnboardingWorkspaceResult['slack']> {
  const patch: OnboardingCaseMetadataPatch = {
    notification_status: 'failed',
    last_case_event_at: now().toISOString(),
  }

  if (
    onboardingCase.action_required === 'none' ||
    onboardingCase.action_required === 'slack_notify_failed'
  ) {
    patch.action_required = 'slack_notify_failed'
    patch.blocked_reason = SLACK_FAILURE_REASON
  }

  try {
    await repository.updateMetadata(employeeId, patch)
  } catch {
    return 'failed'
  }

  return 'failed'
}
