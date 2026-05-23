import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from './client'
import { DOCUMENT_KEYS, DOC_STATUS } from '@/types/document'
import type { DocumentKey, DocumentStatus } from '@/types/document'
import type { DocumentStatusRow } from '@/types/employee'
import type { OnboardingCaseMetadataPatch } from '@/types/onboarding'
import { cache } from '@/lib/cache/memory-cache'

const DOC_STATUS_CACHE_TTL = 30_000 // 30 seconds

// Column order: A:employee_id, B:name, C:phone,
// D:labor_contract, E:personal_info_consent, F:holiday_extension,
// G:data_security_pledge, H:compliance, I:overtime_work,
// J:all_completed_at, K:email_sent_at, L:sign_hash
// M:case_id, N:case_status, O:pdf_packet_status, P:workspace_sync_status,
// Q:notification_status, R:action_required, S:blocked_reason,
// T:drive_file_id, U:drive_archived_at, V:slack_notified_at,
// W:last_case_event_at, X:case_schema_version

const DOC_COLUMN_MAP: Record<DocumentKey, string> = {
  labor_contract: 'D',
  personal_info_consent: 'E',
  holiday_extension: 'F',
  data_security_pledge: 'G',
  compliance: 'H',
  overtime_work: 'I',
}

export interface ExtendedDocumentStatusRow extends DocumentStatusRow {
  case_id: string
  case_status: string
  pdf_packet_status: string
  workspace_sync_status: string
  notification_status: string
  action_required: string
  blocked_reason: string
  drive_file_id: string
  drive_archived_at: string
  slack_notified_at: string
  last_case_event_at: string
  case_schema_version: string
}

function rowToDocStatus(row: string[]): DocumentStatusRow {
  return {
    employee_id: row[0] ?? '',
    name: row[1] ?? '',
    phone: row[2] ?? '',
    labor_contract: row[3] ?? '미완료',
    personal_info_consent: row[4] ?? '미완료',
    holiday_extension: row[5] ?? '미완료',
    data_security_pledge: row[6] ?? '미완료',
    compliance: row[7] ?? '미완료',
    overtime_work: row[8] ?? '미완료',
    all_completed_at: row[9] ?? '',
    email_sent_at: row[10] ?? '',
    sign_hash: row[11] ?? '',
  }
}

function rowToExtendedDocStatus(row: string[]): ExtendedDocumentStatusRow {
  return {
    ...rowToDocStatus(row),
    case_id: row[12] ?? '',
    case_status: row[13] ?? '',
    pdf_packet_status: row[14] ?? '',
    workspace_sync_status: row[15] ?? '',
    notification_status: row[16] ?? '',
    action_required: row[17] ?? '',
    blocked_reason: row[18] ?? '',
    drive_file_id: row[19] ?? '',
    drive_archived_at: row[20] ?? '',
    slack_notified_at: row[21] ?? '',
    last_case_event_at: row[22] ?? '',
    case_schema_version: row[23] ?? '',
  }
}

const metadataToSheetValues = (metadata: OnboardingCaseMetadataPatch): string[] => [
  metadata.case_id ?? '',
  metadata.case_status ?? '',
  metadata.pdf_packet_status ?? '',
  metadata.workspace_sync_status ?? '',
  metadata.notification_status ?? '',
  metadata.action_required ?? '',
  metadata.blocked_reason ?? '',
  metadata.drive_file_id ?? '',
  metadata.drive_archived_at ?? '',
  metadata.slack_notified_at ?? '',
  metadata.last_case_event_at ?? '',
  metadata.case_schema_version === undefined ? '' : String(metadata.case_schema_version),
]

const isCompleteMetadataPatch = (metadata: OnboardingCaseMetadataPatch): boolean =>
  [
    'case_id',
    'case_status',
    'pdf_packet_status',
    'workspace_sync_status',
    'notification_status',
    'action_required',
    'blocked_reason',
    'drive_file_id',
    'drive_archived_at',
    'slack_notified_at',
    'last_case_event_at',
    'case_schema_version',
  ].every((key) => Object.prototype.hasOwnProperty.call(metadata, key))

const metadataValuesToPatch = (values: string[]): OnboardingCaseMetadataPatch => ({
  case_id: values[0] ?? '',
  case_status: values[1] as OnboardingCaseMetadataPatch['case_status'],
  pdf_packet_status: values[2] as OnboardingCaseMetadataPatch['pdf_packet_status'],
  workspace_sync_status: values[3] as OnboardingCaseMetadataPatch['workspace_sync_status'],
  notification_status: values[4] as OnboardingCaseMetadataPatch['notification_status'],
  action_required: values[5] as OnboardingCaseMetadataPatch['action_required'],
  blocked_reason: values[6] ?? '',
  drive_file_id: values[7] ?? '',
  drive_archived_at: values[8] ?? '',
  slack_notified_at: values[9] ?? '',
  last_case_event_at: values[10] ?? '',
  case_schema_version: values[11] === undefined || values[11] === '' ? undefined : Number(values[11]),
})

