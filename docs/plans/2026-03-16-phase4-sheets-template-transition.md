# Phase 4: Sheets 템플릿 전면 전환 (Sheets Templates Full Transition)

## Executive Summary

Phase 4 전환은 Sheets 템플릿을 선택지에서 **기본값**으로 만드는 단계입니다.

**현재 상태:**
- Sheets 템플릿은 `USE_SHEETS_TEMPLATES=true`로 명시해야만 작동 (opt-in)
- 66% 변수 매핑 완료, 5개 변수 누락
- 레거시 PDF 파이프라인이 여전히 production에 포함됨

**목표:**
- Sheets를 기본값으로 설정 (opt-out)
- 누락된 5개 변수 매핑 완성
- 레거시 파이프라인 deprecation 표시

**소요 시간:** 약 3-4시간

---

## 3개 Task 개요

### Task 4-1: USE_SHEETS_TEMPLATES 기본값 변경
- 현재: `USE_SHEETS_TEMPLATES === 'true'` (opt-in)
- 변경: `USE_SHEETS_TEMPLATES !== 'false'` (opt-out)
- 효과: 미설정 시 Sheets 사용, `false` 지정시만 레거시 PDF

### Task 4-2: 템플릿 변수 매핑 완성
- EMPLOYEE_CONTRACT 확장 (5개 새 컬럼)
- 누락 변수: benefits, probation_period, special_terms, bank_name, account_number
- 전략: 선택사항으로 추가 (없으면 빈 문자열)

### Task 4-3: 레거시 PDF 파이프라인 Deprecation
- @deprecated 주석 추가
- 로깅 추가 (여전히 사용 시)
- 문서화: 마이그레이션 가이드

---

## Task 4-1: USE_SHEETS_TEMPLATES 기본값 변경

### 목표
새로운 배포에서 Sheets가 기본 엔진이 되도록 설정

### 수정 파일

#### 1. `.env.example` (설정 문서화)
**변경:**
- `USE_SHEETS_TEMPLATES=true` → 주석 업데이트
- 마이그레이션 노트 추가: "Phase 4부터 Sheets가 기본. 레거시 PDF만 사용하려면 'false' 설정"

#### 2. `app/api/docs/consent/route.ts` (라인 23)
**변경:**
```typescript
// 변경 전
const USE_SHEETS = process.env.USE_SHEETS_TEMPLATES === 'true'

// 변경 후
const USE_SHEETS = process.env.USE_SHEETS_TEMPLATES !== 'false'
```

**효과:**
- 미설정: `undefined !== 'false'` → true (Sheets 사용)
- `'true'`: `'true' !== 'false'` → true (Sheets 사용)
- `'false'`: `'false' !== 'false'` → false (레거시 PDF)

### 구현 순서
1. 코드 변경 (opt-out 로직)
2. .env.example 업데이트 (문서화)
3. 주석 추가: "Phase 4: Sheets Templates Default"
4. TypeScript 타입 검증
5. 테스트 및 커밋

### 예상 결과
- 새로운 배포: Sheets 기본
- 기존 배포: `USE_SHEETS_TEMPLATES=false`로 레거시 유지 가능
- 단계적 마이그레이션 가능

---

## Task 4-2: 템플릿 변수 매핑 완성

### 현재 상태
**완료된 변수 (66%):**
- 기본: employee_name, department, position, hire_date, birthday, address
- 날짜: date_yy/mm/dd, hire_date_yy/mm/dd
- 계약: salary_basic, salary_OT, salary_fix, salary_total, work_hours
- 서명: signature (빈 문자열)

**누락된 변수 (34%):**
- `{{salary}}` - labor_contract에서 사용
- `{{benefits}}` - labor_contract (복리후생)
- `{{probation_period}}` - labor_contract (수습기간)
- `{{special_terms}}` - labor_contract (특수조건)
- `{{bank_name}}`, `{{account_number}}` - bank_account

### 해결책: EMPLOYEE_CONTRACT 확장

