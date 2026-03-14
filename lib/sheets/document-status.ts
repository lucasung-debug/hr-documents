import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from './client'
import { DOCUMENT_KEYS, DOC_STATUS } from '@/types/document'
import type { DocumentKey, DocumentStatus } from '@/types/document'
import type { DocumentStatusRow } from '@/types/employee'

// Column order: A:employee_id, B:name, C:phone,
// D:labor_contract, E:personal_info_consent, F:bank_account,
// G:health_certificate, H:criminal_check_consent, I:emergency_contact,
// J:data_security_pledge, K:all_completed_at, L:email_sent_at, M:sign_hash

const DOC_COLUMN_MAP: Record<DocumentKey, string> = {
  labor_contract: 'D',
  personal_info_consent: 'E',
  bank_account: 'F',
  health_certificate: 'G',
  criminal_check_consent: 'H',
  emergency_contact: 'I',
  data_security_pledge: 'J',
}

function rowToDocStatus(row: string[]): DocumentStatusRow {
  return {
    employee_id: row[0] ?? '',
    name: row[1] ?? '',
    phone: row[2] ?? '',
    labor_contract: row[3] ?? '미완료',
    personal_info_consent: row[4] ?? '미완료',
    bank_account: row[5] ?? '미완료',
    health_certificate: row[6] ?? '미완료',
    criminal_check_consent: row[7] ?? '미완료',
    emergency_contact: row[8] ?? '미완료',
    data_security_pledge: row[9] ?? '미완료',
    all_completed_at: row[10] ?? '',
    email_sent_at: row[11] ?? '',
    sign_hash: row[12] ?? '',
  }
}

export async function findDocStatusByEmployeeId(
  employeeId: string
): Promise<{ row: DocumentStatusRow; rowIndex: number } | null> {
  const sheets = getSheetsClient()
  const response = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!A2:M`,
    })
  )

  const rows = response.data.values ?? []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as string[]
    if (row[0] === employeeId) {
      return { row: rowToDocStatus(row), rowIndex: i + 2 }
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
    '미완료', '미완료', '미완료', '미완료', '미완료', '미완료', '미완료',
    '', '', '',
  ]
  await withRetry(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!A:M`,
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
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!K${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[now]] },
    })
  )
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
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!L${rowIndex}:M${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[now, signHash]] },
    })
  )
}

export async function setEmailSentinel(rowIndex: number): Promise<void> {
  const sheets = getSheetsClient()
  await withRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID(),
      range: `${SHEET_NAMES.DOCUMENT_STATUS}!L${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['sending']] },
    })
  )
}