export async function findDocStatusByEmployeeId(
  employeeId: string
): Promise<{ row: DocumentStatusRow; rowIndex: number } | null> {
  const cacheKey = `docStatus:${employeeId}`
  const cached = cache.get<{ row: DocumentStatusRow; rowIndex: number }>(cacheKey)
  if (cached) return cached

  const sheets = getSheetsClient()
  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!A2:L`,
    })
  )

  const rows = response.data.values ?? []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (row[0] === employeeId) {
      const result = { row: rowToDocStatus(row), rowIndex: i + 2 }
      cache.set(cacheKey, result, DOC_STATUS_CACHE_TTL)
      return result
    }
  }
  return null
}

export async function findExtendedDocStatusByEmployeeId(
  employeeId: string
): Promise<{ row: ExtendedDocumentStatusRow; rowIndex: number } | null> {
  const cacheKey = `docStatusExtended:${employeeId}`
  const cached = cache.get<{ row: ExtendedDocumentStatusRow; rowIndex: number }>(cacheKey)
  if (cached) return cached

  const sheets = getSheetsClient()
  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!A2:X`,
    })
  )

  const rows = response.data.values ?? []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (row[0] === employeeId) {
      const result = { row: rowToExtendedDocStatus(row), rowIndex: i + 2 }
      cache.set(cacheKey, result, DOC_STATUS_CACHE_TTL)
      return result
    }
  }
  return null
}

export async function initDocStatusRow(
  employeeId: string,
  name: string,
  phone: string
): Promise<void> {
  const sheets = getSheetsClient()
  const initialRow = [
    employeeId,
    name,
    phone,
    '미완료', '미완료', '미완료', '미완료', '미완료', '미완료',
    '', '', '',
  ]
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!A:L`,
      valueInputOption: 'RAW',
      requestBody: { values: [initialRow] },
    })
  )
}

export async function updateDocumentStatus(
  rowIndex: number,
  documentKey: DocumentKey,
  status: DocumentStatus
): Promise<void> {
  const sheets = getSheetsClient()
  const column = DOC_COLUMN_MAP[documentKey]
  const statusLabel = status === DOC_STATUS.PENDING ? '미완료' : status === DOC_STATUS.SIGNED ? '서명완료' : '발송완료'

  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!${column}${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[statusLabel]] },
    })
  )
  cache.invalidate('docStatus:')
  cache.invalidate('docStatusExtended:')
}

export async function updateCaseMetadata(
  rowIndex: number,
  metadata: OnboardingCaseMetadataPatch
): Promise<void> {
  const sheets = getSheetsClient()
  let metadataToWrite = metadata

  if (!isCompleteMetadataPatch(metadata)) {
    const response = await withRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID(),
        range: `${SHEET_NAMES.DOCUMENT_STATUS}!M${rowIndex}:X${rowIndex}`,
      })
    )
    const existingValues = (response.data.values?.[0] ?? []) as string[]
    metadataToWrite = {
      ...metadataValuesToPatch(existingValues),
      ...metadata,
    }
  }

  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!M${rowIndex}:X${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [metadataToSheetValues(metadataToWrite)] },
    })
  )
  cache.invalidate('docStatus:')
  cache.invalidate('docStatusExtended:')
}

export async function getDocumentStatuses(
  employeeId: string
): Promise<Record<DocumentKey, DocumentStatus>> {
  const result = await findDocStatusByEmployeeId(employeeId)
  const statuses: Record<DocumentKey, DocumentStatus> = {} as Record<DocumentKey, DocumentStatus>

  for (const key of DOCUMENT_KEYS) {
    const raw = result?.row[key] ?? '미완료'
    if (raw === '서명완료') statuses[key] = DOC_STATUS.SIGNED
    else if (raw === '발송완료') statuses[key] = DOC_STATUS.SENT
    else statuses[key] = DOC_STATUS.PENDING
  }

  return statuses
}

export async function markAllCompleted(rowIndex: number): Promise<void> {
  const sheets = getSheetsClient()
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!J${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[now]] },
    })
  )
  cache.invalidate('docStatus:')
  cache.invalidate('docStatusExtended:')
}

export async function markEmailSent(
  rowIndex: number,
  signHash: string
): Promise<void> {
  const sheets = getSheetsClient()
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!K${rowIndex}:L${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[now, signHash]] },
    })
  )
  cache.invalidate('docStatus:')
  cache.invalidate('docStatusExtended:')
}

export async function resetDocStatuses(rowIndex: number): Promise<void> {
  const sheets = getSheetsClient()
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!D${rowIndex}:L${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['미완료', '미완료', '미완료', '미완료', '미완료', '미완료', '', '', '']],
      },
    })
  )
  cache.invalidate('docStatus:')
  cache.invalidate('docStatusExtended:')
}

export async function setEmailSentinel(rowIndex: number): Promise<void> {
  const sheets = getSheetsClient()
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!K${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['sending']] },
    })
  )
  cache.invalidate('docStatus:')
  cache.invalidate('docStatusExtended:')
}