#### Step 1: 새 컬럼 추가
**Google Sheets: EMPLOYEE_CONTRACT**
```
기존 컬럼 A-K:
  A: employee_id
  B: name
  C: hire_date
  D: intern_date
  E: position
  F: pay_sec
  G: salary_basic
  H: salary_OT
  I: salary_fix
  J: salary_total
  K: work_hours

추가 컬럼 (Phase 4):
  L: benefits (선택, 예: "월 50만원 건강보험 + 퇴직금")
  M: probation_period (선택, 예: "3개월")
  N: special_terms (선택, 계약서 특수항목)
  O: bank_name (선택, 예: "국민은행")
  P: account_number (선택, 예: "123-456-7890")
```

#### Step 2: ContractConditions 인터페이스 확장
**파일:** `lib/sheets/contract.ts`

```typescript
// 변경 전
interface ContractConditions {
  position: string
  salary_basic: string
  salary_OT: string
  salary_fix: string
  salary_total: string
  work_hours: string
  intern_date_yy: string
  intern_date_mm: string
  intern_date_dd: string
}

// 변경 후
interface ContractConditions {
  // 기존 필드...
  position: string
  salary_basic: string
  salary_OT: string
  salary_fix: string
  salary_total: string
  work_hours: string
  intern_date_yy: string
  intern_date_mm: string
  intern_date_dd: string

  // 새 필드 (선택사항)
  benefits?: string
  probation_period?: string
  special_terms?: string
  bank_name?: string
  account_number?: string
}
```

#### Step 3: rowToConditions 함수 업데이트
**파일:** `lib/sheets/contract.ts`

```typescript
// EMPLOYEE_CONTRACT 행을 ContractConditions로 변환
// 새 컬럼 L-P 매핑 추가
// row[11] = benefits, row[12] = probation_period, ...
// 기본값: row[idx] ?? '' (컬럼 없으면 빈 문자열)
```

#### Step 4: buildContractVariables 확장
**파일:** `lib/sheets/template-variables.ts`

```typescript
export function buildContractVariables(conditions: ContractConditions): Record<string, string> {
  return {
    // 기존 필드
    position: conditions.position,
    salary_basic: conditions.salary_basic,
    // ...

    // 새 필드 (Phase 4)
    salary: conditions.salary_basic, // {{salary}} → salary_basic
    benefits: conditions.benefits ?? '',
    probation_period: conditions.probation_period ?? '',
    special_terms: conditions.special_terms ?? '',
  }
}
```

#### Step 5: buildBankVariables 함수 생성
**파일:** `lib/sheets/template-variables.ts` 또는 신규 파일

```typescript
export function buildBankVariables(conditions: ContractConditions): Record<string, string> {
  return {
    bank_name: conditions.bank_name ?? '',
    account_number: conditions.account_number ?? '',
  }
}
```

#### Step 6: consent/route.ts 업데이트
**파일:** `app/api/docs/consent/route.ts`

```typescript
// Sheets 파이프라인에서 (라인 63-100)
const conditions = await getContractConditions(employeeId)
const variables = buildBaseVariables(employee)

// 근로계약서: buildContractVariables 호출
if (documentKey === 'labor_contract' && conditions) {
  Object.assign(variables, buildContractVariables(conditions))
}

// 계좌 신청서: buildBankVariables 호출 (조건이 있으면)
if (documentKey === 'bank_account' && conditions) {
  Object.assign(variables, buildBankVariables(conditions))
}
```

### 구현 순서
1. ContractConditions 인터페이스 확장
2. rowToConditions 함수 업데이트
3. buildContractVariables 확장
4. buildBankVariables 함수 생성
5. consent/route.ts 통합
6. 타입 검증
7. 테스트

### 예상 결과
- 모든 7개 문서가 완전한 변수 참조 가능
- 누락된 데이터: 에러 없음 → 빈 필드 표시
- 하위호환성: 기존 스프레드시트도 작동 (새 컬럼 무시)
- HR팀: 시간 남을 때 선택사항 필드 채우기 가능

---

## Task 4-3: 레거시 PDF 파이프라인 Deprecation

### 목표
레거시 PDF 코드가 deprecated이지만 여전히 functional하다는 신호

### 수정 파일

#### 1. `lib/pdf/generator.ts` (라인 13)
**변경: JSDoc 주석 추가**
```typescript
/**
 * Generate a signed PDF from a legacy template file.
 *
 * @deprecated Phase 4: Use Sheets pipeline via generatePdfFromTemplate instead.
 * This function is retained for backward compatibility and fallback scenarios.
 * Legacy PDF support will be removed in a future version.
 * See: https://github.com/yourorg/hr-documents/issues/phase4-sheets-transition
 */
export async function generateSignedPdf(
  employeeId: string,
  documentKey: DocumentKey,
  signatureBuffer: Buffer
): Promise<PdfGenerationResult> {
```

