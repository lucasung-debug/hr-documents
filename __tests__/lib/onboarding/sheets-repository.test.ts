import { createSheetsOnboardingRepository } from '@/lib/onboarding/sheets-repository'
import { deriveCaseId } from '@/lib/onboarding/case-id'
import {
  findExtendedDocStatusByEmployeeId,
  initDocStatusRow,
  updateCaseMetadata,
} from '@/lib/sheets/document-status'
import { DOC_STATUS } from '@/types/document'
import type { OnboardingCaseMetadataPatch } from '@/types/onboarding'

jest.mock('@/lib/sheets/document-status', () => ({
  findExtendedDocStatusByEmployeeId: jest.fn(),
  initDocStatusRow: jest.fn(),
  updateCaseMetadata: jest.fn(),
}))

const mockFindExtended = jest.mocked(findExtendedDocStatusByEmployeeId)
const mockInitDocStatusRow = jest.mocked(initDocStatusRow)
const mockUpdateCaseMetadata = jest.mocked(updateCaseMetadata)

describe('createSheetsOnboardingRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('maps a 12-column legacy row into a full onboarding case with defaults', async () => {
    mockFindExtended.mockResolvedValueOnce({
      rowIndex: 2,
      row: {
        employee_id: 'EMP001',
        name: 'Kim',
        phone: '010',
        labor_contract: '서명완료',
        personal_info_consent: '미완료',
        holiday_extension: '발송완료',
        data_security_pledge: '미완료',
        compliance: '미완료',
        overtime_work: '미완료',
        all_completed_at: '',
        email_sent_at: '',
        sign_hash: '',
        case_id: '',
        case_status: '',
        pdf_packet_status: '',
        workspace_sync_status: '',
        notification_status: '',
        action_required: '',
        blocked_reason: '',
        drive_file_id: '',
        drive_archived_at: '',
        slack_notified_at: '',
        last_case_event_at: '',
        case_schema_version: '',
      },
    })

    const result = await createSheetsOnboardingRepository().findByEmployeeId('EMP001')

    expect(result).toEqual({
      employee_id: 'EMP001',
      name: 'Kim',
      phone: '010',
      documents: {
        labor_contract: DOC_STATUS.SIGNED,
        personal_info_consent: DOC_STATUS.PENDING,
        holiday_extension: DOC_STATUS.SENT,
        data_security_pledge: DOC_STATUS.PENDING,
        compliance: DOC_STATUS.PENDING,
        overtime_work: DOC_STATUS.PENDING,
      },
      completed_count: 2,
      all_completed_at: '',
      email_sent_at: '',
      sign_hash: '',
      case_id: deriveCaseId('EMP001'),
      case_status: 'collecting_documents',
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
    })
  })

  it('maps a 24-column row preserving valid metadata', async () => {
    mockFindExtended.mockResolvedValueOnce({
      rowIndex: 2,
      row: {
        employee_id: 'EMP002',
        name: 'Lee',
        phone: '011',
        labor_contract: '서명완료',
        personal_info_consent: '서명완료',
        holiday_extension: '발송완료',
        data_security_pledge: '서명완료',
        compliance: '서명완료',
        overtime_work: '서명완료',
        all_completed_at: '2026-05-01',
        email_sent_at: '2026-05-02',
        sign_hash: 'hash-2',
        case_id: 'CASE-2',
        case_status: 'archived',
        pdf_packet_status: 'generated',
        workspace_sync_status: 'synced',
        notification_status: 'both',
        action_required: 'none',
        blocked_reason: '',
        drive_file_id: 'drive-2',
        drive_archived_at: '2026-05-03',
        slack_notified_at: '2026-05-04',
        last_case_event_at: '2026-05-05',
        case_schema_version: '2',
      },
    })

    const result = await createSheetsOnboardingRepository().findByEmployeeId('EMP002')

    expect(result).toMatchObject({
      employee_id: 'EMP002',
      case_id: 'CASE-2',
      case_status: 'archived',
      pdf_packet_status: 'generated',
      workspace_sync_status: 'synced',
      notification_status: 'both',
      action_required: 'none',
      drive_file_id: 'drive-2',
      case_schema_version: 2,
      completed_count: 6,
    })
  })

  it('returns null for a missing employee', async () => {
    mockFindExtended.mockResolvedValueOnce(null)

    await expect(createSheetsOnboardingRepository().findByEmployeeId('EMP404')).resolves.toBeNull()
  })

  it('finds the row before writing only M:X metadata', async () => {
    mockFindExtended.mockResolvedValueOnce({
      rowIndex: 7,
      row: {
        employee_id: 'EMP001',
        name: 'Kim',
        phone: '010',
        labor_contract: '미완료',
        personal_info_consent: '미완료',
        holiday_extension: '미완료',
        data_security_pledge: '미완료',
        compliance: '미완료',
        overtime_work: '미완료',
        all_completed_at: '',
        email_sent_at: '',
        sign_hash: '',
        case_id: '',
        case_status: '',
        pdf_packet_status: '',
        workspace_sync_status: '',
        notification_status: '',
        action_required: '',
        blocked_reason: '',
        drive_file_id: '',
        drive_archived_at: '',
        slack_notified_at: '',
        last_case_event_at: '',
        case_schema_version: '',
      },
    })
    const patch: OnboardingCaseMetadataPatch = {
      pdf_packet_status: 'generated',
      drive_file_id: 'drive-1',
    }

    await createSheetsOnboardingRepository().updateMetadata('EMP001', patch)

    expect(mockUpdateCaseMetadata).toHaveBeenCalledWith(7, patch)
  })

  it('falls back safely for invalid metadata values', async () => {
    mockFindExtended.mockResolvedValueOnce({
      rowIndex: 2,
      row: {
        employee_id: 'EMP003',
        name: 'Park',
        phone: '012',
        labor_contract: '서명완료',
        personal_info_consent: '서명완료',
        holiday_extension: '서명완료',
        data_security_pledge: '서명완료',
        compliance: '서명완료',
        overtime_work: '서명완료',
        all_completed_at: '',
        email_sent_at: '',
        sign_hash: '',
        case_id: '',
        case_status: 'unknown',
        pdf_packet_status: 'bad',
        workspace_sync_status: 'bad',
        notification_status: 'bad',
        action_required: 'bad',
        blocked_reason: 'blocked',
        drive_file_id: '',
        drive_archived_at: '',
        slack_notified_at: '',
        last_case_event_at: '',
        case_schema_version: 'not-a-number',
      },
    })

    const result = await createSheetsOnboardingRepository().findByEmployeeId('EMP003')

    expect(result).toMatchObject({
      case_id: deriveCaseId('EMP003'),
      case_status: 'docs_completed',
      pdf_packet_status: 'pending',
      workspace_sync_status: 'pending',
      notification_status: 'none',
      action_required: 'hr_review',
      blocked_reason: 'blocked',
      case_schema_version: 1,
    })
  })

  it('initializes cases through the legacy document status row helper', async () => {
    await createSheetsOnboardingRepository().initCase('EMP001', 'Kim', '010')

    expect(mockInitDocStatusRow).toHaveBeenCalledWith('EMP001', 'Kim', '010')
  })
})
