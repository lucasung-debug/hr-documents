# HR Documents Improvement Plan (P1 → P2 → P3)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 에러 핸들링 강화, 구조화된 로깅, Rate Limiting, 코드 상수화, API 응답 표준화, 테스트 추가, 접근성 개선을 단계별로 적용한다.

**Architecture:** 기존 Next.js 14 App Router + TypeScript 구조를 유지하면서, 공통 유틸리티 레이어(lib/errors, lib/logger, lib/rate-limit)를 먼저 구축하고, 이후 각 API 라우트와 컴포넌트에 적용한다. 새 패키지는 pino(로깅), Jest + testing-library(테스트)만 추가한다.

**Tech Stack:** Next.js 14, TypeScript 5.4, pino, Jest, @testing-library/react, in-memory Map(rate limiting)

**Project Root:** `hr-documents-main/` (이 플랜의 모든 경로는 이 디렉토리 기준)

---

## P1 작업 — 에러 핸들링 · 로깅 · 자동 정리

---

### Task 1: 구조화된 에러 코드 정의

에러 메시지를 코드 곳곳에 흩어진 한국어 문자열 대신, 중앙 집중식 에러 코드로 관리한다.

**Files:**
- Create: `lib/errors/codes.ts`
- Create: `lib/errors/AppError.ts`
- Create: `lib/errors/index.ts`

**Step 1: lib/errors/codes.ts 작성**

```typescript
// lib/errors/codes.ts
export const ERROR_CODES = {
  // Auth
  AUTH_INVALID_INPUT: 'AUTH_001',
  AUTH_EMPLOYEE_NOT_FOUND: 'AUTH_002',
  AUTH_ALREADY_COMPLETED: 'AUTH_003',
  AUTH_TOKEN_MISSING: 'AUTH_004',
  AUTH_TOKEN_EXPIRED: 'AUTH_005',

  // Document
  DOC_INVALID_KEY: 'DOC_001',
  DOC_NOT_FOUND: 'DOC_002',
  DOC_ALREADY_SIGNED: 'DOC_003',

  // PDF
  PDF_GENERATION_FAILED: 'PDF_001',
  PDF_TEMPLATE_NOT_FOUND: 'PDF_002',

  // Email
  EMAIL_SEND_FAILED: 'EMAIL_001',

  // Sheets
  SHEETS_READ_FAILED: 'SHEETS_001',
  SHEETS_WRITE_FAILED: 'SHEETS_002',

  // Server
  SERVER_INTERNAL: 'SERVER_001',
  RATE_LIMIT_EXCEEDED: 'SERVER_002',
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
```

**Step 2: lib/errors/AppError.ts 작성**

```typescript
// lib/errors/AppError.ts
import type { ErrorCode } from './codes'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly message: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

**Step 3: lib/errors/index.ts 작성**

```typescript
// lib/errors/index.ts
export { ERROR_CODES } from './codes'
export type { ErrorCode } from './codes'
export { AppError } from './AppError'
```

**Step 4: 커밋**

```bash
git add lib/errors/
git commit -m "feat: add structured error codes and AppError class"
```

---

### Task 2: API 라우트 공통 응답 헬퍼

모든 API 라우트에서 일관된 성공/실패 응답을 반환하는 헬퍼를 만든다.

**Files:**
- Create: `lib/api/response.ts`

**Step 1: lib/api/response.ts 작성**

```typescript
// lib/api/response.ts
import { NextResponse } from 'next/server'
import type { AppError } from '@/lib/errors/AppError'
import { ERROR_CODES } from '@/lib/errors/codes'

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export function apiError(
  message: string,
  status: number,
  code: string = ERROR_CODES.SERVER_INTERNAL
): NextResponse {
  return NextResponse.json({ error: message, code }, { status })
}

export function apiFromAppError(err: AppError): NextResponse {
  return apiError(err.message, err.statusCode, err.code)
}

export function apiFromUnknown(err: unknown): NextResponse {
  if (err instanceof AppError) return apiFromAppError(err)
  return apiError('서버 오류가 발생했습니다.', 500, ERROR_CODES.SERVER_INTERNAL)
}
```

**Step 2: 커밋**

```bash
git add lib/api/
git commit -m "feat: add api response helpers (apiOk, apiError, apiFromAppError)"
```

---

### Task 3: 구조화된 로거 추가 (pino)

`console.log` / `console.error` 를 pino 기반 구조화 로거로 교체한다.

**Files:**
- Modify: `package.json` (pino, pino-pretty 추가)
- Create: `lib/logger/index.ts`

**Step 1: pino 설치**

```bash
cd hr-documents-main
npm install pino pino-pretty
npm install --save-dev @types/pino
```

실행 후 `package.json`의 `dependencies`에 `"pino"` 가 추가되었는지 확인.

**Step 2: lib/logger/index.ts 작성**

```typescript
// lib/logger/index.ts
import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    },
  }),
})

