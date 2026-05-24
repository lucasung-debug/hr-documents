---
title: "포트폴리오 데모 영상 강화 — TASKS"
date: 2026-05-24
source_plan: docs/plans/2026-05-24-portfolio-video-enhancement.md
source_specs: specs/screens/*.yaml, specs/domain/resources.yaml
council_report: docs/plans/2026-05-24-council-report.md
note: 기존 docs/planning/06-tasks.md(완료된 Operations Hub)와 별개. 본 파일은 영상 강화 전용.
---

# 포트폴리오 데모 영상 강화 — TASKS

> 코기토: "HR 취업·이직을 위해, 이 프로젝트를 'HR 실무 깊이 + 프로덕션급'이 데모 영상 한 편으로 전달되게 만든다."
> 평가 매개 = 데모 영상. 3단계: 촬영 가능 → 화면 강화 → 영상화.

## 🌐 글로벌 제약 (모든 태스크 공통)
- 🔒 **데모 모드는 프로덕션 빌드에서 절대 활성화 불가** (빌드타임 가드 + `demo:true` JWT 클레임 + 실데이터 미들웨어 차단).
- ⚠️ **전자서명법 법적효력 주장 금지** → "서명 무결성 검증(SHA-256 변조 감지)" 표현만.
- 🔒 **공개 영상 PII/시크릿 금지** → 더미 데이터, IntegrationSetupPanel 값 더미화.
- ✅ **기존 121개 Jest 테스트 유지** (특히 admin 가드 추가 시 회귀 점검).
- TDD: Phase 1+ 태스크는 RED(실패 테스트) → GREEN(최소 구현) → REFACTOR.

---

## P0 — 준비 자산

### P0-T1: 온보딩 데모 시드 픽스처
- **설명**: 더미 사원(employee_id, name=홍길동, department, hire_date) + 6종 문서 상태를 담은 온보딩용 fixture. 기존 `lib/onboarding/demo-fixtures.ts`(대시보드용) 패턴 확장.
- **파일**: `lib/onboarding/demo-fixtures.ts` (또는 신규 `onboarding-demo-fixtures.ts`)
- **완료 기준**: 외부 API 없이 온보딩 플로우가 참조할 더미 사원/문서 데이터 제공.
- **의존성**: 없음 (병렬 가능)

### P0-T2: 서명 박힌 샘플 PDF 자산화
- **설명**: 근로계약서 등 서명 박힌 샘플 PDF 1종을 사전 생성하여 정적 자산으로 보관. (Sheets 재구현 회피 — Council 결정)
- **파일**: `public/demo/sample-signed-contract.pdf`
- **완료 기준**: 데모 플로우/영상에서 표시할 현실적 샘플 PDF 존재. PII는 더미.
- **의존성**: 없음 (병렬 가능)

---

## P1 — Stage 1: 촬영 가능 상태

### P1-R1: 데모 모드 프로덕션 격리 🔒
- **설명**: `demo:true` JWT 클레임 발급 경로 + 미들웨어에서 demo 클레임 시 실데이터(Sheets/Gmail) 접근 차단 + 프로덕션 빌드 가드(`HR_DASHBOARD_DEMO_ENABLED` 류 플래그가 prod에서 강제 false).
- **파일**: `lib/auth/*`, `middleware.ts`, `lib/onboarding/demo-mode.ts`
- **TDD**: 데모 클레임으로 실데이터 접근 시 차단되는 테스트 먼저.
- **완료 기준**: 프로덕션 환경에서 데모 모드 활성화 불가 + 데모 세션은 실 외부 API 호출 0.
- **의존성**: 없음

### P1-R2: 온보딩 데모 데이터소스 (Sheets 우회)
- **설명**: 로그인(`findEmployeeByNameAndPhone`)·문서 목록·서명 저장을 데모 모드에서 fixture로 대체. 실 Google Sheets 호출 제거.
- **파일**: `app/api/auth/login/route.ts`, `lib/sheets/employee.ts` 경로의 데모 분기 (DataSource 추상화 권장 — Council CTO)
- **TDD**: 데모 모드 로그인이 Sheets 호출 없이 성공하는 테스트.
- **완료 기준**: 데모 로그인~문서 조회가 외부 API 없이 동작.
- **의존성**: P0-T1, P1-R1

### P1-S1: 데모 로그인 화면 (가짜 사원 원클릭)
- **설명**: 더미 사원 정보 프리필 + 원클릭 진입. specs/screens/onboarding-demo-flow.yaml의 `demo_login`.
- **파일**: `app/login/`, `app/onboarding/`
- **완료 기준**: 랜딩의 "신입 데모 체험" → 즉시 온보딩 진입.
- **의존성**: P1-R2

### P1-S2: 데모 플로우 + 샘플 PDF 표시
- **설명**: 서명 캔버스 → 문서 동의 → 완료 → **샘플 PDF 표시**(생성 과정은 로딩 연출). `generatePdfFromTemplate`(Sheets 의존) 우회.
- **파일**: `app/onboarding/*`, `components/documents/*`, `public/demo/`
- **완료 기준**: 로그인~완료~PDF 표시가 끊김 없이 구동. 라이브 Sheets export 미발생.
- **의존성**: P0-T2, P1-S1

### P1-V: Stage 1 검증
- **설명**: 데모 플로우가 외부 API 없이 완주 + 기존 121 테스트 통과 확인.
- **완료 기준**: `npm run dev` 직후 전 플로우 구동 + `npm test` 그린.
- **의존성**: P1-S2, P1-R1

---

## P2 — Stage 2: 화면 강화

### P2-S1: 랜딩/소개 페이지
- **설명**: `app/page.tsx`(현 /login redirect) → 소개 페이지. 문제 정의 + 핵심기능 3 + 데모 진입 2버튼 + 신뢰 배지. specs/screens/landing.yaml.
- **파일**: `app/page.tsx`, `app/(marketing)/` 또는 컴포넌트
- **완료 기준**: / 접속 시 소개 + "신입 데모"/"관리자 데모" 버튼.
- **의존성**: P1-S1 (데모 진입 연결)

### P2-S2: 서명 무결성 검증 고지 ⚠️
- **설명**: 서명 직전 고지 화면. **"서명 무결성 검증(SHA-256 변조 감지)"** 핵심 한 줄 크게. 전자서명법 법적효력 주장 금지. specs/screens/signature-integrity-notice.yaml.
- **파일**: `app/onboarding/signature/`, `components/signature/`
- **완료 기준**: "전자서명법" 법적효력 문구 0건, 핵심 문구 영상 가독.
- **의존성**: P1-S2

### P2-S3: 관리자 대시보드 진행률 차트
- **설명**: 기존 숫자 카드(`StatsCards`)에 상태 분포 차트 추가. specs/screens/admin-dashboard.yaml의 `progress_chart`.
- **파일**: `components/admin/StatsCards.tsx` 또는 신규 차트 컴포넌트, `app/admin/dashboard/page.tsx`
- **완료 기준**: 데모 대시보드에 상태 분포 시각화 표시. 차트 라이브러리 도입.
- **의존성**: 없음 (기존 대시보드 데이터 사용)

### P2-RS4: 페이지 레벨 admin 가드 + 접근거부 화면
- **설명**: `app/admin/layout.tsx`에 role 체크 → employee면 redirect + 접근거부 사유 화면. specs/screens/access-denied.yaml.
- **파일**: `app/admin/layout.tsx`, 신규 접근거부 화면
- **TDD**: employee role이 /admin 접근 시 차단되는 테스트 + 기존 admin 경로 테스트 회귀 점검.
- **완료 기준**: employee 차단 + admin 통과 + 기존 테스트 유지.
- **의존성**: 없음

### P2-S5: UX 폴리싱 (우선순위 제한)
- **설명**: 영상 임팩트 순 — ① 에러 토스트(플로우 중 노출) ② 대시보드 로딩 스켈레톤(1회). 빈 상태·모바일은 영상에 안 나오면 생략(Council).
- **파일**: `components/ui/*`, 관련 화면
- **완료 기준**: 에러 토스트 + 로딩 스켈레톤 동작. 범위 초과 금지.
- **의존성**: P1-S2

### P2-V: Stage 2 검증
- **설명**: 전자서명법 문구 0건 + admin 가드 동작 + 121 테스트 유지 + 강화 화면이 코기토 3축 역추적 가능.
- **완료 기준**: 위 전부 통과.
- **의존성**: P2-S1~S5

---

## P3 — Stage 3: 영상화

### P3-T1: 영상 시나리오 대본 확정
- **설명**: S0(랜딩 0:00-0:15) → S1(데모 플로우 0:15-0:45, 문서 2-3개만) → S2(샘플 PDF+감사정보 0:45-1:30) → S3(대시보드 차트+리마인더 1:30-2:15) → S4(접근거부 2:15-2:35) → S5(클로징 2:35-2:50). 자막 포인트 포함.
- **파일**: `docs/demo/video-script.md`
- **완료 기준**: 각 Scene이 실제 구현 화면과 1:1 매핑.
- **의존성**: P2-V

### P3-T2: Playwright 자동 구동·녹화
- **설명**: `video: { mode: 'on' }` 컨텍스트로 데모 플로우+대시보드를 시나리오 순서대로 자동 클릭 녹화 → webm.
- **파일**: `scripts/demo-record.spec.ts` (Playwright), `playwright.config.ts`
- **완료 기준**: 시나리오 순서대로 재생되는 webm 산출. Puppeteer(PDF) 충돌 없음(샘플 PDF 표시라 충돌 회피).
- **의존성**: P3-T1

### P3-T3: 2컷 산출 + mp4 변환
- **설명**: 2:30 풀버전 + S0+S1핵심+S2 추린 60초 임베드 컷. webm→mp4 변환.
- **파일**: `docs/demo/` (full.mp4, embed-60s.mp4)
- **완료 기준**: 2개 영상 파일 산출.
- **의존성**: P3-T2

### P3-V: 녹화 전 PII/시크릿 체크리스트 검증 🔒
- **설명**: 강화 기획서 6절 체크리스트 — IntegrationSetupPanel 더미, 시드 허구, 본인 필체 금지, 해시 8자리, 녹화 후 재검토.
- **완료 기준**: 체크리스트 전 항목 통과 후에만 영상 공개.
- **의존성**: P3-T3

---

## P4 — 마감 (병행 가능)

### P4-T1: npm high 취약점 대응
- **설명**: high severity 3개 패치 시도 또는 `SECURITY.md` 한 장(왜 공격 표면 아닌지). Council 권고.
- **파일**: `package.json`, `SECURITY.md`
- **완료 기준**: high 3개 해소 또는 근거 문서화.
- **의존성**: 없음 (언제든)

---

## 병렬 실행 가이드
- **즉시 병렬**: P0-T1, P0-T2, P4-T1
- **P1**: R1 → R2 → S1 → S2 → V (대체로 직렬, R1/R2는 일부 병렬 가능)
- **P2**: S1·S3·RS4·S5 상당 부분 병렬 (S2는 P1-S2 후), V는 마지막
- **P3**: 직렬 (T1→T2→T3→V), P2-V 완료 후 착수
- **권장 진입점**: P0 → P1 (촬영 가능 상태가 모든 것의 토대)
