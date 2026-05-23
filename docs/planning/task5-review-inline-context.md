# Task 5 Review Prompt (inline context)

Repo: `/opt/data/projects/hr-documents`. Read-only review. Do not edit files.

Current branch: `feature/onboarding-demo-dashboard`. Task 4 committed: Drive archive adapter exists in `lib/google/drive-archive.ts` and `lib/google/drive-client.ts` with tests.

Task 5 target: integrate Drive archive into `app/api/email/send/route.ts` safely.

Current email route behavior:
- Gets employee by `x-employee-id`.
- Finds existing document status row A:L with `findDocStatusByEmployeeId`.
- Blocks duplicate email when `email_sent_at` already exists and is not `sending`.
- Writes `sending` sentinel.
- Generates PDFs for `DOCUMENT_KEYS`; embeds signature if provided.
- Sends emails via `sendOnboardingEmails(employee, attachments)`.
- Updates all document statuses to sent, marks email sent, updates employee session completed.
- Deletes temp session dir.

Existing onboarding metadata repository:
- `createSheetsOnboardingRepository().findByEmployeeId(employeeId)` reads A:X and maps onboarding case metadata.
- `updateMetadata(employeeId, patch)` writes only M:X.
- Fields: `case_id`, `case_status`, `pdf_packet_status`, `workspace_sync_status`, `notification_status`, `action_required`, `blocked_reason`, `drive_file_id`, `drive_archived_at`, `last_case_event_at`, `case_schema_version`.

Task 4 adapter:
- `archiveOnboardingPdfPacket({ case_id, pdf, uploadClient?, folderId?, now? })`
- `safelyArchiveOnboardingPdfPacket(...)`
- `shouldArchivePdfPacket({ drive_file_id })`
- PII-free filename from case ID only.
- No public links or permissions.

Safety direction:
- Codex is sole code writer.
- Use TDD.
- Keep Drive integration default OFF via env flag, e.g. `GOOGLE_DRIVE_ARCHIVE_ENABLED=true`.
- When disabled, existing email behavior must remain unchanged and Drive client must not initialize.
- When enabled, upload generated PDF packet to private Drive folder and update M:X metadata.
- No Slack yet.
- No employee name/phone/email in Drive filename, logs, metadata, or response.
- No public links.
- Avoid direct Sheets A:L mutation beyond existing route behavior.

Key policy question:
- If Drive archive is enabled and archive fails, should email still send and metadata show `drive_sync_failed`, or should email be blocked?

Return Korean concise report with:
1. Recommended behavior
2. Status transition contract
3. Tests Codex must add
4. UX/portfolio/security concerns
5. PASS/CONCERNS verdict
