# 서비스 개선 세부 계획 (2026-03-16)

> 기존 P1~P3 개선 계획 + 신규 요구사항 (미리보기, 개인정보동의 페이지, 서명 위치) 통합

---

## 현재 상태 분석

### 완료된 항목 (P1~P3 계획 기준)
- [x] Task 1: 구조화된 에러 코드 정의 (`lib/errors/`)
- [x] Task 2: API 응답 헬퍼 (`lib/api/response.ts`)
- [x] Task 3: pino 로거 (`lib/logger/`)
- [x] Task 4: login route AppError 적용
- [x] Task 5: 나머지 라우트 로거 적용
- [x] Task 6: SessionStatus 상수화
- [x] Task 7: DocumentStatus 상수화
- [x] Task 8: Rate Limiting
- [x] Task 9: Jest 설정
- [x] Task 10~12: 단위 테스트 (AppError, Rate Limiter, JWT)
- [x] Task 13: UI 접근성 개선

### 현재 온보딩 플로우
```
로그인 → 전자서명 → 서류 작성(7종 동의) → 최종 확인(미리보기) → 사번 확인 → 이메일 전송
```

### 핵심 문제점
1. **개인정보 동의**: 로그인 직후 바로 동의를 받아야 하는데, 현재는 7종 서류 중 하나로 묻혀 있음
2. **미리보기**: 작성 전 미리보기(preview API)와 작성 후 미리보기(generate-pdf API) 모두 존재하나, 전체 템플릿 대상 검증 필요
3. **서명 위치**: `signature-positions.json`에 각 템플릿별 좌표가 있으나, 신규 Sheets 템플릿 기준 재캘리브레이션 필요
4. **Sheets 템플릿**: 모든 TPL_ 시트가 완성되었으므로 `USE_SHEETS_TEMPLATES=true` 전환 가능

---

## 변경된 온보딩 플로우 (목표)

```
로그인 → ★개인정보 동의 → 전자서명 → 서류 작성(6종 동의) → 최종 확인(미리보기) → 사번 확인 → 이메일 전송
```

**변경 포인트:**
- 개인정보 수집·이용 동의서(`personal_info_consent`)를 서류 작성 단계에서 분리
- 로그인 직후, 전자서명 전에 별도 전용 페이지에서 처리
- 체크박스를 통한 항목별 직접 동의 UI 구현
- 사이드바 스텝 7단계로 확장

---

## Phase 1: 개인정보 동의 전용 페이지 구현

### Task 1-1: 개인정보 동의 페이지 생성

**목표:** 로그인 직후 표시되는 전용 동의 페이지 (체크박스 기반)

**Files:**
- Create: `app/onboarding/privacy-consent/page.tsx`

**구현 상세:**
- Google Sheets `TPL_personal_info_consent` 템플릿에서 동의 항목 추출
- 각 동의 항목을 개별 체크박스로 표시:
  - 개인정보 수집 목적 동의
  - 수집 항목 확인
  - 보유·이용 기간 동의
  - 제3자 제공 동의 (해당 시)
  - 민감정보 처리 동의 (해당 시)
- **전체 동의** 체크박스 (모두 선택/해제 토글)
- 서류 내용 미리보기 영역 (PDF 뷰어 임베드)
- "동의 후 다음 단계" 버튼 → `/onboarding/signature`로 이동
- 모든 체크박스 선택 필수 (하나라도 미선택 시 버튼 비활성화)

**API 연동:**
- `GET /api/docs/preview?documentKey=personal_info_consent` 호출하여 미리보기 표시
- "동의" 시 `POST /api/docs/consent` 호출 (documentKey: personal_info_consent)
- consent 전에 서명이 없으므로, 이 단계에서는 서명 없이 동의만 기록 → 서명은 이후 단계에서 삽입

### Task 1-2: 개인정보 동의 전용 API 수정

**목표:** 서명 없이 동의만 기록할 수 있도록 consent API 분기

