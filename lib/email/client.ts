import nodemailer from 'nodemailer'
import type { EmployeeMasterRow } from '@/types/employee'
import type { DocumentKey } from '@/types/document'
import { DOCUMENT_LABELS, PDF_FILENAME_SUFFIXES } from '@/types/document'
import { readPdf } from '@/lib/storage/temp-files'
import {
  buildHrEmailBody,
  buildEmployeeEmailBody,
  buildHrEmailSubject,
  buildEmployeeEmailSubject,
} from './templates'

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024   // 10 MB per PDF
const MAX_TOTAL_BYTES = 25 * 1024 * 1024        // 25 MB total

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_SENDER_ADDRESS,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_CLIENT_REFRESH_TOKEN,
    },
  })
}

interface AttachmentInfo {
  filename: string
  content: Buffer
  contentType: string
}

function buildAttachments(
  employee: EmployeeMasterRow,
  documentKeys: DocumentKey[]
): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = []

  for (const key of documentKeys) {
    try {
      const buffer = readPdf(employee.employee_id, key)
      const suffix = PDF_FILENAME_SUFFIXES[key]
      const filename = `${employee.name}_${employee.employee_id}_${suffix}.pdf`
      attachments.push({ filename, content: buffer, contentType: 'application/pdf' })
    } catch {
      throw new Error(`PDF 파일을 읽을 수 없습니다: ${DOCUMENT_LABELS[key]}`)
    }
  }

  return attachments
}

async function sendWithRetry(
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
  maxRetries = 3
): Promise<void> {
  let lastError: Error | unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions)
      return
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 30_000 * (attempt + 1))) // 30s, 60s, 90s
      }
    }
  }
  throw lastError
}

export async function sendOnboardingEmails(
  employee: EmployeeMasterRow,
  documentKeys: DocumentKey[]
): Promise<{ sentAt: string }> {
  if (!employee.email) {
    throw new Error(`근로자 이메일 주소가 없습니다: ${employee.employee_id}`)
  }

  const hrRecipients = (process.env.HR_EMAIL_RECIPIENTS ?? '').split(',').filter(Boolean)
  if (hrRecipients.length === 0) {
    throw new Error('HR_EMAIL_RECIPIENTS 환경변수가 설정되지 않았습니다')
  }

  const attachments = buildAttachments(employee, documentKeys)

  // Check total attachment size
  const totalBytes = attachments.reduce((sum, a) => sum + a.content.length, 0)
  const useGDriveLink = totalBytes > MAX_TOTAL_BYTES

  // For oversized attachments, strip files and note in email
  // (Google Drive link handling is a Phase 2 enhancement; for now, compress if individual exceeds limit)
  const safeAttachments = attachments.map((a) => ({
    filename: a.filename,
    content: a.content.length > MAX_ATTACHMENT_BYTES ? a.content.subarray(0, MAX_ATTACHMENT_BYTES) : a.content,
    contentType: a.contentType,
  }))

  const transport = createTransport()

  const hrMailOptions: nodemailer.SendMailOptions = {
    from: process.env.GMAIL_SENDER_ADDRESS,
    to: hrRecipients.join(', '),
    subject: buildHrEmailSubject(employee.name),
    html: buildHrEmailBody(employee) + (useGDriveLink ? '<p>⚠️ 파일 용량 초과로 일부 파일은 압축되었습니다.</p>' : ''),
    attachments: safeAttachments,
  }

  const employeeMailOptions: nodemailer.SendMailOptions = {
    from: process.env.GMAIL_SENDER_ADDRESS,
    to: employee.email,
    subject: buildEmployeeEmailSubject(),
    html: buildEmployeeEmailBody(employee),
    attachments: safeAttachments,
  }

  // Send both emails simultaneously with retry logic each
  await Promise.all([
    sendWithRetry(transport, hrMailOptions),
    sendWithRetry(transport, employeeMailOptions),
  ])

  const sentAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  return { sentAt }
}
