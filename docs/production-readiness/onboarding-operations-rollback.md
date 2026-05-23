# Onboarding Operations Rollback Notes

Last updated: 2026-05-23

Rollback for the onboarding operations hub should stop new external side effects while preserving the email-only document delivery flow, existing signed documents, and existing Sheets records.

## Fast Rollback by Feature Flags

Set both live side-effect flags to `false` in the runtime environment:

```bash
GOOGLE_DRIVE_ARCHIVE_ENABLED=false
SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false
```

Expected behavior:

- New Drive archive uploads stop.
- New Slack notifications stop.
- Email sending remains available through the existing email-only flow.
- Existing signed documents, sent emails, Drive files, and Sheets records remain in place.

Do not remove secrets as the first rollback step unless the secret itself is suspected to be exposed or compromised. Disabling flags is the fastest reversible control.

## Preserve Email-Only Flow

The onboarding operations integrations run after email success. During rollback:

1. Keep the email route operational.
2. Keep `GOOGLE_DRIVE_ARCHIVE_ENABLED=false`.
3. Keep `SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false`.
4. Confirm HR can continue using existing email evidence and legacy DOCUMENT_STATUS columns A:L.
5. Use the dashboard only as a read-only operational aid if it is not causing confusion.

## Stop New External Side Effects

To stop new external side effects while keeping records:

1. Disable Drive archive and Slack notification flags.
2. Redeploy or restart the runtime if required by the hosting environment.
3. Send a controlled test case only after HR approves the test.
4. Confirm no new Drive file is created.
5. Confirm no new Slack message is posted.
6. Confirm email delivery still works.

Existing signed documents and Sheets records should be preserved. Do not automatically delete Drive files or clear metadata during rollback.

## Manual Cleanup Guidance

Manual cleanup is non-destructive by default:

- Prefer marking or annotating cases in Sheets metadata over deleting data.
- Do not delete Drive files automatically.
- Do not bulk-clear M:X metadata.
- Do not alter A:L legacy document columns as part of onboarding operations cleanup.
- If a Drive file was created in the wrong private folder, restrict access first, then have an approved HR/Drive owner decide whether to move or archive it.
- If a Slack message was posted to the wrong channel, coordinate with the Slack workspace owner and HR before taking action.

If sensitive data appears in Slack, Drive sharing, logs, or docs, treat it as an incident and redact the value as `[REDACTED]` in all written reports.

## Sheets M:X Data Correction

Correct only onboarding metadata columns M:X unless HR explicitly authorizes a legacy document status change.

Common safe corrections:

- Set `workspace_sync_status=failed` when archive state is known to be failed.
- Set `action_required=drive_sync_failed`, `pdf_packet_failed`, `slack_notify_failed`, or `hr_review` when an operator must act.
- Set `blocked_reason` to a safe, non-PII reason such as `Drive archive failed`.
- Clear `slack_notified_at` only when HR confirms no Slack notification was sent for that `case_id`.
- Leave `drive_file_id` and `drive_archived_at` intact when a private Drive file exists.

Do not touch A:L legacy columns during metadata correction:

- A `employee_id`
- B `name`
- C `phone`
- D:I document statuses
- J `all_completed_at`
- K `email_sent_at`
- L `sign_hash`

## Re-Enable Checklist After Rollback

Before re-enabling Drive archive or Slack notifications:

1. Identify the rollback cause and owner.
2. Confirm the fix is merged and deployed.
3. Run verification:

```bash
npm run type-check
npm run test -- --runInBand
npm run build
npm run lint
npm audit --audit-level=high --omit=dev
```

4. Confirm HR approval is still valid for live behavior.
5. Repeat secret review.
6. Validate Google OAuth scopes, especially `drive.file`.
7. Validate Drive folder private ownership and access.
8. Validate Slack webhook destination/channel.
9. Re-enable one side effect at a time when possible.
10. Monitor the first production case by `case_id` through email success, Drive archive, Sheets metadata, Slack notification, and dashboard state.

Production live enablement remains NO-GO after rollback until HR approval, secret review, verification, and dependency audit gates are satisfied again.
