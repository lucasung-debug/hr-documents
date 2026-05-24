---
title: "Council 리뷰 리포트 — 포트폴리오 데모 영상 강화 기획"
date: 2026-05-24
mode: single-session (Agent 서브에이전트 3명)
reviewed_plan: docs/plans/2026-05-24-portfolio-video-enhancement.md
---

# Council 리뷰 리포트

## 실행 모드
단일세션 모드 — `$CLABS_SOCKET` 미감지로 Agent 서브에이전트 3명(CTO/UX/Security) 병렬 리뷰.

## 참여자 및 점수

| 리뷰어 | 관점 | 점수 |
|--------|------|------|
| CTO | 아키텍처·기술 건전성 | **6.5/10** |
| UX | 사용자 경험·영상 임팩트 | **7/10** |
| Security | 보안·HR 도메인 컴플라이언스 | **6/10** |

## 합의 사항 (3인 공통)
- 목표(영상 평가)와 수단(라이브 의존성 우회)의 정렬이 명확하고 범위 선별이 현실적이다.
- 기존 MVP 기반선(121 테스트, Trinity 87.84)이 회귀 안전망 역할을 한다.
- D8 페이지 레벨 admin 가드 추가는 옳은 보안 수정이다.

## 주요 개선 제안 (반영 확정)
1. **D7 문구 교체** (Security, HIGH) — "전자서명법 법적효력 보장"은 SHA-256 해시로 충족 불가한 거짓 법적 주장 → HR 법무 담당자에게 레드플래그. **"서명 무결성 검증(SHA-256 변조 감지)"** 등 구현과 일치하는 표현으로 대체.
2. **공개 영상 PII/시크릿 누출 차단** (Security, HIGH) — IntegrationSetupPanel 환경변수·키 더미화, 시드데이터는 명백한 허구(홍길동/010-0000-0000), 녹화 전 체크리스트 프로세스.
3. **영상 페이싱 재배분** (UX) — S1(45s→30s, 문서 6개 중 2-3개만+타임랩스), S2 결과물(30s→45s). 화면 텍스트는 핵심 한 줄만 크게.
4. **2컷 전략** (UX) — 2:30 풀버전 + 60초 포트폴리오 임베드용 컷.
5. **npm high 취약점 3개** (Security, MEDIUM) — 패치하거나 `SECURITY.md` 한 장으로 "공격 표면 아님" 근거 명시.
6. **데모 모드 프로덕션 격리** (CTO+Security, HIGH) — 환경변수 플래그만으로는 불충분. 빌드타임 격리 또는 `demo: true` JWT 클레임 + 실데이터 미들웨어 차단.

## 미합의 쟁점 → 마스터 결정 완료

| 쟁점 | 옵션 | 마스터 결정 |
|------|------|-------------|
| **PDF 데모 생성 방식** | A 로컬 재구현 / B 샘플 PDF 표시 / C Puppeteer 확인 | **B 샘플 PDF 표시** — Stage1 리스크 0, 재구현 회피 |

## 오케스트레이터 코드 검증 (CTO 우려 사실 확정)
`generatePdfFromTemplate`(lib/sheets/template.ts:448)을 직접 확인:
- `fillTemplate()`로 Google Sheets에 템플릿 탭 복사 → `exportWithRetry()`로 Google export API PDF 추출 → `deleteSheetById()` 정리.
- **PDF 생성 전 경로가 Google Sheets API에 100% 의존.** 호출처 5곳: `email/send`, `docs/consent`, `docs/generate-pdf`, `sign/capture`, `docs/preview`.
- `public/templates/*.pdf`(7종)는 이 경로에서 미사용 → **데모 라이브 생성은 "우회"가 아니라 "재구현"**.
- **결론**: 마스터가 "샘플 PDF 표시"를 택해 재구현을 회피함. 미리 생성한 서명 샘플 PDF 1종을 데모에서 표시, 생성 과정은 로딩 연출로 처리.

## 리뷰어별 상세

### CTO (아키텍처) — 6.5/10
- **강점**: 목표-수단 정렬, 템플릿 PDF 기존 존재, 테스트 기반선, `?demo=1` 선례, 현실적 범위 선별.
- **약점**: ① `generatePdfFromTemplate`의 Sheets 탭 복사 → 로컬화는 재구현(최대 과소평가) ② 데모 분기의 아키텍처 오염 위험(Repository/DataSource 패턴 권장) ③ Playwright(녹화)+Puppeteer(PDF) 동시 실행 충돌 ④ D8 가드가 기존 테스트 깨뜨릴 가능성 ⑤ 시드데이터 현실감은 콘텐츠 작업.

### UX (사용자 경험) — 7/10
- **강점**: 서사 구조(문제→해결), 도메인 신호 3곳 배치, 보안 시연 독립 씬, 대시보드 차트 클라이맥스, S5 캡션 전략.
- **약점**: ① S1(45s) 과밀(6문서 반복 지루) ② 전자서명법·감사정보 텍스트 영상서 안 읽힘 ③ S2(30s) 과속(결과물 증명이 핵심인데) ④ D5 UX 폴리싱 범위 무한 위험 ⑤ 2:30 단일 컷은 포트폴리오 임베드엔 김.

### Security (보안·HR 컴플라이언스) — 6/10
- **강점**: 데모 격리 의도, PII 격리 내재화, D8 페이지 가드, SHA-256 감사추적, JWT+rate-limit 기본 스택.
- **약점**: ① D3 데모모드 프로덕션 누출(HIGH) ② D7 전자서명법 과다주장=레드플래그(HIGH) ③ 공개 영상 PII/시크릿 누출(HIGH) ④ npm high 3개 방치 → 리포 신뢰도(MEDIUM) ⑤ S4 보안 시연 단순(접근거부 사유+감사이력 표시로 격상 권고).