#### 2. `lib/pdf/generator.ts` 내부
**변경: deprecation 로그 추가**
```typescript
export async function generateSignedPdf(...) {
  log.warn('[DEPRECATED] Using legacy PDF pipeline for document: %s', documentKey)
  log.warn('Phase 4: Consider migrating to Sheets pipeline (USE_SHEETS_TEMPLATES)')

  // 나머지 코드는 변경 없음
}
```

#### 3. `lib/pdf/signature-config.ts`
**변경: 주석 추가**
```typescript
/**
 * Load signature position configuration.
 *
 * @note These coordinates are optimized for legacy PDF templates.
 *       Phase 3 will recalibrate positions for Sheets-generated PDFs.
 */
export function getSignaturePositionConfig(): SignaturePositionConfig {
```

#### 4. 새 파일: `docs/DEPRECATION.md`
**생성: 마이그레이션 가이드**
```markdown
# Deprecation Guide: Legacy PDF Pipeline

## Timeline
- **Phase 4 (Now)**: Legacy PDFs marked as deprecated; warning logs emitted
- **Phase 5+**: Scheduled removal (TBD)
- **Support**: Questions → HR team at [email]

## Migration Path
1. Ensure EMPLOYEE_CONTRACT contains all required data
2. Set USE_SHEETS_TEMPLATES=true in environment
3. Test with sample documents
4. Deploy to staging, then production
5. Monitor logs for any issues

## Legacy PDF Removal Checklist
- [ ] 100% of HR team on Sheets pipeline
- [ ] Zero use of legacy fallback (log monitoring)
- [ ] All test suites migrated to Sheets
- [ ] Backup of old PDF templates archived
```

### 구현 순서
1. generateSignedPdf에 @deprecated 주석
2. 로깅 추가: deprecation 경고
3. 마이그레이션 가이드 작성
4. TypeScript 타입 검증
5. 커밋

### 예상 결과
- 명확한 신호: 레거시 PDF는 지원 종료 예정
- 로깅 메트릭: 여전히 레거시 사용 중인 배포 추적 가능
- 사용자 가이드: 마이그레이션 방법 문서화

---

## Signature Position 처리 결정

### 결정: Phase 3 future work으로 defer

**이유:**
1. **기존 좌표 작동함**: signature-positions.json에 모든 문서 좌표 있음
2. **Sheets PDF 안정적**: Google 내보내기 결과 좌표 일정
3. **레거시 좌표 재사용 가능**: Sheets 파이프라인이 기존 좌표 사용 가능
4. **회귀 위험 없음**: consent/route.ts에서 페이지 범위 검증 (라인 107)

**Phase 4 액션:**
- 기존 좌표 그대로 유지
- 코드에 TODO 추가: "Phase 3: Sheets PDF export 좌표 검증"
- 사용자 피드백 모니터링
- 문제 발생 시 Phase 3에서 전체 캘리브레이션

---

## 데이터 모델 변경

### EMPLOYEE_CONTRACT 확장
```
기존: A-K (11개 컬럼)
추가: L-P (5개 선택 컬럼)
  L: benefits (복리후생)
  M: probation_period (수습기간)
  N: special_terms (특수조건)
  O: bank_name (은행명)
  P: account_number (계좌번호)

하위호환성: 새 컬럼 없는 기존 스프레드시트도 작동
```

### EMPLOYEE_MASTER 변경 없음
현재 스키마로 충분. 계좌 정보는 EMPLOYEE_CONTRACT로 통합.

---

## 테스트 전략

### 1. 자동화 테스트 (신규)
**파일:** `__tests__/integration/sheets-vs-legacy.test.ts`

```typescript
describe('Sheets vs Legacy Pipeline', () => {
  it('should generate all 7 documents from Sheets', async () => {
    // 7개 문서 모두 Sheets로 생성
    // 변수 치환 검증
    // 서명 위치 검증
  })

  it('should fallback to legacy when USE_SHEETS=false', async () => {
    // USE_SHEETS_TEMPLATES=false일 때
    // 레거시 PDF 파이프라인 작동 확인
  })

  it('should handle missing optional variables gracefully', async () => {
    // benefits, probation_period 누락 시
    // 에러 없음, 빈 필드로 표시
  })
})
```

