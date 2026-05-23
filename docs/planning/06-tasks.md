# Onboarding Operations Hub Tasks

Last updated: 2026-05-23

## Task List

| Task | Scope | Dependencies | Output artifacts | Verification | Gate |
| --- | --- | --- | --- | --- | --- |
| 1. Case ID and status model | Define stable onboarding case ID and status/action rules. | Existing document status values. | `types/onboarding.ts`, `lib/onboarding/case-id.ts`, `lib/onboarding/status.ts` | `npm run test -- --runInBand __tests__/lib/onboarding/case-id.test.ts __tests__/lib/onboarding/status.test.ts` | Present in repo; verify in-session before claiming complete. |
| 2. Repository boundary | Add onboarding repository abstraction and Sheets-backed metadata mapping. | Task 1, DOCUMENT_STATUS schema. | `lib/onboarding/repository.ts`, `lib/onboarding/sheets-repository.ts` | `npm run test -- --runInBand __tests__/lib/onboarding/sheets-repository.test.ts` | Writes stay scoped to metadata columns. |
| 3. Admin demo dashboard | Surface operational state using demo-safe fixtures and filters. | Task 1, Task 2. | Admin dashboard route/components/tests. | `npm run test -- --runInBand __tests__/api/admin/dashboard-demo.test.ts __tests__/components/admin/dashboard-filters.test.ts` | Demo visibility must not imply live Drive/Slack sync. |
| 4. Drive archive adapter | Add mockable private Drive PDF archive adapter. | Task 1 case ID, OAuth assumption ledger. | `lib/google/drive-client.ts`, `lib/google/drive-archive.ts`, Drive tests, env docs. | `npm run test -- --runInBand __tests__/lib/google/drive-archive.test.ts` and `npm run type-check` | No route integration, no public links, no PII filenames. |
| 5. Email route archive integration | Gate existing send flow through PDF generation, archive skip/upload, and metadata update. | Task 4 verified. | `app/api/email/send/route.ts` changes and route tests. | Focused route tests plus type-check. | Require non-production Drive folder validation before live use. |
| 6. Slack adapter | Add PII-free Slack notification adapter and tests. | Task 1 statuses, Task 5 metadata. | Slack client/notification helper/tests. | Focused Slack tests and type-check. | No employee name/phone/email/PDF content in payload. |
| 7. Workspace sync orchestration | Coordinate Drive and Slack statuses with idempotency and retry-safe metadata patches. | Tasks 4-6. | Orchestration helper/tests. | Focused orchestration tests plus relevant repository tests. | Duplicate-safe retries; clear failure states. |
| 8. Production readiness | Final migration runbook, env validation, and deprecation notes. | Tasks 1-7. | `docs/production-readiness/onboarding-operations-release-checklist.md`, `docs/production-readiness/onboarding-operations-runbook.md`, `docs/production-readiness/onboarding-operations-rollback.md` | Full relevant test suite, `npm run type-check`, build, lint, and production dependency audit. | No production enablement without HR approval and secret review. |

## Current Verification Commands

```bash
npm run type-check
npm run test -- --runInBand
npm run build
npm run lint
npm audit --audit-level=high --omit=dev

# Task 1-7 focused historical checks
npm run test -- --runInBand __tests__/lib/google/drive-archive.test.ts
npm run test -- --runInBand __tests__/lib/onboarding/case-id.test.ts __tests__/lib/onboarding/status.test.ts __tests__/lib/onboarding/sheets-repository.test.ts __tests__/api/admin/dashboard-demo.test.ts __tests__/components/admin/dashboard-filters.test.ts __tests__/lib/google/drive-archive.test.ts
```

Task 8 production readiness docs:

- `docs/production-readiness/onboarding-operations-release-checklist.md`
- `docs/production-readiness/onboarding-operations-runbook.md`
- `docs/production-readiness/onboarding-operations-rollback.md`
- `docs/reports/task8-production-readiness-evidence-20260523.md`

Production live enablement remains NO-GO until HR approval, secret review, OAuth scope validation, Drive folder validation, Slack destination validation, verification commands, and dependency audit disposition are complete.
