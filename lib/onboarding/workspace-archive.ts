import { safelyArchiveOnboardingPdfPacket, shouldArchivePdfPacket } from '@/lib/google/drive-archive'
import type { DriveArchiveUploadClient } from '@/lib/google/drive-archive'
import { deriveCaseId } from '@/lib/onboarding/case-id'
import { buildOnboardingPdfPacket } from '@/lib/onboarding/pdf-packet'
import type { PdfPacketAttachment } from '@/lib/onboarding/pdf-packet'
import type { OnboardingCaseRepository } from '@/lib/onboarding/repository'
import { createSheetsOnboardingRepository } from '@/lib/onboarding/sheets-repository'
import type { OnboardingCaseMetadataPatch } from '@/types/onboarding'

interface DriveArchiveEnv extends Record<string, string | undefined> {
  GOOGLE_DRIVE_ARCHIVE_ENABLED?: string
  GOOGLE_DRIVE_ARCHIVE_FOLDER_ID?: string
}

export type ArchiveEmailOnboardingPacketResult =
  | { status: 'disabled' }
  | { status: 'case_not_found' }
  | { status: 'skipped_existing_archive' }
  | { status: 'synced' }
  | { status: 'failed'; reason: 'pdf_packet_failed' | 'drive_sync_failed' | 'metadata_update_failed' }

export interface ArchiveEmailOnboardingPacketInput {
  employeeId: string
  attachments: readonly PdfPacketAttachment[]
  repository?: OnboardingCaseRepository
  uploadClient?: DriveArchiveUploadClient
  now?: () => Date
  env?: DriveArchiveEnv
  buildPacket?: (attachments: readonly PdfPacketAttachment[]) => Promise<Buffer>
}

export function isDriveArchiveEnabled(env: DriveArchiveEnv = process.env): boolean {
  return env.GOOGLE_DRIVE_ARCHIVE_ENABLED === 'true'
}

export async function archiveEmailOnboardingPacket(
  input: ArchiveEmailOnboardingPacketInput
): Promise<ArchiveEmailOnboardingPacketResult> {
  const env = input.env ?? process.env
  if (!isDriveArchiveEnabled(env)) {
    return { status: 'disabled' }
  }

  const now = input.now ?? (() => new Date())
  const eventAt = now().toISOString()
  const repository = input.repository ?? createSheetsOnboardingRepository()

  try {
    const onboardingCase = await repository.findByEmployeeId(input.employeeId)
    if (!onboardingCase) {
      return { status: 'case_not_found' }
    }

    const caseId = onboardingCase.case_id.trim() || deriveCaseId(input.employeeId)

    if (!shouldArchivePdfPacket(onboardingCase)) {
      const patch: OnboardingCaseMetadataPatch = {
        case_id: caseId,
        pdf_packet_status: 'generated',
        workspace_sync_status: 'synced',
        notification_status: 'email_sent',
        action_required: 'none',
        blocked_reason: '',
        last_case_event_at: eventAt,
        case_schema_version: 1,
      }
      await repository.updateMetadata(input.employeeId, patch)
      return { status: 'skipped_existing_archive' }
    }

    let packet: Buffer
    try {
      packet = await (input.buildPacket ?? buildOnboardingPdfPacket)(input.attachments)
    } catch {
      await writeSafeFailureMetadata(repository, input.employeeId, {
        case_id: caseId,
        pdf_packet_status: 'failed',
        workspace_sync_status: 'failed',
        notification_status: 'email_sent',
        action_required: 'pdf_packet_failed',
        blocked_reason: 'PDF packet generation failed',
        last_case_event_at: eventAt,
        case_schema_version: 1,
      })
      return { status: 'failed', reason: 'pdf_packet_failed' }
    }

    const archiveResult = await safelyArchiveOnboardingPdfPacket({
      case_id: caseId,
      pdf: packet,
      uploadClient: input.uploadClient,
      folderId: env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID,
      now,
    })

    if (!archiveResult.ok) {
      await writeSafeFailureMetadata(repository, input.employeeId, {
        case_id: caseId,
        pdf_packet_status: 'generated',
        workspace_sync_status: 'failed',
        notification_status: 'email_sent',
        action_required: 'drive_sync_failed',
        blocked_reason: 'Drive archive failed',
        last_case_event_at: eventAt,
        case_schema_version: 1,
      })
      return { status: 'failed', reason: 'drive_sync_failed' }
    }

    await repository.updateMetadata(input.employeeId, {
      case_id: caseId,
      pdf_packet_status: 'generated',
      workspace_sync_status: 'synced',
      notification_status: 'email_sent',
      action_required: 'none',
      blocked_reason: '',
      drive_file_id: archiveResult.drive_file_id,
      drive_archived_at: archiveResult.drive_archived_at,
      last_case_event_at: eventAt,
      case_schema_version: 1,
    })

    return { status: 'synced' }
  } catch {
    return { status: 'failed', reason: 'metadata_update_failed' }
  }
}

async function writeSafeFailureMetadata(
  repository: OnboardingCaseRepository,
  employeeId: string,
  patch: OnboardingCaseMetadataPatch
): Promise<void> {
  try {
    await repository.updateMetadata(employeeId, patch)
  } catch {
    // Email delivery has already succeeded; archive metadata failure must not change that outcome.
  }
}
