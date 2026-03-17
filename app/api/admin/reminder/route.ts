import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getSheetsClient, SPREADSHEET_ID, SHEET_NAMES, withRetry } from '@/lib/sheets/client'
import nodemailer from 'nodemailer'
import { apiOk, apiError, apiFromUnknown } from '@/lib/api'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('[admin/reminder]')

const reminderSchema = z.object({
  employee_ids: z.array(z.string()).min(1, '최소 1명의 직원을 선택해주세요.'),
  message: z.string().optional(),
})

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

function buildReminderHtml(name: string, customMessage?: string): string {
  const msg = customMessage ?? '아직 제출하지 않은 입사 서류가 있습니다. 가능한 빠른 시일 내에 완료해주세요.'
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px;">
    입사 서류 제출 안내
  </h2>
  <p>${name}님 안녕하세요,</p>
  <p>${msg}</p>
  <p style="margin-top: 20px;">
    <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/login"
       style="display: inline-block; background-color: #1d4ed8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
      서류 제출하러 가기
    </a>
  </p>
  <p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
    본 메일은 자동 발송되었습니다. 이미 완료하신 경우 무시해주세요.
  </p>
</body>
</html>`
}

/**
 * POST /api/admin/reminder
 * Send reminder emails to selected employees.
 */
export async function POST(request: NextRequest) {
  const blocked = requireAdmin(request.headers)
  if (blocked) return blocked

  try {
    const body = await request.json()
    const parsed = reminderSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400)
    }

    const { employee_ids, message } = parsed.data

    // Fetch employee info for email addresses
    const sheets = getSheetsClient()
    const response = await withRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID(),
        range: `${SHEET_NAMES.EMPLOYEE_MASTER}!A2:M`,
      })
    )

    const rows = response.data.values ?? []
    const employeeMap = new Map<string, { name: string; email: string }>()
    for (const row of rows) {
      const r = row as string[]
      if (r[0] && employee_ids.includes(r[0])) {
        employeeMap.set(r[0], { name: r[1] ?? '', email: r[5] ?? '' })
      }
    }

    const transport = createTransport()
    const sent: string[] = []
    const failed: string[] = []

    for (const empId of employee_ids) {
      const emp = employeeMap.get(empId)
      if (!emp?.email) {
        failed.push(empId)
        continue
      }

      try {
        await transport.sendMail({
          from: process.env.GMAIL_SENDER_ADDRESS,
          to: emp.email,
          subject: `[입사 서류] ${emp.name}님, 미제출 서류 안내`,
          html: buildReminderHtml(emp.name, message),
        })
        sent.push(empId)
        log.info({ empId, email: emp.email }, '리마인더 발송 완료')
      } catch (err) {
        log.error({ err, empId }, '리마인더 발송 실패')
        failed.push(empId)
      }
    }

    return apiOk({ sent: sent.length, failed })
  } catch (err) {
    log.error({ err }, '리마인더 발송 중 오류')
    return apiFromUnknown(err)
  }
}
