# Security

This repository is a demo HR onboarding app. It should use dummy onboarding data and generated demo documents only; do not commit real employee PII, production credentials, or signed real contracts.

## npm audit status

The currently open npm audit advisories are not considered reachable attack surface for this demo because they are limited to development tooling or code paths that are not exposed to unauthenticated users in the demo flow. Reassess and patch them before treating this codebase as production software.

## Current posture

- Authentication uses signed JWT session cookies.
- API flows include rate-limit handling around external document generation calls.
- PII is isolated from the repository; local templates and demo PDFs must contain dummy data only.
- Secrets are read from environment variables and `.env.example` documents expected names without real values.
- Generated demo assets under `public/demo/` must be clearly fake and must not contain real names, phone numbers, signatures, or company-confidential data.

## Reporting

For this demo repository, report security issues to the project maintainer through the normal private project channel. Include the affected route, required privileges, and a minimal reproduction using dummy data.
