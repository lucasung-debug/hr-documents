# Onboarding Operations Runbook

Last updated: 2026-05-23

This runbook covers the onboarding operations flow after signed employee documents are emailed. It distinguishes demo visibility from live external side effects and keeps production enablement gated by HR approval and secret review.

## Normal Flow

1. Email delivery succeeds for a completed onboarding document set.
2. The email route calls `syncOnboardingWorkspace`.
3. `syncOnboardingWorkspace` coordinates PDF packet generation, Drive archive, Sheets metadata, and Slack notification behavior according to feature flags.
4. PDF packet generation produces one onboarding packet from the email attachments.
5. Drive archive uploads the packet to the private HR folder with a case-ID filename.
6. Sheets metadata records archive and workspace state in DOCUMENT_STATUS columns M:X.
7. Slack action-required notifications are sent only when `action_required` is not `none`.
8. The admin dashboard reads case/status metadata and shows operational state without requiring employee PII.

## Standard Entry Point

Use `syncOnboardingWorkspace` as the standard route integration point for onboarding workspace side effects.

Avoid calling `archiveEmailOnboardingPacket` directly from new route code. The direct archive skip path can reset notification/action metadata while marking an existing archive as synced. `syncOnboardingWorkspace` is the orchestration boundary that preserves Slack retry guards and action-required state.

Feature flags:

- `GOOGLE_DRIVE_ARCHIVE_ENABLED=false` disables Drive archive behavior.
- `SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false` disables Slack notification behavior.
- Both flags are disabled by default until HR approval and secret review are complete.

## Sheets M:X Schema

DOCUMENT_STATUS legacy columns A:L remain owned by the existing document completion flow. Onboarding operations metadata is appended in M:X.

| Column | Field | Purpose |
| --- | --- | --- |
| M | `case_id` | Stable onboarding case identifier. |
| N | `case_status` | Overall onboarding case state. |
| O | `pdf_packet_status` | PDF packet state: generated, failed, or related status. |
| P | `workspace_sync_status` | External workspace sync state. |
| Q | `notification_status` | Email/Slack notification state. |
| R | `action_required` | Operator action required, or `none`. |
| S | `blocked_reason` | Safe operator-facing reason for blocked/failure states. |
| T | `drive_file_id` | Private Drive file ID, not a public link. |
| U | `drive_archived_at` | ISO timestamp for Drive archive success. |
| V | `slack_notified_at` | ISO timestamp for Slack notification success. |
| W | `last_case_event_at` | ISO timestamp for latest case metadata event. |
| X | `case_schema_version` | Metadata schema version. |

## Migration and Backfill Procedure

1. Create a backup copy of the DOCUMENT_STATUS sheet before any migration or backfill.
2. Confirm the sheet has headers for columns M:X. Add only missing M:X headers.
3. Do not overwrite A:L legacy columns. They contain employee ID, name, phone, document statuses, completion timestamp, email timestamp, and sign hash.
4. Backfill `case_id` for rows with an employee ID and empty M column using the repository/case-ID logic already used by the application.
5. For rows without archive evidence, leave `drive_file_id`, `drive_archived_at`, and `slack_notified_at` empty.
6. For rows with incomplete metadata, write only the missing M:X fields needed for case visibility.
7. Verify repository behavior with tests before and after the migration.

Required verification after a migration/backfill change:

```bash
npm run type-check
npm run test -- --runInBand
```

For release verification, also run build, lint, and audit as listed in the release checklist.

## Result and Skip Reason Mapping

Drive archive results:

| Result | Meaning | Operator action |
| --- | --- | --- |
| `disabled` | `GOOGLE_DRIVE_ARCHIVE_ENABLED` is not `true`; no archive attempt was made. | Expected before production approval. Keep disabled unless the release checklist is signed off. |
| `case_not_found` | No onboarding case row was found for the employee ID. | Follow the Case Not Found procedure. Do not create ad hoc rows without HR/operator confirmation. |
| `skipped_existing_archive` | Existing archive evidence means upload is idempotently skipped. | Confirm `drive_file_id` and `drive_archived_at` point to the expected private archive evidence. |
| `synced` | PDF packet archive and metadata update completed. | No action unless dashboard or HR review shows a mismatch. |
| `failed` with `pdf_packet_failed` | PDF packet generation failed before archive upload. | Follow PDF Packet Failed. |
| `failed` with `drive_sync_failed` | Drive upload/configuration failed after packet generation. | Follow Drive Archive Failed. |
| `failed` with `metadata_update_failed` | Archive or Slack orchestration could not persist metadata reliably. | Follow Metadata Update Failure before retrying. |

Slack results:

| Result | Meaning | Operator action |
| --- | --- | --- |
| `disabled` | `SLACK_ONBOARDING_NOTIFICATIONS_ENABLED` is not `true`; no Slack attempt was made. | Expected before production approval. Keep disabled unless the release checklist is signed off. |
| `skipped_no_case` | No onboarding case row was available for notification. | Follow Case Not Found. |
| `skipped_not_required` | Case has no action-required state, so Slack notification is unnecessary. | No action. |
| `skipped_already_notified` | `slack_notified_at` or `notification_status=both` indicates prior notification. | Check the approved HR Slack channel by `case_id` before any retry. |
| `sent` | Slack webhook succeeded and metadata was updated. | No action unless HR reports missing notification. |
| `failed` | Slack send or Slack metadata update failed. | Follow Slack Notify Failed or Slack POST Succeeded but Metadata Write Failed based on channel evidence. |

## Incident Procedures

### Drive Archive Failed

Symptoms:

- `workspace_sync_status=failed`
- `action_required=drive_sync_failed`
- `blocked_reason=Drive archive failed`

Operator response:

1. Keep email-only flow intact; signed documents have already been sent.
2. Verify `GOOGLE_DRIVE_ARCHIVE_ENABLED` and `GOOGLE_DRIVE_ARCHIVE_FOLDER_ID`.
3. Confirm the OAuth refresh token includes `drive.file`.
4. Confirm the Drive folder exists, is private, and is accessible by the OAuth principal.
5. Retry through the normal route or orchestration path after correcting configuration.
6. Do not manually create public Drive links.

### PDF Packet Failed

Symptoms:

- `pdf_packet_status=failed`
- `workspace_sync_status=failed`
- `action_required=pdf_packet_failed`
- `blocked_reason=PDF packet generation failed`

Operator response:

1. Confirm the original email attachments were generated and sent.
2. Inspect application logs for safe failure context only; do not log PDF content or raw thrown errors.
3. Retry after the packet generation issue is corrected.
4. If needed, HR can operate from the already sent email while archive is blocked.

### Slack Notify Failed

Symptoms:

- `notification_status=failed`
- `action_required=slack_notify_failed`
- `blocked_reason=Slack notification failed`

Operator response:

1. Verify `SLACK_ONBOARDING_NOTIFICATIONS_ENABLED` and webhook configuration.
2. Confirm the webhook posts to the approved HR operations channel.
3. Confirm Slack payloads contain only case ID/status fields.
4. Retry through `syncOnboardingWorkspace` after correcting configuration.

### Slack POST Succeeded but Metadata Write Failed

Symptoms:

- HR sees a Slack notification, but `slack_notified_at` or `notification_status` was not persisted.

Operator response:

1. Treat the case as potentially already notified.
2. Check the approved HR Slack channel by `case_id`.
3. Correct Sheets access or metadata write issues.
4. Retry carefully. A duplicate Slack notification can occur because the current MVP writes Slack metadata after the webhook POST succeeds.
5. Future hardening should use an outbox or sentinel write before Slack POST to make this dual-write path fully duplicate-safe.

### Metadata Update Failure

Symptoms:

- Email delivery succeeds, but M:X metadata does not reflect archive or notification state.
- `syncOnboardingWorkspace` may return archive `failed` with `metadata_update_failed`.

Operator response:

1. Preserve email-only flow; do not resend employee email unless HR explicitly requests it.
2. Verify Sheets API access, spreadsheet ID, tab name, and row location.
3. Update only M:X metadata after confirming the correct employee row.
4. Do not change A:L legacy document columns as part of metadata repair.

### Case Not Found

Symptoms:

- Archive returns `case_not_found`.
- Slack returns `skipped_no_case`.

Operator response:

1. Confirm the employee ID exists in DOCUMENT_STATUS.
2. Confirm the route used the expected employee ID.
3. If the row is missing, follow the existing document status initialization flow.
4. Do not create ad hoc metadata rows without HR/operator confirmation.

## Privacy and Security Notes

- Slack must show case ID/status only.
- Slack must not include employee name, email, phone, PDF content, Drive public links, webhook URLs, OAuth tokens, or raw error details.
- Drive filenames must use `case_id`, not employee PII.
- Drive metadata stores private `drive_file_id`, not public `webViewLink` or `webContentLink`.
- Logs should not include raw thrown errors from Google, Slack, PDF generation, or Sheets calls. Use safe status/reason values.
- Any sensitive-looking value found during operations should be treated as `[REDACTED]` in notes and reports.

## Demo vs Live Behavior

Demo mode dashboard data is for stakeholder inspection and does not prove live Drive or Slack side effects are enabled.

Live behavior requires all of the following:

- HR approval.
- Secret review.
- `GOOGLE_DRIVE_ARCHIVE_ENABLED=true` only after Drive validation.
- `SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=true` only after Slack destination validation.
- Production dependency audit resolved or risk-accepted.

Without those gates, the production decision remains NO-GO for live enablement even if the dashboard renders correctly.