### 2. 배포 전 검증 체크리스트

```
배포 전 확인사항:
□ 7개 문서 모두 에러 없이 생성 (USE_SHEETS=true)
□ 모든 변수 치환 완료 ({{placeholder}} 없음)
□ 서명 위치 검증 (샘플 PDF에서)
□ bank_account 문서에 bank_name, account_number 표시
□ labor_contract에 benefits, probation_period, special_terms 표시
□ 레거시 fallback 작동 (USE_SHEETS=false)
□ 콘솔 에러 없음, TypeScript 검증 통과
□ 성능: Sheets PDF 생성 < 3초/문서
□ Google Sheets API 할당량 초과 없음
```

### 3. 사용자 수용성 테스트 (UAT)

**시나리오 1: 신입사원 전체 흐름**
- 로그인 → 7개 문서 조회 (Sheets 생성) → 서명 → 이메일
- 검증: PDF 읽힘, 데이터 정확함, 서명 위치 정상

**시나리오 2: 선택사항 필드 누락**
- EMPLOYEE_CONTRACT에 benefits, probation_period 없음
- labor_contract 생성
- 검증: 에러 없음, 빈 필드 표시

**시나리오 3: 계좌 정보 입력**
- EMPLOYEE_CONTRACT에 bank_name, account_number 입력
- bank_account 생성
- 검증: 자동으로 필드 채워짐

### 4. 회귀 테스트

**레거시 fallback:**
- `USE_SHEETS_TEMPLATES=false` 설정
- 레거시 PDF로 문서 생성
- Sheets 결과와 비교:
  - 필수 필드 포함 여부
  - 레이아웃 유사성
  - 서명 위치 작동 여부

---

## 롤백 & 안전장치

### 1. Feature Flag 안전장치
Sheets 파이프라인 실패 시:
```
1. USE_SHEETS_TEMPLATES=false 설정
2. 모든 새 요청 → 레거시 PDF 사용
3. 서비스 중단 없음
4. 팀에 알림: Sheets API 조사
```

### 2. 점진적 롤아웃 (권장)

```
Week 1: 배포
  - USE_SHEETS_TEMPLATES != 'false'로 기본 설정
  - 레거시 fallback 허용

Week 2-3: 모니터링
  - 선택 직원으로 UAT
  - 에러 로그 모니터링
  - 성능 확인

Week 4: Commit
  - Sheets-only로 변경 (레거시 제거)
  - 모니터링 강화

Week 5+: 최적화
  - 사용자 피드백 수집
  - Sheets API 캐싱 최적화
  - Phase 3 서명 위치 캘리브레이션 계획
```

### 3. 데이터 백업 & 복구

배포 전:
- EMPLOYEE_CONTRACT CSV 내보내기 (현재 상태)
- EMPLOYEE_MASTER 백업
- TPL_ 시트 버전 제어 (Google Drive)
- 복구 절차 문서화

### 4. 에러 처리 & 로깅

강화할 사항:
- Sheets API 실패: 전체 context 로그
- 변수 치환 실패: placeholder 누락 감지
- 서명 위치 실패: 좌표 범위 이상 감지
- API 할당량 초과: 알림 발생

---

## 구현 순서

### Phase 4.1 (1-2일): 준비
1. ContractConditions 인터페이스 확장
2. contract.ts rowToConditions 업데이트
3. buildBankVariables 함수 생성
4. 자동화 테스트 스위트 작성
5. 마이그레이션 가이드 작성

### Phase 4.2 (1-2일): 배포
1. .env.example 업데이트
2. consent/route.ts USE_SHEETS 로직 반전
3. lib/pdf/generator.ts deprecation 주석 추가
4. 모든 코드 병합
5. Staging 배포 및 UAT

### Phase 4.3 (1일): Go-Live
1. 프로덕션에서 feature flag 활성화
2. 에러 로그 및 메트릭 모니터링
3. 지원팀 대기 (롤백 준비)
4. 점진적 deprecation 시작

### Phase 4.4 (1주+): 최적화
1. 사용자 피드백 수집
2. Sheets API 성능 최적화
3. Phase 3 서명 위치 캘리브레이션 계획
4. 레거시 PDF 코드 제거 (Phase 5)

