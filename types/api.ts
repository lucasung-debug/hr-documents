import type { DocumentKey, DocumentStatus } from './document'

// POST /api/auth/login
export interface LoginRequest {
  name: string
  phone: string
}
export interface LoginResponse {
  success: boolean
  name?: string
  error?: string
}

// POST /api/sign/capture
export interface SignCaptureRequest {
  signatureBase64: string // data:image/png;base64,...
}
export interface SignCaptureResponse {
  success: boolean
  signHash?: string
  error?: string
}

// GET /api/docs/list
export interface DocListItem {
  key: DocumentKey
  label: string
  status: DocumentStatus
  signatureRequired: boolean
}
export interface DocListResponse {
  docs: DocListItem[]
}

// POST /api/docs/consent
export interface DocConsentRequest {
  documentKey: DocumentKey
  signatureBase64?: string
}
export interface DocConsentResponse {
  success: boolean
  status?: DocumentStatus
  previewUrl?: string
  error?: string
}

// POST /api/docs/generate-pdf
export interface GeneratePdfRequest {
  documentKey: DocumentKey
  signatureBase64?: string
}
export interface GeneratePdfResponse {
  success: boolean
  previewUrl?: string
  error?: string
}

// GET /api/docs/check-all
export interface CheckAllResponse {
  allCompleted: boolean
  statuses: Record<DocumentKey, DocumentStatus>
  pending: DocumentKey[]
}

// GET /api/employee/info
export interface EmployeeInfoResponse {
  employee_id: string
  name: string
  department: string
  position: string
  hire_date: string
  onboarding_link: string
}

// POST /api/email/send
export interface EmailSendResponse {
  success: boolean
  sentAt?: string
  error?: string
}

// DELETE /api/temp/cleanup
export interface CleanupResponse {
  deletedCount: number
}

// GET /api/docs/preview
export interface DocPreviewRequest {
  documentKey: DocumentKey
}
export interface DocPreviewResponse {
  success: boolean
  pdfBase64?: string
  error?: string
}

// GET /api/employee/materials
export interface OnboardingMaterial {
  material_id: string
  title: string
  description: string
  file_url: string
  category: string
  order: number
}
export interface MaterialsResponse {
  materials: OnboardingMaterial[]
}

// Generic API error response
export interface ApiError {
  error: string
  code?: string
}
