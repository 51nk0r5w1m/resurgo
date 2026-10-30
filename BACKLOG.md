# Resurgo MVP backlog

**Scope:** P0 external pilot, P1 complete MVP, P2 post-MVP integrations. Points are Fibonacci estimates, not hours. No issues have been created on GitHub.

## Global definition of done

Every ticket needs a passing functional test, separately verified security/compliance criteria, code review, documentation, and evidence in CI. All resource APIs require case-scoped authorization and negative tests. No real client information in development or test fixtures.

**Baseline:** OWASP ASVS v5.0.0 Level 2 proposed target, OWASP Top 10:2025, OWASP API Security Top 10:2023, WCAG 2.2 AA. Establish a requirement-by-requirement ASVS traceability matrix and test evidence before claiming coverage. Regulatory applicability (GLBA, FTC Safeguards, RESPA, FCRA, HIPAA, attorney confidentiality, state laws, court rules) requires counsel and partner review; not all regimes automatically apply.

## RES-001: Bootstrap monorepo and CI

**Epic:** Foundation | **Priority:** P0 | **Points:** 3

**User story:** As a Resurgo user or operator, I want bootstrap monorepo and ci so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Next.js, packages, lint, tests and reproducible build

**Security & compliance acceptance criteria**
- Pinned dependencies, secret/SCA/SAST scans, no committed credentials

## RES-002: Local self-hosted environment

**Epic:** Foundation | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want local self-hosted environment so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Postgres, object storage and mock email start with Compose

**Security & compliance acceptance criteria**
- Local-only endpoints, secrets externalized, least-privilege service identities

## RES-003: Domain schema and migrations

**Epic:** Foundation | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want domain schema and migrations so I can complete this workflow safely and efficiently.
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
No file chosen
Attach files by dragging & dropping, selecting or pasting them.
Copied! 
