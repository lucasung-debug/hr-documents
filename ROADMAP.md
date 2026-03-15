# Roadmap

E-Sign Onboarding Document Automation 향후 개발 방향.

---

## Phase A: 관리자 대시보드

**목표:** HR 담당자가 전체 온보딩 현황을 실시간으로 파악

- [ ] 관리자 전용 로그인 (역할 기반 인증)
- [ ] 서류 현황 실시간 대시보드 (직원별 완료/미완료 현황)
- [ ] 미완료 직원 목록 필터링 + 정렬
- [ ] 일괄 리마인더 발송 기능
- [ ] 통계 차트 (일별/주별 온보딩 완료율)

**핵심 변경:**
- `app/admin/` 페이지 그룹 추가
- Google Sheets DOCUMENT_STATUS 탭에서 집계 API 구현
- 관리자 JWT 역할(role) 클레임 추가

---

## Phase B: Google Sheets 템플릿 완전 전환

**목표:** 정적 PDF 양식 → Google Sheets 기반 동적 문서 생성

- [ ] `USE_SHEETS_TEMPLATES` 환경변수 완전 활성화
- [ ] 7개 TPL_ 탭에서 실시간 템플릿 데이터 로드
- [ ] 직원 정보 자동 채움 (이름, 사번, 부서, 입사일)
- [ ] 계약 조건 동적 삽입 (급여, 근무시간, 수습 기간)
- [ ] 템플릿 버전 관리 (시트 내 버전 컬럼)

**핵심 변경:**
- `lib/sheets/templates.ts` 완성
- `lib/pdf/generator.ts`에서 HTML 템플릿 동적 렌더링
- `public/templates/` PDF 파일 의존도 제거

---

## Phase C: 다국어 / 다양식 지원

**목표:** 영문 계약서 지원 + 고용 형태별 서류 분기

- [ ] 영문 계약서 템플릿 (외국인 직원용)
- [ ] 언어 자동 감지 또는 직원 마스터 시트에서 언어 설정
- [ ] 일용직 / 월급직 / 계약직 자동 분기
  - 고용 형태별 필요 서류 매핑
  - 근로계약서 조건 자동 분기
- [ ] 서류 선택적 활성화 (특정 직군에서 불필요한 서류 스킵)

**핵심 변경:**
- `config/document-types.json`에 고용 형태별 매핑 추가
- `lib/sheets/employees.ts`에서 고용 형태 필드 활용
- 다국어 템플릿 파일 구조 (`templates/ko/`, `templates/en/`)

---

## Phase D: 알림 자동화

**목표:** 미완료 서류 독촉 + 완료 알림 자동화

- [ ] Slack Webhook 연동 (HR 채널 알림)
- [ ] 카카오 알림톡 연동 (직원에게 직접 알림)
- [ ] 미완료 독촉 스케줄러 (입사일 D-3, D-1, D-day)
- [ ] 완료 알림 (모든 서류 완료 시 HR + 직원 양쪽 알림)
- [ ] 알림 이력 로그 (Google Sheets 또는 별도 탭)

**핵심 변경:**
- `lib/notifications/` 모듈 신규
- `lib/scheduler/` 크론 작업 추가 (Next.js cron 또는 외부 스케줄러)
- EMPLOYEE_MASTER에 입사예정일 컬럼 활용

---

## Phase E: 감사 로그 (Audit Trail)

**목표:** 법적 증빙력을 갖춘 서명 이력 관리

- [ ] 서명 이벤트 로그 (서명 시각, IP 주소, User-Agent)
- [ ] 문서별 이력 추적 (조회 → 서명 → PDF 생성 → 이메일 발송)
- [ ] SHA-256 해시 체인 (이전 이벤트 해시 포함)
- [ ] 감사 로그 조회 API + 관리자 UI
- [ ] 로그 내보내기 (CSV / JSON)

**핵심 변경:**
- Google Sheets에 `AUDIT_LOG` 탭 추가
- `lib/audit/` 모듈 신규
- 기존 API에 감사 로깅 미들웨어 삽입

---

## Phase F: 모바일 최적화 + PWA

**목표:** 스마트폰에서 원활한 온보딩 경험

- [ ] PWA 매니페스트 + 서비스 워커 (오프라인 기본 지원)
- [ ] 카메라 기반 서명 입력 (터치 서명 + 사진 업로드)
- [ ] QR 코드 온보딩 링크 생성 (관리자가 직원에게 전달)
- [ ] 모바일 전용 레이아웃 최적화 (이미 MobileProgressHeader 존재)
- [ ] 푸시 알림 (완료 상태 업데이트)

**핵심 변경:**
- `public/manifest.json` + `app/sw.ts`
- QR 코드 생성 라이브러리 (`qrcode`) 추가
- 카메라 API 연동 컴포넌트

---

## 우선순위 가이드

```
Phase A (관리자 대시보드)  ████████████████  높음 — HR 운영 필수
Phase B (Sheets 템플릿)    ███████████████   높음 — 이미 기반 코드 존재
Phase D (알림 자동화)      ████████████      중간 — 운영 효율
Phase E (감사 로그)        ████████████      중간 — 법적 요건
Phase C (다국어/다양식)    ████████          낮음 — 필요 시 확장
Phase F (모바일/PWA)       ████████          낮음 — 현재 반응형 대응 중
```
