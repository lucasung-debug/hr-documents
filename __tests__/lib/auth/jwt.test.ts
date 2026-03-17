import { signJwt, verifyJwt } from '@/lib/auth/jwt'

describe('JWT utilities', () => {
  const originalSecret = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-unit-tests'
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET
    } else {
      process.env.JWT_SECRET = originalSecret
    }
  })

  it('signJwt로 서명한 토큰을 verifyJwt로 검증하면 payload가 올바르게 반환됨', async () => {
    const payload = {
      employee_id: 'EMP001',
      name: '홍길동',
      phone: '010-1234-5678',
      role: 'employee' as const,
    }

    const token = await signJwt(payload)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)

    const verified = await verifyJwt(token)
    expect(verified.employee_id).toBe(payload.employee_id)
    expect(verified.name).toBe(payload.name)
    expect(verified.phone).toBe(payload.phone)
  })

  it('변조된(tampered) 토큰을 verifyJwt에 넘기면 에러가 발생함', async () => {
    const payload = {
      employee_id: 'EMP002',
      name: '김철수',
      phone: '010-9876-5432',
      role: 'employee' as const,
    }

    const token = await signJwt(payload)

    // 토큰의 signature 부분을 변조
    const parts = token.split('.')
    const tampered = `${parts[0]}.${parts[1]}.invalidsignatureXYZ`

    await expect(verifyJwt(tampered)).rejects.toThrow()
  })

  it('JWT_SECRET 환경변수가 없으면 에러가 발생함', async () => {
    delete process.env.JWT_SECRET

    await expect(
      signJwt({ employee_id: 'EMP003', name: '이영희', phone: '010-0000-0000', role: 'employee' })
    ).rejects.toThrow('JWT_SECRET environment variable is not set')
  })
})