// 컨텍스트가 있는 자식 로거 생성
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context)
}
```

**Step 3: login route에 로거 적용**

`app/api/auth/login/route.ts` 파일 상단에 import 추가:

```typescript
import { logger } from '@/lib/logger'
```

기존 `console.error` 교체:
```typescript
// 변경 전
console.error('[login] error:', err instanceof Error ? err.message : 'unknown')

// 변경 후
logger.error({ err, route: 'POST /api/auth/login' }, 'Login failed')
```

로그인 성공 시 info 로그 추가 (token 발급 직전):
```typescript
logger.info({ employee_id: employee.employee_id, route: 'POST /api/auth/login' }, 'Login successful')
```

**Step 4: scheduler.ts에 로거 적용**

`lib/storage/scheduler.ts` 의 console 호출 교체:

```typescript
// 변경 전
console.error(`[scheduler] Failed to delete session dir: ${sessionId.slice(0, 8)}...`)
console.log(`[scheduler] Cleaned up ${deleted} expired session(s)`)
console.log('[scheduler] Session cleanup scheduler started (interval: 5min, timeout: 30min)')

// 변경 후 (파일 상단에 import 추가)
import { logger } from '@/lib/logger'

// 에러
logger.warn({ sessionId: sessionId.slice(0, 8) }, 'Failed to delete session dir')
// 정리 완료
logger.info({ deleted }, 'Session cleanup completed')
// 스케줄러 시작
logger.info({ intervalMs: SCAN_INTERVAL_MS, timeoutMs: SESSION_TIMEOUT_MS }, 'Session cleanup scheduler started')
```

**Step 5: 커밋**

```bash
git add lib/logger/ lib/storage/scheduler.ts app/api/auth/login/route.ts package.json package-lock.json
git commit -m "feat: add pino structured logger, replace console.log in login and scheduler"
```

---

### Task 4: login route에 AppError 적용

login route의 에러 처리를 AppError + 응답 헬퍼로 교체한다.

**Files:**
- Modify: `app/api/auth/login/route.ts`

**Step 1: 현재 route.ts 전체 교체**

```typescript
import { NextRequest } from 'next/server'
import { loginSchema } from '@/lib/validators/input'
import { findEmployeeByNameAndPhone, updateSessionStatus } from '@/lib/sheets/employee'
import { findDocStatusByEmployeeId, initDocStatusRow } from '@/lib/sheets/document-status'
import { signJwt } from '@/lib/auth/jwt'
import { ensureSessionDir } from '@/lib/storage/temp-files'
import { AppError, ERROR_CODES } from '@/lib/errors'
import { apiOk, apiError, apiFromUnknown } from '@/lib/api/response'
import { createLogger } from '@/lib/logger'

