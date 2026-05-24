import { DOC_STATUS, DOCUMENT_KEYS, DOCUMENT_LABELS, SIGNATURE_REQUIRED } from '@/types/document'
import type { DocumentKey, DocumentStatus } from '@/types/document'
import type { DashboardEmployee, DashboardResponse, DashboardStats } from '@/types/admin'
import type { EmployeeMasterRow } from '@/types/employee'
import type { DocListItem, EmployeeInfoResponse, OnboardingMaterial } from '@/types/api'

const signedDocuments = (): Record<DocumentKey, DocumentStatus> => ({
  labor_contract: DOC_STATUS.SIGNED,
  personal_info_consent: DOC_STATUS.SIGNED,
  holiday_extension: DOC_STATUS.SIGNED,
  data_security_pledge: DOC_STATUS.SIGNED,
  compliance: DOC_STATUS.SIGNED,
  overtime_work: DOC_STATUS.SIGNED,
})

const partialDocuments = (): Record<DocumentKey, DocumentStatus> => ({
  labor_contract: DOC_STATUS.SIGNED,
  personal_info_consent: DOC_STATUS.SIGNED,
  holiday_extension: DOC_STATUS.PENDING,
  data_security_pledge: DOC_STATUS.SENT,
  compliance: DOC_STATUS.PENDING,
  overtime_work: DOC_STATUS.PENDING,
})

export const demoDashboardEmployees: DashboardEmployee[] = [
  {
    employee_id: 'DEMO-001',
    name: '김하준',
    department: '인사운영팀',
    hire_date: '2026-06-03',
    session_status: 'COMPLETED',
    documents: signedDocuments(),
    completed_count: 6,
    all_completed_at: '2026-05-20T10:12:00+09:00',
    email_sent_at: '2026-05-20T10:15:00+09:00',
    case_id: 'ONB-2026-001',
    case_status: 'archived',
    pdf_packet_status: 'generated',
    workspace_sync_status: 'synced',
    notification_status: 'slack_sent',
    action_required: 'none',
    blocked_reason: '',
    drive_archived_at: '2026-05-20T10:22:00+09:00',
    slack_notified_at: '2026-05-20T10:25:00+09:00',
    case_schema_version: 2,
  },
  {
    employee_id: 'DEMO-002',
    name: '이서윤',
    department: '제품기획팀',
    hire_date: '2026-06-10',
    session_status: 'IN_PROGRESS',
    documents: partialDocuments(),
    completed_count: 3,
    all_completed_at: '',
    email_sent_at: '',
    case_id: 'ONB-2026-002',
    case_status: 'collecting_documents',
    pdf_packet_status: 'pending',
    workspace_sync_status: 'pending',
    notification_status: 'email_sent',
    action_required: 'none',
    blocked_reason: '',
    drive_archived_at: '',
    slack_notified_at: '',
    case_schema_version: 2,
  },
  {
    employee_id: 'DEMO-003',
    name: '박도현',
    department: '재무회계팀',
    hire_date: '2026-06-17',
    session_status: 'COMPLETED',
    documents: signedDocuments(),
    completed_count: 6,
    all_completed_at: '',
    email_sent_at: '',
    case_id: 'ONB-2026-003',
    case_status: 'action_required',
    pdf_packet_status: 'generated',
    workspace_sync_status: 'synced',
    notification_status: 'email_sent',
    action_required: 'hr_review',
    blocked_reason: '주민등록 등본 파일명과 입사자명이 달라 HR 검토가 필요합니다.',
    drive_archived_at: '',
    slack_notified_at: '',
    case_schema_version: 2,
  },
  {
    employee_id: 'DEMO-004',
    name: '최유진',
    department: '플랫폼엔지니어링팀',
    hire_date: '2026-06-24',
    session_status: 'COMPLETED',
    documents: signedDocuments(),
    completed_count: 6,
    all_completed_at: '',
    email_sent_at: '',
    case_id: 'ONB-2026-004',
    case_status: 'failed',
    pdf_packet_status: 'generated',
    workspace_sync_status: 'failed',
    notification_status: 'failed',
    action_required: 'drive_sync_failed',
    blocked_reason: '워크스페이스 동기화 실패: 신규 입사자 조직 단위 매핑을 찾을 수 없습니다.',
    drive_archived_at: '',
    slack_notified_at: '',
    case_schema_version: 2,
  },
  {
    employee_id: 'DEMO-005',
    name: '정민서',
    department: '마케팅전략팀',
    hire_date: '2026-07-01',
    session_status: 'COMPLETED',
    documents: signedDocuments(),
    completed_count: 6,
    all_completed_at: '',
    email_sent_at: '',
    case_id: 'ONB-2026-005',
    case_status: 'docs_completed',
    pdf_packet_status: 'generated',
    workspace_sync_status: 'synced',
    notification_status: 'email_sent',
    action_required: 'none',
    blocked_reason: '',
    drive_archived_at: '',
    slack_notified_at: '',
    case_schema_version: 2,
  },
  {
    employee_id: 'DEMO-006',
    name: '한지우',
    department: '영업지원팀',
    hire_date: '2026-07-08',
    session_status: 'COMPLETED',
    documents: signedDocuments(),
    completed_count: 6,
    all_completed_at: '2026-05-17T15:20:00+09:00',
    email_sent_at: '2026-05-17T15:24:00+09:00',
    case_id: 'ONB-2026-006',
    case_status: 'archived',
    pdf_packet_status: 'generated',
    workspace_sync_status: 'synced',
    notification_status: 'both',
    action_required: 'none',
    blocked_reason: '',
    drive_archived_at: '2026-05-17T15:35:00+09:00',
    slack_notified_at: '2026-05-17T15:37:00+09:00',
    case_schema_version: 2,
  },
]