**Files:**
- Modify: `app/api/docs/consent/route.ts`

**구현 상세:**
- `personal_info_consent`의 경우:
  - 서명 파일이 아직 없을 수 있음 → 서명 삽입 스킵
  - Google Sheets 상태만 `signed` (혹은 새 상태 `consented`)로 업데이트
  - 체크박스 동의 내역을 Google Sheets에 기록 (선택사항)
- 이후 전자서명 단계 후, 모든 서류에 서명 삽입 시 `personal_info_consent` PDF에도 서명 삽입

### Task 1-3: 로그인 후 리다이렉트 변경

**Files:**
- Modify: `app/login/page.tsx`

**변경:**
```typescript
// 변경 전
router.push('/onboarding/signature')
// 변경 후
router.push('/onboarding/privacy-consent')
```

### Task 1-4: 사이드바 및 프로그레스바 업데이트

**Files:**
- Modify: `components/navigation/StepSidebar.tsx`
- Modify: `components/navigation/MobileProgressHeader.tsx`

**변경:**
```typescript
const STEPS = [
  { label: '본인 확인', path: '/login', step: 1 },
  { label: '개인정보 동의', path: '/onboarding/privacy-consent', step: 2 },  // NEW
  { label: '전자서명', path: '/onboarding/signature', step: 3 },
  { label: '서류 작성', path: '/onboarding/documents', step: 4 },
  { label: '최종 확인', path: '/onboarding/preview', step: 5 },
  { label: '사번 확인', path: '/onboarding/employee-id', step: 6 },
  { label: '완료', path: '/onboarding/complete', step: 7 },
]
```

### Task 1-5: 서류 목록에서 개인정보 동의서 제외

**Files:**
- Modify: `app/onboarding/documents/page.tsx`
- Modify: `components/documents/DocumentList.tsx` (필요 시)

**변경:**
- 서류 목록 표시 시 `personal_info_consent`는 "이미 동의 완료" 상태로 표시하거나 목록에서 제외
- 이미 동의된 상태이므로 재동의 불필요

---

## Phase 2: 미리보기 기능 전체 검증 및 보강

### Task 2-1: 작성 전 미리보기 (Preview API) 전체 템플릿 검증

**목표:** 7종 모든 템플릿의 작성 전 미리보기 정상 동작 확인

**Files:**
- Modify: `app/api/docs/preview/route.ts` (필요 시)

**검증 항목:**
- 각 템플릿별 `buildBaseVariables` 변수 매핑 정확성
- `{{placeholder}}` 치환이 빠짐없이 수행되는지
- 근로계약서: `pay_sec` (monthly/daily) 분기 정상 동작
- PDF 내보내기(exportSheetTabAsPdf) 품질 확인 (여백, 크기, 글꼴)
- 미리보기 모달(`DocumentPreviewModal`)에서 PDF 렌더링 정상 여부

### Task 2-2: 작성 후 미리보기 (Generate-PDF API) 보강

**목표:** 서명 삽입된 PDF의 미리보기 정상 동작

**Files:**
- Modify: `app/api/docs/generate-pdf/route.ts` (필요 시)
- Modify: `lib/pdf/puppeteer.ts` (필요 시)

**현재 동작:**
- `generatePreviewWithFallback`은 Puppeteer 대신 PDF base64를 직접 반환 (puppeteer headless가 black image 이슈)
- Preview 페이지에서 `<object type="application/pdf">` + `<iframe>` fallback으로 표시

**확인/보강:**
- 모든 7종 서명 완료 후 generate-pdf → preview 정상 표시 확인
- PDF 내 서명 이미지가 정확한 위치에 삽입되었는지 확인
- 모바일에서 PDF 미리보기가 동작하는지 확인 (iOS Safari는 `<object>` PDF 미지원 가능)
- 필요 시 PNG 렌더링 fallback 복원 또는 pdf.js 기반 렌더링 도입

### Task 2-3: DocumentCard 미리보기 UX 개선

