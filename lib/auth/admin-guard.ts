import { NextResponse } from 'next/server'

/**
 * Check if the request is from an admin user.
 * Returns a 403 response if not admin, null if allowed.
 */
export function requireAdmin(headers: Headers): NextResponse | null {
  const role = headers.get('x-employee-role')
  if (role !== 'admin') {
    return NextResponse.json(
      { error: '관리자 권한이 필요합니다.' },
      { status: 403 }
    )
  }
  return null
}
