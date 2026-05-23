# E-Sign Onboarding Document Automation

신규 입사자 온보딩 전자서명 자동화 웹 애플리케이션.
7종 인사 서류에 전자서명을 받아 PDF로 생성하고, Google Sheets에 진행 상태를 기록하며,
완료된 문서를 HR 담당자에게 이메일로 자동 전송합니다.

이 프로젝트는 현재 **실제 HR 운영 시스템이 아니라 포트폴리오용 demo/dummy 환경**을 기준으로 공개합니다. Google Drive, Slack, OAuth, HR 이메일 수신자 등 외부 연동값은 실제 운영 계정이 아닌 dummy 값 또는 비활성 feature flag로 다루며, 개인정보(PII)가 없는 샘플 케이스로 온보딩 운영 흐름을 보여주는 데 목적이 있습니다.

## 포트폴리오 데모 기준

- **데모 목적**: 신규 입사자 문서 제출 이후 HR 담당자가 확인해야 하는 상태, PDF 보관 여부, 알림 상태를 하나의 Onboarding Case로 추적하는 운영 허브를 보여줍니다.
- **데이터 기준**: 실제 직원 정보가 아닌 dummy/demo 데이터와 case ID 중심의 상태값을 사용합니다.
- **외부 연동 기준**: Google Drive archive와 Slack notification은 구조와 테스트를 갖춘 adapter로 구현되어 있지만, 공개 데모에서는 실제 토큰·웹훅·운영 폴더를 연결하지 않습니다.
- **보안 기준**: Slack 메시지와 로그에는 이름, 이메일, 전화번호, 주민등록번호 등 PII를 넣지 않고 `case_id`, 상태, 조치 필요 여부 중심으로만 설계합니다.
- **운영 판정**: production live enablement는 의도적으로 **NO-GO**입니다. 실제 운영 전에는 HR 승인, secret review, OAuth scope 검증, Drive folder 검증, Slack destination 검증, dependency advisory 처리 또는 risk acceptance가 필요합니다.

## HR Onboarding Operations Hub

기존 전자서명 앱을 확장해, 신규 입사자 한 명을 하나의 `Onboarding Case`로 관리합니다.

핵심 흐름:

1. 입사자가 7종 HR 문서에 서명하고 PDF를 생성합니다.
2. 시스템이 안정적인 `case_id`를 부여합니다.
3. Google Sheets `DOCUMENT_STATUS`의 기존 문서 상태와 신규 M:X 온보딩 메타데이터를 함께 관리합니다.
4. Drive archive adapter가 case ID 기반 파일명과 private file ID 저장 구조를 제공합니다.
5. Slack notification adapter가 PII-free 조치 필요 알림 payload를 생성합니다.
6. Admin dashboard에서 case status, action required, archive status, notification status를 확인합니다.

자세한 운영 문서:

- [Onboarding Operations Hub](docs/onboarding-operations-hub.md)
- [Production Readiness Checklist](docs/production-readiness/onboarding-operations-release-checklist.md)
- [Operator Runbook](docs/production-readiness/onboarding-operations-runbook.md)
- [Rollback Notes](docs/production-readiness/onboarding-operations-rollback.md)

## 기술 스택

| 계층 | 기술 |
|------|------|
| **프론트엔드** | React 18, Next.js 14 (App Router), Tailwind CSS |
| **백엔드** | Next.js API Routes, Node.js |
| **인증** | JWT (HS256, jose) + Cookie, Rate Limiting |
| **데이터** | Google Sheets API v4 (DB 없음) |
| **PDF** | Puppeteer (HTML → PDF) + pdf-lib (서명 삽입) + pdfjs-dist (미리보기) |
| **이미지** | sharp (서명 이미지 처리) |
| **이메일** | Gmail API + Nodemailer (OAuth2) |
| **검증** | Zod (런타임 스키마 검증) |
| **로깅** | Pino (구조화된 로깅) |
| **배포** | Docker / Vercel (@sparticuz/chromium) |

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
# 포트폴리오 데모에서는 dummy 값을 사용할 수 있습니다.
# 실제 운영 연결 시에만 Google/Gmail/Drive/Slack 값을 실제 계정으로 교체합니다.
```

**필수 환경변수:**
- `JWT_SECRET` — 256비트 hex 비밀키
- `GOOGLE_SPREADSHEET_ID` — Google Sheets 문서 ID
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` — Gmail OAuth2
- `SHEET_EMPLOYEE_MASTER`, `SHEET_DOCUMENT_STATUS` — 시트 탭 이름
- `HR_EMAIL_RECIPIENTS` — HR 담당자 이메일 (콤마 구분)