**Files:**
- Modify: `components/documents/DocumentCard.tsx`

**개선:**
- 미리보기 로딩 상태에 스켈레톤 UI 추가
- 미리보기 완료 후 "서명 위치 표시" 시각적 안내 (선택)
- 서명 완료된 서류의 "서명된 서류 보기" 버튼 추가 (현재는 완료 시 미리보기 불가)

---

## Phase 3: 서명 위치 캘리브레이션

### Task 3-1: Sheets 기반 PDF에서 서명 좌표 재측정

**목표:** Google Sheets → PDF 내보내기 결과물에 맞는 서명 좌표 설정

**Files:**
- Modify: `config/signature-positions.json`

**작업 순서:**
1. 각 TPL_ 시트를 PDF로 내보내기 (exportSheetTabAsPdf)
2. 내보낸 PDF를 열어 서명 위치 확인 (A4 좌표계: 0,0 = 좌측 하단)
3. 각 서류별 서명란 좌표 측정:
   - `personal_info_consent`: 서명란 위치 + sheets_row 확인
   - `bank_account`: 서명란 위치 + sheets_row 확인
   - `health_certificate`: 서명란 위치 + sheets_row 확인
   - `criminal_check_consent`: 서명란 위치 + sheets_row 확인
   - `emergency_contact`: 서명란 위치 + sheets_row 확인
   - `data_security_pledge`: 서명란 위치 + sheets_row 확인
   - `labor_contract_monthly`: 서명란 4곳 위치 확인
   - `labor_contract_daily`: 서명란 3곳 위치 확인

**캘리브레이션 도구:**
```bash
# 각 템플릿의 서명 위치 자동 감지
node scripts/detect-all-signatures.mjs

# 서명 좌표 검증 (테스트 서명 삽입)
node scripts/verify-positions.mjs

# 미세 조정
node scripts/calibrate-signature.mjs
```

### Task 3-2: 서명 위치 검증 스크립트 업데이트

**Files:**
- Modify: `scripts/verify-positions.mjs` (필요 시)
- Modify: `scripts/calibrate-sheets-pdf.mjs` (필요 시)

**작업:**
- Sheets 기반 PDF에 대한 서명 검증 로직 추가
- 각 서류별 테스트 서명 삽입 후 시각적 검증
- 결과를 `config/signature-positions.json`에 반영

### Task 3-3: consent API의 서명 삽입 로직 검증

**Files:**
- Review: `app/api/docs/consent/route.ts`

**확인 항목:**
- `getSignaturePositionConfig()` → `posKey` 매핑 정확성
- 단일 위치 vs 배열 위치 (근로계약서) 처리 정상 동작
- 서명 이미지 크기(width/height)가 서명란에 적절한지
- pdf-lib의 Y축 좌표계 (하단 기준) 확인

---

## Phase 4: Sheets 템플릿 전면 전환

### Task 4-1: USE_SHEETS_TEMPLATES 기본값 변경

**Files:**
- Modify: `.env.example`
- Modify: `app/api/docs/consent/route.ts`

**변경:**
```typescript
// 변경 전
const USE_SHEETS = process.env.USE_SHEETS_TEMPLATES === 'true'
// 변경 후 (기본값 true, 레거시 모드는 명시적으로 false 설정)
const USE_SHEETS = process.env.USE_SHEETS_TEMPLATES !== 'false'
```

### Task 4-2: 템플릿 변수 매핑 완성

**Files:**
- Modify: `lib/sheets/template-variables.ts`

**확인/보강:**
- 모든 7종 서류에서 사용되는 `{{placeholder}}` 목록 정리
- 각 서류별 필요 변수가 `buildBaseVariables`에 포함되는지 확인
- 누락 변수 추가 (예: 은행명, 계좌번호 등 bank_account에 필요한 변수)
- 근로계약서 외 다른 서류에도 개별 변수가 필요한 경우 확장

### Task 4-3: 레거시 PDF 파이프라인 정리

