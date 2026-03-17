import { NextRequest, NextResponse } from 'next/server'
import { getEmployeeById } from '@/lib/sheets/employee'
import { withCacheHeaders } from '@/lib/api/cache-headers'
import type { EmployeeInfoResponse } from '@/types/api'
import { createLogger } from '@/lib/logger'
import { apiFromUnknown } from '@/lib/api'

const log = createLogger('[employee/info]')

export async function GET(request: NextRequest) {
  const employeeId = request.headers.get('x-employee-id')
  if (!employeeId) {
    return NextResponse.json({ error: '인증 정보가 없습니다.' }, { status: 401 })
  }

  try {
    const result = await getEmployeeById(employeeId)
    if (!result) {
      return NextResponse.json({ error: '직원 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { employee } = result
    const response: EmployeeInfoResponse = {
      employee_id: employee.employee_id,
      name: employee.name,
      department: employee.department,
      position: employee.position,
      hire_date: employee.hire_date,
      onboarding_link: employee.onboarding_link,
    }

    return withCacheHeaders(NextResponse.json(response), 300) // 5min
  } catch (err) {
    log.error({ err }, '직원 정보 조회 중 오류가 발생했습니다.')
    return apiFromUnknown(err)
  }
}
