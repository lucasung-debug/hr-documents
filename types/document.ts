// Single source of truth for all 7 document keys.
// Do NOT modify key names — they must match Google Sheets column names exactly.

export const DOCUMENT_KEYS = [
  'labor_contract',
  'personal_info_consent',
  'bank_account',
  'health_certificate',
  'criminal_check_consent',
  'emergency_contact',
  'data_security_pledge',
] as const

export type DocumentKey = (typeof DOCUMENT_KEYS)[number]

export const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  labor_contract: '근로계약서',
  personal_info_consent: '개인정보 수집·이용 동의서',
  bank_account: '급여 이체 계좌 신청서',
  health_certificate: '건강진단서 제출 확인서',
  criminal_check_consent: '범죄경력조회 동의서',
  emergency_contact: '비상연락망 등록 신청서',
  data_security_pledge: '정보보안 서약서',
}

export const DOCUMENT_DESCRIPTIONS: Record<DocumentKey, string> = {
  labor_contract: '근로 조건, 급여, 복리후생 등을 포함한 고용 계약서입니다.',
  personal_info_consent: '인사·급여 관리를 위한 개인정보 수집 및 이용 동의서입니다.',
  bank_account: '급여 이체를 위한 본인 명의 계좌 정보를 등록합니다.',
  health_certificate: '입사 전 건강검진 결과서 제출을 확인하는 서류입니다.',
  criminal_check_consent: '채용 절차에 필요한 범죄경력 조회 동의서입니다.',
  emergency_contact: '비상 시 연락 가능한 보호자 정보를 등록합니다.',
  data_security_pledge: '업무상 취득한 정보의 보안 유지를 서약하는 문서입니다.',
}

export const PDF_FILENAME_SUFFIXES: Record<DocumentKey, string> = {
  labor_contract: '근로계약서',
  personal_info_consent: '개인정보동의',
  bank_account: '계좌신청',
  health_certificate: '건강진단',
  criminal_check_consent: '범죄조회동의',
  emergency_contact: '비상연락',
  data_security_pledge: '보안서약',
}

// Signature required for all documents; emergency_contact is optional but still signed
export const SIGNATURE_REQUIRED: Record<DocumentKey, boolean> = {
  labor_contract: true,
  personal_info_consent: true,
  bank_account: true,
  health_certificate: true,
  criminal_check_consent: true,
  emergency_contact: false,
  data_security_pledge: true,
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