const log = createLogger({ route: 'POST /api/auth/login' })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400, ERROR_CODES.AUTH_INVALID_INPUT)
    }

    const { name, phone } = parsed.data

    const result = await findEmployeeByNameAndPhone(name, phone)
    if (!result) {
      log.warn({ name }, 'Employee not found')
      return apiError('이름 또는 휴대전화번호가 일치하지 않습니다.', 401, ERROR_CODES.AUTH_EMPLOYEE_NOT_FOUND)
    }

    const { employee, rowIndex } = result

    if (employee.session_status === 'COMPLETED') {
      return apiError('이미 서류 제출이 완료된 계정입니다.', 409, ERROR_CODES.AUTH_ALREADY_COMPLETED)
    }

    await updateSessionStatus(rowIndex, 'IN_PROGRESS')

    const existingStatus = await findDocStatusByEmployeeId(employee.employee_id)
    if (!existingStatus) {
      await initDocStatusRow(employee.employee_id, employee.name, employee.phone)
    }

    ensureSessionDir(employee.employee_id)

    const token = await signJwt({
      employee_id: employee.employee_id,
      name: employee.name,
      phone: employee.phone,
    })

    log.info({ employee_id: employee.employee_id }, 'Login successful')

    const response = apiOk({ success: true, name: employee.name })
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 60,
    })

    return response
  } catch (err) {
    log.error({ err }, 'Login error')
    return apiFromUnknown(err)
  }
}
```

**Step 2: 커밋**

```bash
git add app/api/auth/login/route.ts
git commit -m "refactor: apply AppError and response helpers to login route"
```

---

### Task 5: 나머지 API 라우트에 로거 적용

나머지 라우트들의 `console.error` 를 logger로 교체한다.

**Files:**
- Modify: `app/api/docs/list/route.ts`
- Modify: `app/api/docs/consent/route.ts`
- Modify: `app/api/docs/generate-pdf/route.ts`
- Modify: `app/api/docs/check-all/route.ts`
- Modify: `app/api/sign/capture/route.ts`
- Modify: `app/api/email/send/route.ts`
- Modify: `app/api/employee/info/route.ts`
- Modify: `app/api/temp/cleanup/route.ts`

**Step 1: 각 파일 상단에 logger import 추가**

각 파일에서:
```typescript
// 추가
import { createLogger } from '@/lib/logger'
import { apiOk, apiFromUnknown } from '@/lib/api/response'

const log = createLogger({ route: '[메서드] /api/[경로]' })
```

**Step 2: 각 파일의 catch 블록 교체 패턴**

```typescript
// 변경 전
} catch (err) {
  console.error('[route] error:', err)
  return NextResponse.json({ error: '...' }, { status: 500 })
}

// 변경 후
} catch (err) {
  log.error({ err }, '[설명] failed')
  return apiFromUnknown(err)
}
```

**Step 3: 커밋**

```bash
git add app/api/
git commit -m "refactor: replace console.error with structured logger across all API routes"
```

---

## P2 작업 — Magic String 제거 · 응답 표준화 · Rate Limiting

---

### Task 6: SessionStatus 상수 객체 추가

`'PENDING'`, `'IN_PROGRESS'`, `'COMPLETED'` 문자열 리터럴을 상수로 참조할 수 있도록 한다.

**Files:**
- Modify: `types/employee.ts`

**Step 1: SESSION_STATUS 상수 추가**

`types/employee.ts` 에 아래 코드를 타입 정의 위에 추가:

```typescript
// 변경 전 (파일 첫 줄)
export type SessionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

// 변경 후
export const SESSION_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const

export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS]
```

**Step 2: 사용처 교체**

`app/api/auth/login/route.ts` 에서:
```typescript
// 변경 전
if (employee.session_status === 'COMPLETED') {

// 변경 후
import { SESSION_STATUS } from '@/types/employee'
if (employee.session_status === SESSION_STATUS.COMPLETED) {
```

`lib/sheets/employee.ts` 에서 `updateSessionStatus` 호출부:
```typescript
// 변경 전
await updateSessionStatus(rowIndex, 'IN_PROGRESS')

// 변경 후
await updateSessionStatus(rowIndex, SESSION_STATUS.IN_PROGRESS)
```

**Step 3: 커밋**

```bash
git add types/employee.ts app/api/auth/login/route.ts lib/sheets/employee.ts
git commit -m "refactor: add SESSION_STATUS constant, replace magic string literals"
```

---

### Task 7: DocumentStatus 상수 객체 추가

`'pending'`, `'signed'`, `'sent'` 도 동일하게 상수로 관리한다.

**Files:**
- Modify: `types/document.ts`

**Step 1: DOC_STATUS 상수 추가**

`types/document.ts` 의 `DocumentStatus` 타입을 교체:

```typescript
// 변경 전
export type DocumentStatus = 'pending' | 'signed' | 'sent'

// 변경 후
export const DOC_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  SENT: 'sent',
} as const

export type DocumentStatus = typeof DOC_STATUS[keyof typeof DOC_STATUS]
```

**Step 2: lib/sheets/document-status.ts 사용처 교체**

`document-status.ts` 파일에서 `'pending'`, `'signed'`, `'sent'` 리터럴을 `DOC_STATUS.PENDING` 등으로 교체한다.

**Step 3: 커밋**

```bash
git add types/document.ts lib/sheets/document-status.ts
git commit -m "refactor: add DOC_STATUS constant for document status values"
```

---

### Task 8: Rate Limiting (로그인 엔드포인트 보호)

동일 IP에서 5회 이상 로그인 실패 시 1분간 차단하는 인메모리 Rate Limiter를 구현한다.

**Files:**
- Create: `lib/rate-limit/index.ts`
- Modify: `app/api/auth/login/route.ts`

**Step 1: lib/rate-limit/index.ts 작성**

```typescript
// lib/rate-limit/index.ts

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 1000 // 1분

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}

