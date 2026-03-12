# E-Sign Onboarding Document Automation

신규 입사자 온보딩 전자서명 자동화 웹 애플리케이션

## 기술 스택

- **Framework**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **서명 패드**: react-signature-canvas
- **PDF 생성**: pdf-lib + Puppeteer
- **데이터**: Google Sheets API v4
- **이메일**: Nodemailer + Gmail OAuth2
- **인증**: JWT (jose)
- **배포**: Docker (권장) / Vercel

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
# .env.local 파일을 열어 실제 값 입력
```

### 3. Google Sheets 설정

1. Google Cloud Console에서 서비스 계정 생성
2. Google Sheets API 활성화
3. 스프레드시트에 서비스 계정 편집 권한 부여
4. 시트 2개 생성: `EMPLOYEE_MASTER`, `DOCUMENT_STATUS`

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
├── app/                    # Next.js App Router
│   ├── api/                # API 라우트 (9개 엔드포인트)
│   ├── login/              # 로그인 페이지
│   └── onboarding/         # 온보딩 플로우 (6단계)
├── components/             # UI 컴포넌트
├── config/                 # 서명 좌표 설정
├── lib/                    # 비즈니스 로직 라이브러리
│   ├── auth/               # JWT 인증
│   ├── crypto/             # SHA-256 해시
│   ├── email/              # 이메일 발송
│   ├── pdf/                # PDF 생성
│   ├── sheets/             # Google Sheets 연동
│   ├── storage/            # 임시 파일 관리
│   └── validators/         # Zod 입력 검증
├── public/templates/       # PDF 양식 파일 (별도 배치 필요)
└── types/                  # TypeScript 타입 정의
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|---|---|---|
| POST | `/api/auth/login` | 이름 + 휴대전화번호 로그인 |
| POST | `/api/sign/capture` | 서명 이미지 저장 |
| GET | `/api/docs/list` | 서류 목록 조회 |
| POST | `/api/docs/consent` | 서류 동의 + PDF 생성 |
| POST | `/api/docs/generate-pdf` | PDF 미리보기 생성 |
| GET | `/api/docs/check-all` | 전체 완료 여부 확인 |
| GET | `/api/employee/info` | 사번 + 온보딩 자료 조회 |
| POST | `/api/email/send` | 이메일 발송 |
| DELETE | `/api/temp/cleanup` | 임시 파일 삭제 |

## 보안 체크리스트

- [ ] JWT 세션 토큰 인증 (모든 API 엔드포인트)
- [ ] HTTPS 강제 설정
- [ ] 서명 SHA-256 해시 Sheets 기록
- [ ] 발송 후 /tmp 파일 0건 확인
- [ ] 30분 세션 타임아웃
- [ ] .env.local Git 제외 (.gitignore 확인)
- [ ] Google Sheets 서비스 계정 최소 권한
- [ ] 이중 발송 방지 로직