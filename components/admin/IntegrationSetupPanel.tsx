'use client'

import { useMemo, useState } from 'react'

const setupSteps = [
  {
    title: '1. Demo dashboard 공개',
    description: '실제 HR 계정 없이 포트폴리오용 dummy case dashboard를 보여줍니다.',
    env: [
      'HR_DASHBOARD_DEMO_ENABLED=1',
      'GOOGLE_DRIVE_ARCHIVE_ENABLED=false',
      'SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false',
    ],
  },
  {
    title: '2. Google Sheets 연결',
    description: 'EMPLOYEE_MASTER와 DOCUMENT_STATUS를 상태 저장소로 사용합니다.',
    env: [
      'GOOGLE_SPREADSHEET_ID=your-sheet-id',
      'SHEET_EMPLOYEE_MASTER=EMPLOYEE_MASTER',
      'SHEET_DOCUMENT_STATUS=DOCUMENT_STATUS',
    ],
  },
  {
    title: '3. Gmail OAuth2 연결',
    description: '완료된 PDF를 HR 담당자에게 발송하고 workspace sync의 시작점으로 사용합니다.',
    env: [
      'GMAIL_CLIENT_ID=your-client-id',
      'GMAIL_CLIENT_SECRET=your-client-secret',
      'GMAIL_CLIENT_REFRESH_TOKEN=your-refresh-token',
      'GMAIL_SENDER_ADDRESS=hr@example.com',
      'HR_EMAIL_RECIPIENTS=hr@example.com,manager@example.com',
    ],
  },
  {
    title: '4. Drive archive 활성화',
    description: 'case_id 기반 파일명으로 PDF packet을 비공개 Drive folder에 보관합니다.',
    env: [
      'GOOGLE_DRIVE_ARCHIVE_ENABLED=true',
      'GOOGLE_DRIVE_ARCHIVE_FOLDER_ID=your-private-drive-folder-id',
    ],
  },
  {
    title: '5. Slack 조치 알림 활성화',
    description: 'PII 없이 case_id, 상태, 조치 필요 유형만 HR 채널로 보냅니다.',
    env: [
      'SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=true',
      'SLACK_ONBOARDING_WEBHOOK_URL=https://hooks.slack.com/services/...',
      'NEXT_PUBLIC_BASE_URL=https://your-domain.com',
    ],
  },
] as const

const modulePaths = [
  'lib/onboarding/workspace-sync.ts',
  'lib/onboarding/sheets-repository.ts',
  'lib/google/drive-archive.ts',
  'lib/slack/onboarding-notification.ts',
  'app/api/email/send/route.ts',
]

function EnvCodeBlock({ lines }: { lines: readonly string[] }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-apple bg-apple-gray-950 px-3 py-2 text-xs leading-5 text-apple-gray-50">
      <code>{lines.join('\n')}</code>
    </pre>
  )
}

export function IntegrationSetupPanel() {
  const [copied, setCopied] = useState(false)
  const envTemplate = useMemo(
    () => setupSteps.flatMap(step => [`# ${step.title}`, ...step.env, '']).join('\n').trim(),
    []
  )

  const copyEnvTemplate = async () => {
    try {
      await navigator.clipboard.writeText(envTemplate)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="rounded-apple-xl border border-apple-gray-100 bg-white p-4 shadow-apple-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-apple-blue">Integration Setup</p>
          <h3 className="mt-1 text-base font-bold text-apple-gray-900 sm:text-lg">
            더미 데모에서 실제 Google Workspace/Slack 연동으로 전환
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-apple-gray-600">
            브라우저에서 서버의 실제 `.env` 파일을 직접 수정하지는 않습니다. 대신 관리자가 필요한 환경변수와
            연결 모듈을 한 화면에서 확인하고, 로컬 `.env.local` 또는 Vercel Environment Variables에 복사해 넣도록 설계했습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={copyEnvTemplate}
          className="min-h-[40px] rounded-apple bg-apple-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
        >
          {copied ? '복사됨' : 'env 템플릿 복사'}
        </button>
      </div>

      <div className="mt-4 rounded-apple-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm leading-6 text-yellow-900">
        보안 원칙: secret, OAuth token, Slack webhook URL은 화면에 저장하거나 다시 표시하지 않습니다. 실제 값은 배포 환경의 secret store에만 입력합니다.
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {setupSteps.map(step => (
          <article key={step.title} className="rounded-apple-lg border border-apple-gray-100 bg-apple-gray-50 p-4">
            <h4 className="text-sm font-semibold text-apple-gray-900">{step.title}</h4>
            <p className="mt-1 text-sm leading-6 text-apple-gray-600">{step.description}</p>
            <EnvCodeBlock lines={step.env} />
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-apple-lg border border-apple-gray-100 p-4">
          <h4 className="text-sm font-semibold text-apple-gray-900">연동 모듈 경계</h4>
          <ul className="mt-3 space-y-2 text-sm text-apple-gray-600">
            {modulePaths.map(path => (
              <li key={path} className="font-mono text-xs text-apple-gray-700">{path}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-apple-lg border border-apple-gray-100 p-4">
          <h4 className="text-sm font-semibold text-apple-gray-900">운영 전 체크</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-apple-gray-600">
            <li>Drive/Slack feature flag는 검증 전까지 `false`로 유지합니다.</li>
            <li>Slack payload는 `case_id` 중심으로 유지하고 PII를 포함하지 않습니다.</li>
            <li>OAuth scope 변경 후에는 refresh token을 재발급합니다.</li>
            <li>실제 운영 전 type-check, test, build, lint, dependency audit을 다시 실행합니다.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
