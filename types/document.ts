// Single source of truth for all 6 document keys.
// Do NOT modify key names — they must match Google Sheets column names exactly.

export const DOCUMENT_KEYS = [
  'labor_contract',
  'personal_info_consent',
  'holiday_extension',
  'data_security_pledge',
  'compliance',
  'overtime_work',
] as const

export type DocumentKey = (typeof DOCUMENT_KEYS)[number]

export const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  labor_contract: '근로계약서',
  personal_info_consent: '개인정보 수집·제공·이용 동의서',
  holiday_extension: '연차유급휴가 이월·미사용수당 지급기일 연장 동의서',
  data_security_pledge: '보안 서약서',
  compliance: '준법행동 실천 서약서',
  overtime_work: '연장·야간·휴일근로 동의서',
}

export const DOCUMENT_DESCRIPTIONS: Record<DocumentKey, string> = {
  labor_contract: '근로 조건, 급여, 복리후생 등을 포함한 고용 계약서입니다.',
  personal_info_consent: '인사·급여 관리를 위한 개인정보 수집·제공·이용 동의서입니다.',
  holiday_extension: '연차유급휴가의 이월 및 미사용수당 지급기일 연장에 동의하는 서류입니다.',
  data_security_pledge: '업무상 취득한 정보의 보안 유지를 서약하는 문서입니다.',
  compliance: '준법행동을 실천하겠다는 서약서입니다.',
  overtime_work: '연장·야간·휴일 근로에 대한 동의서입니다.',
}

export const PDF_FILENAME_SUFFIXES: Record<DocumentKey, string> = {
  labor_contract: '근로계약서',
  personal_info_consent: '개인정보동의',
  holiday_extension: '연차휴가연장',
  data_security_pledge: '보안서약',
  compliance: '준법서약',
  overtime_work: '연장근로동의',
}

// Signature required for all 6 documents
export const SIGNATURE_REQUIRED: Record<DocumentKey, boolean> = {
  labor_contract: true,
  personal_info_consent: true,
  holiday_extension: true,
  data_security_pledge: true,
  compliance: true,
  overtime_work: true,
}

export const DOC_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  SENT: 'sent',
} as const
export type DocumentStatus = typeof DOC_STATUS[keyof typeof DOC_STATUS]

export interface ConsentRecord {
  documentKey: DocumentKey
  consentedAt: string // ISO 8601 timestamp
  pdfTempPath?: string
}

export type TemplateSource = 'pdf' | 'sheets'

export interface DocumentListItem {
  key: DocumentKey
  label: string
  status: DocumentStatus
  signatureRequired: boolean
}
