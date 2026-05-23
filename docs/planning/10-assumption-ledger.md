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

## Current Gates

- Do not call Google Drive or Slack from production routes until Task 5 gates pass.
- Do not store public Drive links in onboarding metadata.
- Do not include employee PII in archive filenames, Slack payloads, or error messages.
