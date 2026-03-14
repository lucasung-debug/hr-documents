export const ERROR_CODES = {
  AUTH_001: 'AUTH_001', // 인증 정보 불일치
  AUTH_002: 'AUTH_002', // 이미 완료된 세션
  AUTH_003: 'AUTH_003', // 유효하지 않은 토큰
  RATE_001: 'RATE_001', // Rate limit 초과
  VAL_001:  'VAL_001',  // 입력값 유효성 검증 실패
  SERVER_001: 'SERVER_001', // 외부 서비스 오류 (Google Sheets 등)
  SERVER_002: 'SERVER_002', // 내부 서버 오류
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
