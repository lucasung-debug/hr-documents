# Onboarding Operations Hub Assumption Ledger

Last updated: 2026-05-23

## Critical Assumptions

| Area | Assumption | Risk | Validation |
| --- | --- | --- | --- |
| Drive OAuth scope | The existing OAuth client can be re-issued with `https://www.googleapis.com/auth/drive.file` for private archive uploads. | Uploads fail in production if the refresh token lacks scope. | Test with a non-production Drive folder before Task 5 integration. |
| Drive folder ID | `GOOGLE_DRIVE_ARCHIVE_FOLDER_ID` points to a private HR-controlled folder. | Files may archive to the wrong workspace location. | Verify folder ownership and access policy out of band. |
| Sheets M:X migration | Onboarding metadata remains in DOCUMENT_STATUS columns M:X. | Route updates could overwrite legacy document columns A:L. | Keep repository writes scoped to metadata columns and run sheets repository tests. |
| Slack PII-free contract | Slack notifications must reference case ID/status only, not name, phone, email, or PDF content. | Notification payload leaks employee PII. | Add unit tests before Slack adapter implementation. |
| Idempotency and retry | Drive archive should skip upload when `drive_file_id` exists and retry orchestration should be caller-owned. | Duplicate PDFs appear after route retries. | Use `shouldArchivePdfPacket` before upload in Task 5. |
| Dashboard demo visibility | Demo dashboard data is representative but clearly separate from live integrations. | Stakeholders confuse demo data for production sync. | Keep demo mode explicit in dashboard route and fixtures. |
| Production approval gate | Production live enablement requires HR approval and secret review before Drive archive or Slack notifications are enabled. | External side effects could be enabled before HR/process owners accept behavior and secrets are checked. | Keep both feature flags default OFF and require signed release checklist approval. |
| Workspace sync entry point | `syncOnboardingWorkspace` is the standard route integration point for Drive archive, Sheets metadata, and Slack notifications. | New route code that calls lower-level helpers directly can reset notification/action metadata or bypass retry guards. | Document the entry point in the runbook and review new route integrations for direct `archiveEmailOnboardingPacket` calls. |
| Dependency audit disposition | Production dependency advisories must be resolved or explicitly risk-accepted before live production enablement. | Known high/moderate advisories could ship without owner approval or compensating controls. | Run `npm audit --audit-level=high --omit=dev` and record fix/risk-acceptance decision before enablement. Current Task 8 evidence is recorded in `docs/reports/task8-production-readiness-evidence-20260523.md`. |

## Current Gates

- Do not enable live Google Drive or Slack side effects until HR approval and secret review are signed off.
- Keep `GOOGLE_DRIVE_ARCHIVE_ENABLED=false` and `SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false` until approved.
- Use `syncOnboardingWorkspace` as the standard route integration entry point.
- Do not store public Drive links in onboarding metadata.
- Do not include employee PII in archive filenames, Slack payloads, or error messages.
- Resolve or explicitly risk-accept production dependency audit findings before live production enablement.
