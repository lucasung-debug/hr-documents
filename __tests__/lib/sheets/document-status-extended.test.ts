import {
  findDocStatusByEmployeeId,
  findExtendedDocStatusByEmployeeId,
  initDocStatusRow,
  updateCaseMetadata,
} from '@/lib/sheets/document-status'
import { cache } from '@/lib/cache/memory-cache'

const mockGet = jest.fn()
const mockAppend = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/sheets/client', () => ({
  getSheetsClient: jest.fn(() => ({
    spreadsheets: {
      values: {
        get: mockGet,
        append: mockAppend,
        update: mockUpdate,
      },
    },
  })),
  SPREADSHEET_ID: jest.fn(() => 'spreadsheet-id'),
  SHEET_NAMES: {
    DOCUMENT_STATUS: 'DOCUMENT_STATUS',
  },
  withRetry: jest.fn((fn: () => Promise<unknown>) => fn()),
}))

describe('extended document status sheet helpers', () => {
  beforeEach(() => {
    cache.clear()
    jest.clearAllMocks()
  })

  it('reads A2:X and returns the matching row index', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        values: [
          ['EMP001', 'Kim', '010'],
          [
            'EMP002',
            'Lee',
            '011',
            '서명완료',
            '미완료',
            '발송완료',
            '미완료',
            '서명완료',
            '미완료',
            '2026-05-01',
            '2026-05-02',
            'hash-2',
            'ONB-EMP002',
            'docs_completed',
            'generated',
            'synced',
            'email_sent',
            'hr_review',
            'needs review',
            'drive-file-1',
            '2026-05-03',
            '2026-05-04',
            '2026-05-05',
            '2',
          ],
        ],
      },
    })

    const result = await findExtendedDocStatusByEmployeeId('EMP002')

    expect(mockGet).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-id',
      range: 'DOCUMENT_STATUS!A2:X',
    })
    expect(result?.rowIndex).toBe(3)
    expect(result?.row.case_id).toBe('ONB-EMP002')
    expect(result?.row.case_schema_version).toBe('2')
  })

  it('keeps legacy 12-column rows parseable as extended rows', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        values: [
          [
            'EMP001',
            'Kim',
            '010',
            '미완료',
            '미완료',
            '미완료',
            '미완료',
            '미완료',
            '미완료',
            '',
            '',
            '',
          ],
        ],
      },
    })

    const result = await findExtendedDocStatusByEmployeeId('EMP001')

    expect(result?.row.employee_id).toBe('EMP001')
    expect(result?.row.sign_hash).toBe('')
    expect(result?.row.case_id).toBe('')
    expect(result?.row.case_schema_version).toBe('')
  })

  it('updates exactly M:X metadata columns without touching A:L', async () => {
    mockUpdate.mockResolvedValueOnce({ data: {} })

    await updateCaseMetadata(5, {
      case_id: 'ONB-EMP001',
      case_status: 'docs_completed',
      pdf_packet_status: 'generated',
      workspace_sync_status: 'synced',
      notification_status: 'both',
      action_required: 'none',
      blocked_reason: '',
      drive_file_id: 'drive-1',
      drive_archived_at: '',
      slack_notified_at: '2026-05-02',
      last_case_event_at: '2026-05-03',
      case_schema_version: 2,
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-id',
      range: 'DOCUMENT_STATUS!M5:X5',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            'ONB-EMP001',
            'docs_completed',
            'generated',
            'synced',
            'both',
            'none',
            '',
            'drive-1',
            '',
            '2026-05-02',
            '2026-05-03',
            '2',
          ],
        ],
      },
    })
  })

  it('keeps existing A:L helpers on their original ranges', async () => {
    mockGet.mockResolvedValueOnce({ data: { values: [] } })
    mockAppend.mockResolvedValueOnce({ data: {} })

    await findDocStatusByEmployeeId('EMP404')
    await initDocStatusRow('EMP001', 'Kim', '010')

    expect(mockGet).toHaveBeenCalledWith({
      spreadsheetId: 'spreadsheet-id',
      range: 'DOCUMENT_STATUS!A2:L',
    })
    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        range: 'DOCUMENT_STATUS!A:L',
      })
    )
  })
})
