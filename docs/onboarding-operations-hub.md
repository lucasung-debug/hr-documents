# Onboarding Operations Hub

## Promise

One private, case-ID-driven loop for tracking onboarding packets from document completion to archive and HR notification.

## 60-Second Demo Path

1. Open the admin dashboard in demo mode.
2. Filter for completed document packets awaiting archive.
3. Inspect case status, action required, Drive archive timestamp, and notification state.
4. Confirm no employee PII is needed to understand operational progress.

## Core Loop

1. Employee documents reach signed/completed state.
2. The system derives a stable `case_id`.
3. Email success enters the onboarding operations path through `syncOnboardingWorkspace`.
4. PDF packet generation marks `pdf_packet_status`.
5. Drive archive stores the private packet using a case-ID filename.
6. Sheets metadata records `drive_file_id`, `drive_archived_at`, and sync status.
7. Slack/email notification state advances after archive evidence exists.
8. Dashboard filters show pending work and failures.

## Evidence Contract

- Case identity: `case_id`.
- PDF evidence: `pdf_packet_status`.
- Drive evidence: private `drive_file_id` and `drive_archived_at`.
- Workspace state: `workspace_sync_status`.
- Notification evidence: `notification_status` and `slack_notified_at`.
- Human action: `action_required` and `blocked_reason`.

## Privacy Guardrails

- Archive filenames use `case_id`, not employee name, phone, or email.
- Drive uploads do not create public permissions.
- Domain metadata stores private file IDs, not public `webViewLink` or `webContentLink`.
- Slack payloads must stay PII-free and reference case state only.
- Errors must not expose OAuth tokens, webhook URLs, PDF content, or employee PII.

## What This Is Not

- Not a live Drive or Slack integration until production readiness gates are approved.
- Not a public document sharing system.
- Not a replacement for HR review of failed or blocked cases.
- Not a source of truth for employee identity beyond existing Sheets records.

## Migration and Deprecation Note

Onboarding metadata extends DOCUMENT_STATUS columns M:X while legacy document completion columns remain in place. New integrations should write through onboarding repository boundaries and avoid direct route-level Sheets mutations except where explicitly migrated and tested.

## Production Readiness

- Release checklist: [docs/production-readiness/onboarding-operations-release-checklist.md](production-readiness/onboarding-operations-release-checklist.md)
- Operator runbook: [docs/production-readiness/onboarding-operations-runbook.md](production-readiness/onboarding-operations-runbook.md)
- Rollback notes: [docs/production-readiness/onboarding-operations-rollback.md](production-readiness/onboarding-operations-rollback.md)
- Task 8 evidence report: [docs/reports/task8-production-readiness-evidence-20260523.md](reports/task8-production-readiness-evidence-20260523.md)

Production live enablement remains NO-GO until HR approval, secret review, OAuth scope validation, Drive folder validation, Slack destination validation, verification commands, and dependency audit disposition are complete.