**데모/더미 연동 환경변수:**
- `HR_DASHBOARD_DEMO_ENABLED=1` — production 배포에서도 `?demo=1` admin dashboard fixture 접근 허용
- `GOOGLE_DRIVE_ARCHIVE_ENABLED=false` — Drive archive 실제 업로드 비활성화
- `SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false` — Slack webhook 실제 발송 비활성화
- `GOOGLE_DRIVE_ARCHIVE_FOLDER_ID`, `SLACK_ONBOARDING_WEBHOOK_URL` — 실제 운영 전까지 dummy 또는 미설정 유지

### 3. Google Sheets 설정

1. Google Cloud Console에서 서비스 계정 생성
2. Google Sheets API 활성화
3. 스프레드시트에 서비스 계정 편집 권한 부여
4. 시트 2개 생성: `EMPLOYEE_MASTER`, `DOCUMENT_STATUS`

**템플릿 시트 자동 생성:**
```bash
npx ts-node --project tsconfig.json scripts/create-sheets-templates.ts
```

### 4. PDF 양식 파일 배치

`public/templates/` 디렉토리에 7종 PDF 파일을 배치합니다.
상세 안내: [public/templates/README.md](public/templates/README.md)

### 5. 서명 좌표 설정

`config/signature-positions.json`에서 각 서류별 서명 위치를 조정합니다.

> ⚠️ pdf-lib의 Y축은 페이지 **하단** 기준입니다 (A4 = 841.89pt 높이).

### 6. 개발 서버 실행

```bash
npm run dev
```

### 7. Docker 배포

```bash
docker-compose up -d
```

## 프로젝트 구조

```
├── app/
│   ├── api/                        # API 라우트 (11개 엔드포인트)
│   │   ├── auth/login/             # 로그인
│   │   ├── docs/                   # 문서 (list, preview, consent, generate-pdf, check-all)
│   │   ├── sign/capture/           # 서명 캡처
│   │   ├── employee/               # 직원 정보 (info, materials)
│   │   ├── email/send/             # 이메일 전송
│   │   └── temp/cleanup/           # 임시 파일 정리
│   ├── login/                      # 로그인 페이지
│   └── onboarding/                 # 온보딩 플로우 (6단계)
├── components/
│   ├── documents/                  # DocumentCard, DocumentList, DocumentPreviewModal
│   ├── email/                      # SendConfirmModal
│   ├── employee/                   # MaterialsSection
│   ├── navigation/                 # StepSidebar, MobileProgressHeader
│   ├── providers/                  # SessionProvider
│   ├── signature/                  # SignaturePad, SignaturePreview
│   └── ui/                        # Button, Input, Modal, Checkbox, ProgressBar
├── config/                         # 서명 좌표 설정 (signature-positions.json)
├── lib/
│   ├── api/                        # API 응답 헬퍼 (apiOk, apiError)
│   ├── auth/                       # JWT 서명/검증 (HS256, 30분 만료)
│   ├── crypto/                     # SHA-256 해싱
│   ├── email/                      # Gmail OAuth2, 이메일 템플릿
│   ├── errors/                     # 에러 코드 관리
│   ├── logger/                     # Pino 구조화 로깅
│   ├── pdf/                        # PDF 생성 + 서명 배치
│   ├── rate-limit/                 # 로그인 시도 제한 (60초/5회)
│   ├── sheets/                     # Google Sheets 클라이언트
│   ├── storage/                    # 임시 파일·세션 디렉토리 관리
│   └── validators/                 # Zod 입력 검증 스키마
├── scripts/                        # 유틸리티 스크립트 (캘리브레이션, 시트 관리)
├── types/                          # TypeScript 타입 정의
├── middleware.ts                   # JWT 검증 미들웨어
├── public/templates/               # PDF 양식 파일 (별도 배치)
├── __tests__/                      # Jest 테스트
├── Dockerfile                      # Docker 빌드
└── docker-compose.yml              # Docker Compose
```

## 온보딩 플로우

