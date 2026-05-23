import type {
  NotificationStatus,
  OnboardingActionRequired,
  OnboardingCaseStatus,
  PdfPacketStatus,
  WorkspaceSyncStatus,
} from '@/types/onboarding'

interface SlackNotificationEnv extends Record<string, string | undefined> {
  SLACK_ONBOARDING_NOTIFICATIONS_ENABLED?: string
  SLACK_ONBOARDING_WEBHOOK_URL?: string
  NEXT_PUBLIC_BASE_URL?: string
}

export interface SlackWebhookPayload {
  text: string
  blocks: Array<Record<string, unknown>>
}

type SlackFetch = (
  url: string,
  init: {
    method: 'POST'
    headers: Record<string, string>
    body: string
  }
) => Promise<{ ok: boolean; status: number }>

export interface BuildOnboardingActionRequiredSlackPayloadInput {
  case_id: string
  action_required: OnboardingActionRequired
  case_status: OnboardingCaseStatus
  pdf_packet_status: PdfPacketStatus
  workspace_sync_status: WorkspaceSyncStatus
  notification_status: NotificationStatus
  timestamp: string
  dashboardUrl?: string
}

export interface NotifyOnboardingActionRequiredSlackInput {
  case_id: string
  action_required: OnboardingActionRequired
  case_status: OnboardingCaseStatus
  pdf_packet_status: PdfPacketStatus
  workspace_sync_status: WorkspaceSyncStatus
  notification_status: NotificationStatus
  env?: SlackNotificationEnv
  fetchImpl?: SlackFetch
  now?: () => Date
}

export type SafeSlackNotifyResult =
  | {
      ok: true
      status: 'slack_sent'
      slack_notified_at: string
      notification_status: 'slack_sent'
    }
  | { ok: true; status: 'disabled' | 'not_action_required' }
  | { ok: false; code: 'configuration_error' | 'send_failed'; message: 'Slack notification failed' }

const SAFE_FAILURE_MESSAGE = 'Slack notification failed'

const ACTION_MESSAGES: Record<OnboardingActionRequired, string> = {
  hr_review: 'HR review is required for this onboarding case.',
  pdf_packet_failed: 'PDF packet generation failed. Please review the onboarding case.',
  drive_sync_failed: 'Drive archive sync failed. Please review the onboarding case.',
  slack_notify_failed: 'Slack notification previously failed. Please review the onboarding case.',
  none: '',
}

class SlackNotificationError extends Error {
  constructor(public readonly code: 'configuration_error' | 'send_failed') {
    super(SAFE_FAILURE_MESSAGE)
  }
}

export function isSlackNotificationEnabled(env: SlackNotificationEnv = process.env): boolean {
  return env.SLACK_ONBOARDING_NOTIFICATIONS_ENABLED === 'true'
}

export function shouldNotifySlackForAction(actionRequired: OnboardingActionRequired): boolean {
  return actionRequired !== 'none'
}

export function buildOnboardingActionRequiredSlackPayload(
  input: BuildOnboardingActionRequiredSlackPayloadInput
): SlackWebhookPayload {
  const safeMessage = ACTION_MESSAGES[input.action_required]
  const fields = [
    `case_id: ${input.case_id}`,
    `action_required: ${input.action_required}`,
    `case_status: ${input.case_status}`,
    `pdf_packet_status: ${input.pdf_packet_status}`,
    `workspace_sync_status: ${input.workspace_sync_status}`,
    `notification_status: ${input.notification_status}`,
    `timestamp: ${input.timestamp}`,
  ]

  if (input.dashboardUrl) {
    fields.push(`admin_dashboard_url: ${input.dashboardUrl}`)
  }

  return {
    text: safeMessage,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: safeMessage,
        },
      },
      {
        type: 'section',
        fields: fields.map((field) => ({
          type: 'mrkdwn',
          text: field,
        })),
      },
    ],
  }
}

export async function notifyOnboardingActionRequiredSlack(
  input: NotifyOnboardingActionRequiredSlackInput
): Promise<SafeSlackNotifyResult> {
  const env = input.env ?? process.env
  if (!isSlackNotificationEnabled(env)) {
    return { ok: true, status: 'disabled' }
  }

  if (!shouldNotifySlackForAction(input.action_required)) {
    return { ok: true, status: 'not_action_required' }
  }

  const webhookUrl = env.SLACK_ONBOARDING_WEBHOOK_URL
  if (!webhookUrl) {
    throw new SlackNotificationError('configuration_error')
  }

  const now = input.now ?? (() => new Date())
  const slackNotifiedAt = now().toISOString()
  const fetchImpl = (input.fetchImpl ?? fetch) as SlackFetch
  const response = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      buildOnboardingActionRequiredSlackPayload({
        case_id: input.case_id,
        action_required: input.action_required,
        case_status: input.case_status,
        pdf_packet_status: input.pdf_packet_status,
        workspace_sync_status: input.workspace_sync_status,
        notification_status: input.notification_status,
        timestamp: slackNotifiedAt,
        dashboardUrl: buildAdminDashboardUrl(env),
      })
    ),
  })

  if (!response.ok) {
    throw new SlackNotificationError('send_failed')
  }

  return {
    ok: true,
    status: 'slack_sent',
    slack_notified_at: slackNotifiedAt,
    notification_status: 'slack_sent',
  }
}

export async function safelyNotifyOnboardingActionRequiredSlack(
  input: NotifyOnboardingActionRequiredSlackInput
): Promise<SafeSlackNotifyResult> {
  try {
    return await notifyOnboardingActionRequiredSlack(input)
  } catch (error: unknown) {
    return {
      ok: false,
      code: error instanceof SlackNotificationError ? error.code : 'send_failed',
      message: SAFE_FAILURE_MESSAGE,
    }
  }
}

function buildAdminDashboardUrl(env: SlackNotificationEnv): string | undefined {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/g, '')
  return baseUrl ? `${baseUrl}/admin/dashboard` : undefined
}