**Files:**
- Modify: `lib/pdf/generator.ts` (deprecation 표시)
- Modify: `app/api/docs/consent/route.ts`

**작업:**
- 레거시 분기 코드에 `@deprecated` 주석 추가
- 추후 제거 계획 문서화
- `public/templates/` PDF 파일 의존 제거 (Phase B 완료 시)

---

## Phase 5: 안정성 및 UX 최종 정리

### Task 5-1: 에러 핸들링 통일

**Files:**
- All API routes

**작업:**
- 모든 API 라우트에서 `apiFromUnknown` 일관 사용 확인
- AppError 기반 에러 throw 패턴 통일
- 클라이언트 에러 메시지 한국어 일관성 확인

### Task 5-2: 이중 발송 방지

**Files:**
- Modify: `app/api/email/send/route.ts`

**작업:**
- `email_sent_at`이 이미 있는 경우 재전송 차단
- 프론트엔드에서도 전송 완료 후 버튼 비활성화 (이미 구현 확인)

### Task 5-3: 세션 만료 처리 UX

**Files:**
- Modify: `components/providers/SessionProvider.tsx`
- Modify: `middleware.ts`

**작업:**
- API 401 응답 시 자동 로그인 페이지 리다이렉트
- 세션 만료 안내 메시지 표시
- 작업 중 세션 만료 시 데이터 손실 방지 알림

### Task 5-4: 테스트 보강

**Files:**
- Create: `__tests__/lib/sheets/template.test.ts`
- Create: `__tests__/api/docs/consent.test.ts`

**작업:**
- 템플릿 변수 치환 단위 테스트
- consent API 통합 테스트 (mock Sheets API)
- 개인정보 동의 플로우 E2E 시나리오

---

## 구현 순서 (우선순위)

```
Phase 1 (개인정보 동의)  ████████████████████  최우선 — 법적 요건, 플로우 변경
Phase 3 (서명 위치)      ████████████████      높음 — 전체 서류 정상 동작 전제
Phase 2 (미리보기 검증)  ████████████████      높음 — 사용자 경험 핵심
Phase 4 (Sheets 전환)    ████████████          중간 — 이미 기반 코드 존재
Phase 5 (안정성/UX)      ████████              중간 — 운영 안정성
```

---

## 체크리스트

| Phase | Task | 설명 | 상태 |
|-------|------|------|------|
| 1 | 1-1 | 개인정보 동의 전용 페이지 생성 | ⬜ |
| 1 | 1-2 | consent API 서명 없이 동의 분기 | ⬜ |
| 1 | 1-3 | 로그인 후 리다이렉트 변경 | ⬜ |
| 1 | 1-4 | 사이드바/프로그레스바 7단계 확장 | ⬜ |
| 1 | 1-5 | 서류 목록에서 개인정보 동의 처리 | ⬜ |
| 2 | 2-1 | 작성 전 미리보기 전체 검증 | ⬜ |
| 2 | 2-2 | 작성 후 미리보기 보강 | ⬜ |
| 2 | 2-3 | DocumentCard 미리보기 UX 개선 | ⬜ |
| 3 | 3-1 | 서명 좌표 재측정 (Sheets PDF) | ⬜ |
| 3 | 3-2 | 서명 검증 스크립트 업데이트 | ⬜ |
| 3 | 3-3 | consent API 서명 삽입 로직 검증 | ⬜ |
| 4 | 4-1 | USE_SHEETS_TEMPLATES 기본값 변경 | ⬜ |
| 4 | 4-2 | 템플릿 변수 매핑 완성 | ⬜ |
| 4 | 4-3 | 레거시 PDF 파이프라인 정리 | ⬜ |
| 5 | 5-1 | 에러 핸들링 통일 | ⬜ |
| 5 | 5-2 | 이중 발송 방지 | ⬜ |
| 5 | 5-3 | 세션 만료 처리 UX | ⬜ |
| 5 | 5-4 | 테스트 보강 | ⬜ |
