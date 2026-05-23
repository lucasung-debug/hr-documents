# Onboarding Operations Release Checklist

Last updated: 2026-05-23

Production live enablement is a controlled release gate for the onboarding operations hub. The default decision is NO-GO until every approval, secret, environment, and verification item below is signed off.

## Release Decision

| Gate | Required evidence | Decision |
| --- | --- | --- |
| HR approval | HR owner approves live Drive archive and Slack notification behavior for production onboarding cases. | NO-GO until signed off. |
| Secret review | Engineering owner verifies all production secrets, including `.env.local` values, `JWT_SECRET`, `HR_EMAIL_RECIPIENTS`, OAuth refresh token scopes, Drive folder ID, and Slack webhook URL, without exposing secret values in docs, chat, logs, or commits. | NO-GO until signed off. |
| Google OAuth scopes | Refresh token includes `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/spreadsheets`, and the minimum Drive scope required for the active behavior. `https://www.googleapis.com/auth/drive.file` is required for private archive uploads. `https://www.googleapis.com/auth/drive.readonly` is an existing or legacy Sheets-PDF export scope only if that export path still needs it; it is not a reason to over-scope new archive behavior. | NO-GO if `drive.file` is missing for archive upload. |
| Drive folder ownership and access | `GOOGLE_DRIVE_ARCHIVE_FOLDER_ID` points to a private HR-controlled folder. Folder sharing is limited to approved HR/operators. Public or link-wide access is disabled. | NO-GO if ownership or access is unclear. |
| Slack destination | `SLACK_ONBOARDING_WEBHOOK_URL` posts only to the approved HR operations channel. Test post contains case ID/status only and no employee PII. | NO-GO if webhook destination is unverified. |
| Dependency audit | Production dependency advisories are resolved with non-breaking fixes or explicitly risk-accepted by the release owner. Breaking upgrades are tracked separately. | NO-GO without resolution or written risk acceptance. |
| Verification suite | Required commands complete with accepted results recorded in release notes. | NO-GO if type-check, tests, build, or lint fail. |

Final condition: production live enablement remains NO-GO until HR approval and secret review are signed off.

## Environment Checklist

Populate `.env.local` only in the target runtime environment. Do not paste real values into pull requests, issue comments, docs, screenshots, or logs.

```bash
# Google Sheets and Gmail OAuth
GOOGLE_SPREADSHEET_ID=[REDACTED]
SHEET_EMPLOYEE_MASTER=EMPLOYEE_MASTER
SHEET_DOCUMENT_STATUS=DOCUMENT_STATUS
GMAIL_CLIENT_ID=[REDACTED]
GMAIL_CLIENT_SECRET=[REDACTED]
GMAIL_CLIENT_REFRESH_TOKEN=[REDACTED]
GMAIL_SENDER_ADDRESS=[REDACTED]

# Google Drive archive: default OFF until approved
GOOGLE_DRIVE_ARCHIVE_ENABLED=false
GOOGLE_DRIVE_ARCHIVE_FOLDER_ID=[REDACTED]

# Slack notifications: default OFF until approved
SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false
SLACK_ONBOARDING_WEBHOOK_URL=[REDACTED]

# App URL used in Slack dashboard links
NEXT_PUBLIC_BASE_URL=[REDACTED]

# Authentication and notification routing
JWT_SECRET=[REDACTED]
HR_EMAIL_RECIPIENTS=[REDACTED]
```

Before changing either feature flag to `true`, verify:

- HR approval is recorded for live onboarding operations behavior.
- Secret review covers every production secret and the real values are present only in the production secret store or `.env.local`.
- Google OAuth refresh token was re-issued after adding `drive.file` for archive upload. Keep `drive.readonly` only if the existing Sheets-PDF export path still requires it.
- Drive archive folder is private, HR-owned, and does not grant public or link-wide access.
- Slack webhook posts to the approved HR operations channel and payloads include case ID/status only.

## Verification Commands

Run these commands from the repository root before release. Record the exact result in the release notes.

```bash
npm run type-check
npm run test -- --runInBand
npm run build
npm run lint
npm audit --audit-level=high --omit=dev
```

`npm audit` may fail because of known production dependency advisories. Run plain `npm audit fix` only after reviewing semver and lockfile impact and only if the resulting diff is acceptable for this release branch. Do not run `npm audit fix --force` as part of this release gate.

## Dependency Audit Decision Matrix

| Audit result | Decision | Required action |
| --- | --- | --- |
| No high production advisories | GO for dependency gate. | Record command output summary. |
| Non-breaking `npm audit fix` candidate | CONDITIONAL GO after fix and regression verification. | Review semver and lockfile impact first, apply only non-breaking updates on the release branch, review the resulting diff, then rerun type-check, tests, build, lint, and audit. |
| Breaking upgrade candidate such as Next, Nodemailer, Google APIs, or transitive major framework changes | NO-GO for in-place production enablement. | Open a separate branch, perform full regression testing, and get release owner approval before merging. |
| Advisory cannot be fixed without breaking changes before release | NO-GO unless explicitly risk-accepted. | Document advisory, affected package, exposure, compensating controls, owner, and expiration date for risk acceptance. |
| Audit command fails for registry/network reasons | NO-GO until rerun succeeds or release owner accepts the missing evidence. | Retry from a stable network and record the final result. |

## GO / NO-GO Summary

Production live enablement is GO only when all of the following are true:

- HR approval is signed off.
- Secret review is signed off.
- Drive and Slack feature flags are intentionally enabled by an approved operator.
- Google OAuth scope validation confirms `drive.file` for archive upload and confirms any retained `drive.readonly` need is limited to existing or legacy Sheets-PDF export behavior.
- Drive folder ownership/access validation confirms private HR-controlled storage.
- Slack destination/channel validation confirms the approved HR operations channel.
- Verification commands are recorded with accepted results.
- Dependency audit is resolved or explicitly risk-accepted.

Until then, keep:

```bash
GOOGLE_DRIVE_ARCHIVE_ENABLED=false
SLACK_ONBOARDING_NOTIFICATIONS_ENABLED=false
```

Production live enablement remains NO-GO until approvals and secret review are signed off.