export function resetRateLimit(key: string): void {
  store.delete(key)
}
```

**Step 2: login route에 rate limit 적용**

`app/api/auth/login/route.ts` 에서 `safeParse` 검사 직전에 추가:

```typescript
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

// safeParse 전에 삽입
const ip = request.headers.get('x-forwarded-for') ?? request.ip ?? 'unknown'
const { allowed, retryAfterMs } = checkRateLimit(`login:${ip}`)
if (!allowed) {
  log.warn({ ip }, 'Rate limit exceeded')
  return apiError(
    `요청이 너무 많습니다. ${Math.ceil(retryAfterMs / 1000)}초 후 다시 시도해주세요.`,
    429,
    ERROR_CODES.RATE_LIMIT_EXCEEDED
  )
}
```

로그인 성공 시 카운터 리셋:
```typescript
// log.info 전에 추가
resetRateLimit(`login:${ip}`)
```

**Step 3: 커밋**

```bash
git add lib/rate-limit/ app/api/auth/login/route.ts
git commit -m "feat: add in-memory rate limiter for login endpoint (5 attempts / 1min)"
```

---

## P3 작업 — 테스트 · 접근성

---

### Task 9: Jest + Testing Library 설정

**Files:**
- Modify: `package.json`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

**Step 1: 패키지 설치**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest ts-jest
```

**Step 2: jest.config.ts 작성**

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFilesAfterFramework: ['./jest.setup.ts'],
}

export default config
```

**Step 3: jest.setup.ts 작성**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

**Step 4: package.json scripts에 test 추가**

`"scripts"` 에 아래 항목 추가:
```json
"test": "jest",
"test:watch": "jest --watch"
```

**Step 5: 커밋**

```bash
git add jest.config.ts jest.setup.ts package.json package-lock.json
git commit -m "chore: add Jest + Testing Library setup"
```

---

### Task 10: AppError 단위 테스트

**Files:**
- Create: `__tests__/lib/errors/AppError.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
// __tests__/lib/errors/AppError.test.ts
import { AppError } from '@/lib/errors/AppError'
import { ERROR_CODES } from '@/lib/errors/codes'

describe('AppError', () => {
  it('should store code, message, and statusCode', () => {
    const err = new AppError(ERROR_CODES.AUTH_EMPLOYEE_NOT_FOUND, '직원을 찾을 수 없습니다.', 401)
    expect(err.code).toBe('AUTH_002')
    expect(err.message).toBe('직원을 찾을 수 없습니다.')
    expect(err.statusCode).toBe(401)
    expect(err.name).toBe('AppError')
  })

  it('should default statusCode to 500', () => {
    const err = new AppError(ERROR_CODES.SERVER_INTERNAL, '서버 오류')
    expect(err.statusCode).toBe(500)
  })

  it('should be instanceof Error', () => {
    const err = new AppError(ERROR_CODES.SERVER_INTERNAL, '오류')
    expect(err).toBeInstanceOf(Error)
  })
})
```

**Step 2: 테스트 실행**

```bash
npm test -- __tests__/lib/errors/AppError.test.ts
```

Expected: 3개 PASS

**Step 3: 커밋**

```bash
git add __tests__/
git commit -m "test: add AppError unit tests"
```

---

### Task 11: Rate Limiter 단위 테스트

**Files:**
- Create: `__tests__/lib/rate-limit/index.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
// __tests__/lib/rate-limit/index.test.ts
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  afterEach(() => {
    resetRateLimit('test-key')
  })

  it('should allow first request', () => {
    const result = checkRateLimit('test-key')
    expect(result.allowed).toBe(true)
  })

  it('should allow up to MAX_ATTEMPTS requests', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('test-key').allowed).toBe(true)
    }
  })

  it('should block after MAX_ATTEMPTS exceeded', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('test-key')
    const result = checkRateLimit('test-key')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('should reset after calling resetRateLimit', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('test-key')
    resetRateLimit('test-key')
    expect(checkRateLimit('test-key').allowed).toBe(true)
  })
})
```

**Step 2: 테스트 실행**

```bash
npm test -- __tests__/lib/rate-limit/index.test.ts
```

Expected: 4개 PASS

**Step 3: 커밋**

```bash
git add __tests__/lib/rate-limit/
git commit -m "test: add rate limiter unit tests"
```

---

### Task 12: JWT 유틸 단위 테스트

**Files:**
- Create: `__tests__/lib/auth/jwt.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
// __tests__/lib/auth/jwt.test.ts
import { signJwt, verifyJwt } from '@/lib/auth/jwt'