```
[로그인] → [서명 입력] → [서류 목록] → [문서별 미리보기·동의] → [전체 완료 확인] → [이메일 전송]
   │            │              │                  │                       │                │
   ▼            ▼              ▼                  ▼                       ▼                ▼
 JWT 발급   SHA-256 해시   7종 문서 표시    PDF 생성 + 서명 삽입    check-all API    HR에 PDF 발송
```

## API 엔드포인트 (11개)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | `/api/auth/login` | 이름 + 휴대전화번호 로그인 | 공개 |
| POST | `/api/sign/capture` | 서명 이미지 저장 (base64 PNG, SHA-256) | JWT |
| GET | `/api/docs/list` | 서류 목록 + 서명 여부 조회 | JWT |
| GET | `/api/docs/preview` | 특정 문서 미리보기 PDF 생성 (서명 없음) | JWT |
| POST | `/api/docs/generate-pdf` | 문서 PDF 생성 (서명 위치 포함) | JWT |
| POST | `/api/docs/consent` | 서류 동의 + PDF 저장 + Sheets 상태 갱신 | JWT |
| GET | `/api/docs/check-all` | 전체 완료 여부 확인 | JWT |
| GET | `/api/employee/info` | 사번 + 직원 정보 조회 | JWT |
| GET | `/api/employee/materials` | 온보딩 교재/자료 목록 조회 | JWT |
| POST | `/api/email/send` | 완료된 PDF를 HR에 이메일 전송 | JWT |
| DELETE | `/api/temp/cleanup` | 만료된 세션 임시 파일 삭제 | JWT |

## 서류 목록 (7종)

| 키 | 서류명 | 서명 |
|----|--------|------|
| `labor_contract` | 근로계약서 | 필수 |
| `personal_info_consent` | 개인정보 수집·이용 동의서 | 필수 |
| `bank_account` | 급여 이체 계좌 신청서 | 필수 |
| `health_certificate` | 건강진단서 제출 확인서 | 필수 |
| `criminal_check_consent` | 범죄경력조회 동의서 | 필수 |
| `emergency_contact` | 비상연락망 등록 신청서 | 선택 |
| `data_security_pledge` | 정보보안 서약서 | 필수 |

각 서류의 서명 좌표는 `config/signature-positions.json`에서 관리합니다.

## 캘리브레이션 스크립트

서명 위치 정밀 조정을 위한 스크립트 모음:

```bash
# 서명 위치 자동 감지
node scripts/detect-signature-positions.mjs

# 모든 문서의 서명 위치 일괄 감지
node scripts/detect-all-signatures.mjs

# 서명 좌표 재계산
node scripts/recalc-positions.mjs

# 서명 위치 검증 (실제 PDF에 테스트 서명 삽입)
node scripts/verify-positions.mjs

# 서명 캘리브레이션 (좌표 미세 조정)
node scripts/calibrate-signature.mjs

# Google Sheets 템플릿 PDF 캘리브레이션
node scripts/calibrate-sheets-pdf.mjs
```

**Google Sheets 관리:**

```bash
# 7개 TPL_ 템플릿 탭 자동 생성
npx ts-node --project tsconfig.json scripts/create-sheets-templates.ts

# 테스트 템플릿 데이터 생성
npx ts-node --project tsconfig.json scripts/generate-test-templates.ts

# Sheets 데이터 조회 (마스터 + 상태)
npx ts-node --project tsconfig.json scripts/read-sheets-data.ts

# EMPLOYEE_MASTER 탭만 읽기
node scripts/read-master-only.js
```

## 보안 체크리스트

- [x] JWT 세션 토큰 인증 (모든 API 엔드포인트)
- [x] 미들웨어 기반 경로 보호 (`/onboarding/*`, `/api/*`)
- [x] 서명 SHA-256 해시 Google Sheets 기록
- [x] Zod 런타임 입력 검증 (로그인, 서명, 문서)
- [x] 로그인 레이트 리미팅 (60초당 5회)
- [x] 30분 세션 타임아웃 자동 만료
- [x] 세션별 임시 디렉토리 격리 + TTL 자동 삭제
- [x] .env.local Git 제외 (.gitignore)
- [x] Pino 구조화 로깅 (console.log 전면 교체)
- [ ] HTTPS 강제 설정 (배포 환경에서 설정)
- [ ] Google Sheets 서비스 계정 최소 권한 검토
- [ ] 이중 발송 방지 로직

## 라이선스

MIT
