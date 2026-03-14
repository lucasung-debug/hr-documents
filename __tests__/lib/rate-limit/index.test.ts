import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

describe('rate-limit', () => {
  const key = 'test-key'

  afterEach(() => {
    resetRateLimit(key)
  })

  it('첫 번째 요청은 허용됨', () => {
    const result = checkRateLimit(key)
    expect(result.allowed).toBe(true)
    expect(result.retryAfterMs).toBe(0)
  })

  it('5회까지 모두 허용됨', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key)
      expect(result.allowed).toBe(true)
    }
  })

  it('6번째 요청은 차단되고, 7번째도 여전히 차단됨', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key)
    }
    const sixth = checkRateLimit(key)
    expect(sixth.allowed).toBe(false)
    expect(sixth.retryAfterMs).toBeGreaterThan(0)

    const seventh = checkRateLimit(key)
    expect(seventh.allowed).toBe(false)
    expect(seventh.retryAfterMs).toBeGreaterThan(0)
  })

  it('resetRateLimit 호출 후 다음 요청이 다시 허용됨', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key)
    }
    // 6번째는 차단
    const blocked = checkRateLimit(key)
    expect(blocked.allowed).toBe(false)

    // 리셋 후 다시 허용
    resetRateLimit(key)
    const result = checkRateLimit(key)
    expect(result.allowed).toBe(true)
    expect(result.retryAfterMs).toBe(0)
  })

  it('60초 윈도우 만료 후 요청이 다시 허용됨', () => {
    jest.useFakeTimers()
    try {
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key)
      }
      const blocked = checkRateLimit(key)
      expect(blocked.allowed).toBe(false)

      // 60초 + 1ms 경과
      jest.advanceTimersByTime(60_001)

      const result = checkRateLimit(key)
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })
})
