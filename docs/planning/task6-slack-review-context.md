# Task 6 Slack Adapter Review Context

Read-only review. Do not edit files.

Implement Task 6: PII-free Slack notification adapter and tests.

Contract:
- Slack payload must not include employee name, phone, email, sign_hash, drive_file_id, PDF URL/content, OAuth tokens, webhook URL, folder ID, or raw thrown error messages.
- Payload should use case_id, safe status/action fields, and a generic admin dashboard link if useful.
- Default live Slack integration should be OFF unless explicitly enabled and webhook configured.
- Task 6 scope is adapter + tests only. Task 7 will orchestrate Drive+Slack metadata.
- MVP should focus on action-required notifications, not success spam.

Existing code:
- `types/onboarding.ts`: NotificationStatus includes `failed`; action_required includes `slack_notify_failed`.
- `lib/onboarding/status.ts`: notification failed maps to action_required and case_status.
- `lib/onboarding/workspace-archive.ts`: after email/Drive, notification_status remains `email_sent`.
- `lib/onboarding/sheets-repository.ts`: updateMetadata can write `notification_status` and `slack_notified_at` to M:X.

Please inspect repo files if needed and return Korean concise review:
1. Recommended Task 6 behavior
2. Payload contract and allowed/forbidden fields
3. Tests Codex must add
4. Whether to include success notifications now
5. PASS/CONCERNS verdict for starting implementation