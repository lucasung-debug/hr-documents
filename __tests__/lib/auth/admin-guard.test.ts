import { requireAdmin } from '@/lib/auth/admin-guard'

describe('requireAdmin', () => {
  it('admin role이면 null 반환 (통과)', () => {
    const headers = new Headers({ 'x-employee-role': 'admin' })
    expect(requireAdmin(headers)).toBeNull()
  })

  it('employee role이면 403 응답 반환', async () => {
    const headers = new Headers({ 'x-employee-role': 'employee' })
    const response = requireAdmin(headers)
    expect(response).not.toBeNull()
    expect(response!.status).toBe(403)
    const body = await response!.json()
    expect(body.error).toBe('관리자 권한이 필요합니다.')
  })

  it('role 헤더 없으면 403 응답 반환', async () => {
    const headers = new Headers()
    const response = requireAdmin(headers)
    expect(response).not.toBeNull()
    expect(response!.status).toBe(403)
  })
})
