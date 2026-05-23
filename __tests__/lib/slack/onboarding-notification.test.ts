import {
  buildOnboardingActionRequiredSlackPayload,
  isSlackNotificationEnabled,
  notifyOnboardingActionRequiredSlack,
  safelyNotifyOnboardingActionRequiredSlack,
  shouldNotifySlackForAction,
} from '@/lib/slack/onboarding-notification'
import type { NotifyOnboardingActionRequiredSlackInput } from '@/lib/slack/onboarding-notification'
import type { OnboardingActionRequired } from '@/types/onboarding'

const fixedNow = new Date('2026-05-23T15:30:00.000Z')
const enabledEnv = {
  SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'true',
  SLACK_ONBOARDING_WEBHOOK_URL: 'https://hooks.slack.com/services/T000/B000/secret',
  NEXT_PUBLIC_BASE_URL: 'https://hr.example.com',
}
const disabledEnv = {
  SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'false',
  SLACK_ONBOARDING_WEBHOOK_URL: 'https://hooks.slack.com/services/T000/B000/secret',
  NEXT_PUBLIC_BASE_URL: 'https://hr.example.com',
}

type SensitiveFixtureFields = {
  blocked_reason: string
  employee_id: string
  name: string
  phone: string
  email: string
  sign_hash: string
  drive_file_id: string
  pdf_url: string
  drive_folder_id: string
  oauth_token: string
}

type SlackFixtureInput = NotifyOnboardingActionRequiredSlackInput & SensitiveFixtureFields

function makeActionInput(overrides: Partial<SlackFixtureInput> = {}): SlackFixtureInput {
  return {
    case_id: 'ONB-20260523-0001',
    case_status: 'action_required',
    pdf_packet_status: 'failed',
    workspace_sync_status: 'pending',
    notification_status: 'email_sent',
    action_required: 'pdf_packet_failed',
    blocked_reason: 'PDF failed for Kim Sensitive at kim@example.com',
    employee_id: 'EMP001',
    name: 'Kim Sensitive',
    phone: '010-1234-5678',
    email: 'kim@example.com',
    sign_hash: 'sign-secret-hash',
    drive_file_id: 'drive-file-123',
    pdf_url: 'https://drive.google.com/private-pdf',
    drive_folder_id: 'folder-123',
    oauth_token: 'oauth-token-secret',
    ...overrides,
  }
}

function expectNoSensitiveValues(serialized: string) {
  expect(serialized).not.toContain('EMP001')
  expect(serialized).not.toContain('Kim Sensitive')
  expect(serialized).not.toContain('010-1234-5678')
  expect(serialized).not.toContain('kim@example.com')
  expect(serialized).not.toContain('sign-secret-hash')
  expect(serialized).not.toContain('drive-file-123')
  expect(serialized).not.toContain('private-pdf')
  expect(serialized).not.toContain('hooks.slack.com')
  expect(serialized).not.toContain('oauth-token-secret')
  expect(serialized).not.toContain('folder-123')
  expect(serialized).not.toContain('PDF failed for')
}

function getFetchBody(fetchImpl: jest.Mock): string {
  const init = fetchImpl.mock.calls[0]?.[1] as { body?: unknown } | undefined

  if (typeof init?.body !== 'string') {
    throw new Error('Expected fetch body to be a string')
  }

  return init.body
}

async function expectRejectedError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error)
    return error as Error
  }

  throw new Error('Expected promise to reject')
}