describe('JWT', () => {
  beforeAll(() => {
    // 테스트용 secret 설정
    process.env.JWT_SECRET = 'a'.repeat(64)
  })

  it('should sign and verify a payload', async () => {
    const payload = { employee_id: 'EMP001', name: '홍길동', phone: '01012345678' }
    const token = await signJwt(payload)
    const verified = await verifyJwt(token)
    expect(verified.employee_id).toBe('EMP001')
    expect(verified.name).toBe('홍길동')
  })

  it('should reject a tampered token', async () => {
    const token = await signJwt({ employee_id: 'EMP001', name: '홍길동', phone: '01012345678' })
    await expect(verifyJwt(token + 'tampered')).rejects.toThrow()
  })

  it('should throw if JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    expect(() => verifyJwt('any')).rejects.toThrow('JWT_SECRET')
    process.env.JWT_SECRET = original
  })
})
```

**Step 2: 테스트 실행**

```bash
npm test -- __tests__/lib/auth/jwt.test.ts
```

Expected: 3개 PASS

**Step 3: 커밋**

```bash
git add __tests__/lib/auth/
git commit -m "test: add JWT sign/verify unit tests"
```

---

### Task 13: UI 컴포넌트 접근성 개선

Button, Input, Modal 컴포넌트에 aria 속성을 추가한다.

**Files:**
- Modify: `components/ui/Button.tsx`
- Modify: `components/ui/Input.tsx`
- Modify: `components/ui/Modal.tsx`

**Step 1: Button.tsx — aria-label prop 추가**

```typescript
// components/ui/Button.tsx
// Props interface에 aria-label 추가
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
}
```

`HTMLButtonElement`를 상속하면 `aria-label`, `aria-describedby` 등이 자동으로 포함된다. 이미 상속 중이라면 스킵.

**Step 2: Input.tsx — label 연결**

`Input` 컴포넌트에 `id` prop이 있다면, label 과 `htmlFor`를 연결하는 예시:

```typescript
// components/ui/Input.tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, id, error, ...props }: InputProps) {
  return (
    <div>
      {label && <label htmlFor={id} className="block text-sm font-medium mb-1">{label}</label>}
      <input
        id={id}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
        {...props}
      />
      {error && <p id={`${id}-error`} className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  )
}
```

**Step 3: Modal.tsx — role과 aria-modal 추가**

Modal 최상위 div에:
```typescript
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  ...
>
  <h2 id="modal-title">...</h2>
```

**Step 4: login 페이지에서 Input 사용 시 id + label 연결**

`app/login/page.tsx` 의 Input 필드:
```typescript
<Input
  id="name"
  label="이름"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="홍길동"
/>
<Input
  id="phone"
  label="휴대전화번호"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  placeholder="01012345678"
/>
```

**Step 5: 커밋**

```bash
git add components/ui/ app/login/
git commit -m "feat: improve accessibility - add aria attributes, label associations"
```

---

## 완료 체크리스트

| 우선순위 | 작업 | 상태 |
|---------|------|------|
| P1 | Task 1: 에러 코드 정의 | ⬜ |
| P1 | Task 2: API 응답 헬퍼 | ⬜ |
| P1 | Task 3: pino 로거 추가 | ⬜ |
| P1 | Task 4: login route 리팩토링 | ⬜ |
| P1 | Task 5: 나머지 라우트 로거 적용 | ⬜ |
| P2 | Task 6: SessionStatus 상수화 | ⬜ |
| P2 | Task 7: DocumentStatus 상수화 | ⬜ |
| P2 | Task 8: Rate Limiting | ⬜ |
| P3 | Task 9: Jest 설정 | ⬜ |
| P3 | Task 10: AppError 테스트 | ⬜ |
| P3 | Task 11: Rate Limiter 테스트 | ⬜ |
| P3 | Task 12: JWT 테스트 | ⬜ |
| P3 | Task 13: 접근성 개선 | ⬜ |
