import { NextRequest } from 'next/server'
import { loginSchema } from '@/lib/validators/input'
import { findEmployeeByNameAndPhone, updateSessionStatus } from '@/lib/sheets/employee'
import { SESSION_STATUS } from '@/types/employee'
import {
  findDocStatusByEmployeeId,
  initDocStatusRow,
  resetDocStatuses,
} from '@/lib/sheets/document-status'
import { signJwt } from '@/lib/auth/jwt'
import { ensureSessionDir, deleteSessionDir } from '@/lib/storage/temp-files'
import { createLogger } from '@/lib/logger'
import { ERROR_CODES } from '@/lib/errors'
import { apiOk, apiError, apiFromUnknown } from '@/lib/api'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

const log = createLogger('login')

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
    const { allowed, retryAfterMs } = checkRateLimit(`login:${ip}`)

    if (!allowed) {
      log.warn({ ip, retryAfterMs }, 'Rate limit exceeded for login')
      return apiError('너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.', 429, ERROR_CODES.RATE_001)
    }

    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400, ERROR_CODES.VAL_001)
    }

    const { name, phone } = parsed.data

    const result = await findEmployeeByNameAndPhone(name, phone)
    if (!result) {
      log.warn({ name }, 'Login attempt with invalid credentials')
      return apiError('이름 또는 휴대전화번호가 일치하지 않습니다.', 401, ERROR_CODES.AUTH_001)
    }

    const { employee, rowIndex } = result

    if (employee.session_status === SESSION_STATUS.COMPLETED) {
      log.warn({ employeeId: employee.employee_id }, 'Login attempt on completed session')
      return apiError('이미 서류 제출이 완료된 계정입니다.', 409, ERROR_CODES.AUTH_002)
    }

    // Update session status to IN_PROGRESS
    await updateSessionStatus(rowIndex, SESSION_STATUS.IN_PROGRESS)

    // Ensure document status row exists, reset if re-login
    const existingStatus = await findDocStatusByEmployeeId(employee.employee_id)
    if (!existingStatus) {
      await initDocStatusRow(employee.employee_id, employee.name, employee.phone)
    } else {
      log.info({ employeeId: employee.employee_id }, 'Resetting document statuses for re-login')
      await resetDocStatuses(existingStatus.rowIndex)
    }

    // Clean previous session files and create fresh directory
    deleteSessionDir(employee.employee_id)
    ensureSessionDir(employee.employee_id)

    // Issue JWT (30 min expiry, set by signJwt)
    const token = await signJwt({
      employee_id: employee.employee_id,
      name: employee.name,
      phone: employee.phone,
    })

    log.info({ employeeId: employee.employee_id }, 'Login successful')
    resetRateLimit(`login:${ip}`)

    const response = apiOk({ success: true, name: employee.name })
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 60, // 30 minutes
    })

    return response
  } catch (err) {
    return apiFromUnknown(err)
  }
}