describe('Slack onboarding notification adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('enables Slack notifications only for exact true', () => {
    expect(isSlackNotificationEnabled({})).toBe(false)
    expect(isSlackNotificationEnabled({ SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'false' })).toBe(false)
    expect(isSlackNotificationEnabled({ SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'TRUE' })).toBe(false)
    expect(isSlackNotificationEnabled({ SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: ' true ' })).toBe(false)
    expect(isSlackNotificationEnabled({ SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'true' })).toBe(true)
  })

  it('returns disabled and does not call fetch when the gate is off', async () => {
    const fetchImpl = jest.fn()

    const result = await safelyNotifyOnboardingActionRequiredSlack({
      ...makeActionInput(),
      env: disabledEnv,
      fetchImpl,
      now: () => fixedNow,
    })

    expect(result).toEqual({ ok: true, status: 'disabled' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns a safe configuration error without fetch when enabled without webhook', async () => {
    const fetchImpl = jest.fn()

    const result = await safelyNotifyOnboardingActionRequiredSlack({
      ...makeActionInput(),
      env: { SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'true' },
      fetchImpl,
      now: () => fixedNow,
    })

    expect(result).toEqual({
      ok: false,
      code: 'configuration_error',
      message: 'Slack notification failed',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('notifies only action-required codes', () => {
    const actions: OnboardingActionRequired[] = [
      'none',
      'hr_review',
      'pdf_packet_failed',
      'drive_sync_failed',
      'slack_notify_failed',
    ]

    expect(actions.map((action) => [action, shouldNotifySlackForAction(action)])).toEqual([
      ['none', false],
      ['hr_review', true],
      ['pdf_packet_failed', true],
      ['drive_sync_failed', true],
      ['slack_notify_failed', true],
    ])
  })

  it('returns not_action_required and does not call fetch for none', async () => {
    const fetchImpl = jest.fn()

    const result = await safelyNotifyOnboardingActionRequiredSlack({
      ...makeActionInput({ action_required: 'none' }),
      env: enabledEnv,
      fetchImpl,
      now: () => fixedNow,
    })

    expect(result).toEqual({ ok: true, status: 'not_action_required' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('builds an allowlisted, PII-free payload with a generic dashboard URL', () => {
    const payload = buildOnboardingActionRequiredSlackPayload({
      ...makeActionInput(),
      timestamp: fixedNow.toISOString(),
      dashboardUrl: 'https://hr.example.com/admin/dashboard',
    })
    const serialized = JSON.stringify(payload)

    expect(serialized).toContain('ONB-20260523-0001')
    expect(serialized).toContain('action_required')
    expect(serialized).toContain('pdf_packet_failed')
    expect(serialized).toContain('PDF packet generation failed. Please review the onboarding case.')
    expect(serialized).toContain('https://hr.example.com/admin/dashboard')
    expect(serialized).not.toContain('https://hr.example.com/admin/dashboard?case_id=')
    expectNoSensitiveValues(serialized)
  })

  it('returns slack_sent metadata with deterministic slack_notified_at on HTTP ok', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 })

    const result = await safelyNotifyOnboardingActionRequiredSlack({
      ...makeActionInput(),
      env: enabledEnv,
      fetchImpl,
      now: () => fixedNow,
    })

    expect(result).toEqual({
      ok: true,
      status: 'slack_sent',
      slack_notified_at: '2026-05-23T15:30:00.000Z',
      notification_status: 'slack_sent',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      enabledEnv.SLACK_ONBOARDING_WEBHOOK_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: expect.any(String),
      })
    )

    const body = getFetchBody(fetchImpl)
    const payload = JSON.parse(body)
    expect(payload).toMatchObject({
      text: 'PDF packet generation failed. Please review the onboarding case.',
    })
    expect(body).toContain('ONB-20260523-0001')
    expect(body).toContain('https://hr.example.com/admin/dashboard')
    expectNoSensitiveValues(body)
  })

  it('raw notifier rejects with a safe error and no fetch when enabled without webhook', async () => {
    const fetchImpl = jest.fn()

    const error = await expectRejectedError(
      notifyOnboardingActionRequiredSlack({
        ...makeActionInput(),
        env: { SLACK_ONBOARDING_NOTIFICATIONS_ENABLED: 'true' },
        fetchImpl,
        now: () => fixedNow,
      })
    )

    expect(error.message).toBe('Slack notification failed')
    expectNoSensitiveValues(error.message)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('raw notifier rejects with a safe error on non-2xx without response body, webhook, or PII', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('failed for Kim Sensitive via https://hooks.slack.com/services/T000'),
    })

    const error = await expectRejectedError(
      notifyOnboardingActionRequiredSlack({
        ...makeActionInput(),
        env: enabledEnv,
        fetchImpl,
        now: () => fixedNow,
      })
    )

    expect(error.message).toBe('Slack notification failed')
    expectNoSensitiveValues(error.message)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns safe send_failed on non-2xx response without raw body, webhook, or PII', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('failed for Kim Sensitive via https://hooks.slack.com/services/T000'),
    })

    const result = await safelyNotifyOnboardingActionRequiredSlack({
      ...makeActionInput(),
      env: enabledEnv,
      fetchImpl,
      now: () => fixedNow,
    })

    expect(result).toEqual({
      ok: false,
      code: 'send_failed',
      message: 'Slack notification failed',
    })
    expectNoSensitiveValues(JSON.stringify(result))
  })

  it('returns safe send_failed when fetch throws a PII-containing error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(
      new Error('Slack failed for Kim Sensitive, kim@example.com, https://hooks.slack.com/services/T000')
    )

    const result = await safelyNotifyOnboardingActionRequiredSlack({
      ...makeActionInput(),
      env: enabledEnv,
      fetchImpl,
      now: () => fixedNow,
    })

    expect(result).toEqual({
      ok: false,
      code: 'send_failed',
      message: 'Slack notification failed',
    })
    expectNoSensitiveValues(JSON.stringify(result))
  })

  it('uses a concise Slack webhook compatible payload', () => {
    const payload = buildOnboardingActionRequiredSlackPayload({
      ...makeActionInput({ action_required: 'drive_sync_failed' }),
      timestamp: fixedNow.toISOString(),
      dashboardUrl: 'https://hr.example.com/admin/dashboard',
    })
    const serialized = JSON.stringify(payload)

    expect(payload).toHaveProperty('text')
    expect(payload).toHaveProperty('blocks')
    expect(Array.isArray(payload.blocks)).toBe(true)
    expect(serialized.length).toBeLessThan(2500)
    expect(serialized).toContain('Drive archive sync failed. Please review the onboarding case.')
    expectNoSensitiveValues(serialized)
  })
})