---

## 중요 파일 목록

### 핵심 수정 파일

| 파일 | 변경 내용 | 우선순위 |
|------|---------|--------|
| `lib/sheets/contract.ts` | ContractConditions 확장 (5개 필드) | HIGH |
| `lib/sheets/template-variables.ts` | buildBankVariables 함수 추가 | HIGH |
| `app/api/docs/consent/route.ts` | USE_SHEETS 로직 반전 + 변수 통합 | HIGH |
| `.env.example` | 설정 문서화 업데이트 | HIGH |
| `lib/pdf/generator.ts` | @deprecated 주석 추가 | MEDIUM |
| `docs/DEPRECATION.md` | 마이그레이션 가이드 (신규) | MEDIUM |
| `__tests__/integration/sheets-vs-legacy.test.ts` | 자동화 테스트 (신규) | MEDIUM |
| `__tests__/lib/pdf/position-validator.test.ts` | 테스트 (선택사항) | LOW |

### 참고 파일 (수정 불필요)
- `lib/sheets/template.ts` - 이미 완성된 Sheets 파이프라인
- `lib/sheets/employee.ts` - 직원 데이터 조회
- `lib/sheets/drive.ts` - Google Sheets PDF 내보내기
- `types/document.ts` - 문서 타입 정의
- `types/employee.ts` - 직원 데이터 구조
- `app/api/docs/preview/route.ts` - Preview API (이미 Sheets 사용)

---

## 완료 기준

### Task 4-1 완료 후
- [ ] USE_SHEETS 로직 반전됨
- [ ] .env.example 업데이트됨
- [ ] 주석 "Phase 4: Sheets Templates Default" 추가됨
- [ ] TypeScript 검증 통과

### Task 4-2 완료 후
- [ ] ContractConditions에 5개 필드 추가됨
- [ ] buildContractVariables 확장됨
- [ ] buildBankVariables 함수 생성됨
- [ ] consent/route.ts 통합됨
- [ ] 모든 7개 문서 테스트 통과
- [ ] 선택사항 필드 누락 시 graceful fallback

### Task 4-3 완료 후
- [ ] generateSignedPdf에 @deprecated 주석
- [ ] deprecation 로깅 추가
- [ ] 마이그레이션 가이드 (DEPRECATION.md) 작성
- [ ] TypeScript 검증 통과

### 전체 Phase 4 완료 기준
- [ ] Sheets가 기본 템플릿 엔진
- [ ] 모든 변수 매핑 완료
- [ ] 자동화 테스트 통과 (>80% 커버리지)
- [ ] UAT 완료
- [ ] 레거시 파이프라인 deprecation 표시
- [ ] 점진적 롤아웃 계획 수립
- [ ] 모니터링 및 메트릭 준비

---

## 예상 결과

### Phase 4 완료 후
1. **기술:**
   - Sheets가 production default
   - 모든 변수 완전 매핑
   - 레거시 코드 deprecated
   - 자동화 테스트 있음

2. **운영:**
   - 점진적 마이그레이션 가능
   - 에러 로깅 강화
   - 롤백 절차 정의

3. **비즈니스:**
   - PDF 생성 신뢰성 ↑
   - 데이터 관리 단순화 (Sheets 사용)
   - Phase 3 서명 캘리브레이션 준비 완료

---

## 의존성 & 전제조건

✅ **완료:**
- Phase 1: 개인정보 동의 페이지 구현
- Sheets 템플릿 파이프라인 구축
- 7개 TPL_ 시트 생성

⚠️ **필요 없음:**
- Google Sheets API 자격증명 (이미 코드에 포함)
- Phase 3 서명 캘리브레이션 (defer 가능)

---

## Success Criteria

1. **기술적 성공:**
   - 모든 7개 문서 Sheets에서 성공적으로 생성
   - 변수 치환 100% 완료
   - TypeScript 타입 검증 통과
   - 테스트 커버리지 >80%

2. **운영 성공:**
   - 자동 테스트 추가
   - 에러 로깅 강화
   - 마이그레이션 가이드 제공
   - 점진적 롤아웃 계획

3. **비즈니스 성공:**
   - PDF 생성 신뢰성 보증
   - HR팀 관리 효율성 ↑
   - 향후 Phase 3, 5 진행 가능
