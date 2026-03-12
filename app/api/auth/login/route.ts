import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validators/input'
import { findEmployeeByNameAndPhone, updateSessionStatus } from '@/lib/sheets/employee'
import {
  findDocStatusByEmployeeId,
  initDocStatusRow,
} from '@/lib/sheets/document-status'
import { signJwt } from '@/lib/auth/jwt'
import { ensureSessionDir } from '@/lib/storage/temp-files'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, phone } = parsed.data

    const result = await findEmployeeByNameAndPhone(name, phone)
    if (!result) {
      return NextResponse.json(
        { error: '이름 또는 휴대전화번호가 일치하지 않습니다.' },
        { status: 401 }
      )
    }

    const { employee, rowIndex } = result

    if (employee.session_status === 'COMPLETED') {
      return NextResponse.json(
        { error: '이미 서류 제출이 완료된 계정입니다.' },
        { status: 409 }
      )
    }

    // Update session status to IN_PROGRESS
    await updateSessionStatus(rowIndex, 'IN_PROGRESS')

    // Ensure document status row exists
    const existingStatus = await findDocStatusByEmployeeId(employee.employee_id)
    if (!existingStatus) {
      await initDocStatusRow(employee.employee_id, employee.name, employee.phone)
    }

    // Create temp session directory
    ensureSessionDir(employee.employee_id)

    // Issue JWT (30 min expiry, set by signJwt)
    const token = await signJwt({
      employee_id: employee.employee_id,
      name: employee.name,
      phone: employee.phone,
    })

    const response = NextResponse.json({ success: true, name: employee.name })
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 60, // 30 minutes
    })

    return response
  } catch (err) {
    console.error('[login] error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