const stats: DashboardStats = {
  total: demoDashboardEmployees.length,
  completed: demoDashboardEmployees.filter(employee => employee.case_status === 'archived').length,
  in_progress: demoDashboardEmployees.filter(employee => employee.case_status === 'collecting_documents').length,
  pending: demoDashboardEmployees.filter(employee => employee.case_status === 'docs_completed').length,
  action_required: demoDashboardEmployees.filter(employee => employee.case_status === 'action_required').length,
  sync_failed: demoDashboardEmployees.filter(employee => employee.workspace_sync_status === 'failed').length,
  archive_pending: demoDashboardEmployees.filter(
    employee => employee.case_status === 'docs_completed' && employee.pdf_packet_status === 'generated' && !employee.drive_archived_at
  ).length,
  completion_rate: Math.round(
    (demoDashboardEmployees.filter(employee => employee.case_status === 'archived').length / demoDashboardEmployees.length) * 1000
  ) / 10,
}

export const demoDashboardResponse: DashboardResponse = {
  employees: demoDashboardEmployees,
  stats,
}

export const demoOnboardingEmployee: EmployeeMasterRow = {
  employee_id: 'DEMO-EMP-001',
  name: '홍길동',
  address: '서울특별시 중구 세종대로 110',
  birthday: '1990-01-01',
  phone: '01000000000',
  email: 'demo.employee@example.com',
  hire_date: '2026-06-01',
  department: '인사운영팀',
  position: '사원',
  position_name: '사원',
  pay_sec: 'monthly',
  session_status: 'PENDING',
  onboarding_link: '/login?demo=1',
  role: 'employee',
}

export const demoOnboardingPhoneDisplay = '010-0000-0000'
export const demoSignatureHash = 'demo-signature'

export const demoOnboardingDocumentStatuses = (): Record<DocumentKey, DocumentStatus> => ({
  labor_contract: DOC_STATUS.PENDING,
  personal_info_consent: DOC_STATUS.SIGNED,
  holiday_extension: DOC_STATUS.PENDING,
  data_security_pledge: DOC_STATUS.PENDING,
  compliance: DOC_STATUS.PENDING,
  overtime_work: DOC_STATUS.PENDING,
})

export const demoOnboardingDocuments = (): DocListItem[] => {
  const statuses = demoOnboardingDocumentStatuses()
  return DOCUMENT_KEYS.map((documentKey) => {
    return {
      key: documentKey,
      label: DOCUMENT_LABELS[documentKey],
      status: statuses[documentKey],
      signatureRequired: SIGNATURE_REQUIRED[documentKey],
    }
  })
}

export const demoEmployeeInfo: EmployeeInfoResponse = {
  employee_id: demoOnboardingEmployee.employee_id,
  name: demoOnboardingEmployee.name,
  department: demoOnboardingEmployee.department,
  position: demoOnboardingEmployee.position,
  hire_date: demoOnboardingEmployee.hire_date,
  onboarding_link: demoOnboardingEmployee.onboarding_link,
}

export const demoOnboardingMaterials: OnboardingMaterial[] = [
  {
    material_id: 'DEMO-MAT-001',
    title: '입사 첫날 안내',
    description: '출근 시간, 준비물, 담당자 연락처 안내',
    file_url: '/demo/sample-signed-contract.pdf',
    category: '온보딩',
    order: 1,
  },
]

export const demoSignedContractPath = '/demo/sample-signed-contract.pdf'
