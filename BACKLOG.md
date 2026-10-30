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

**Functional acceptance criteria**
- Cases, organizations, memberships and service needs persist with constraints

**Security & compliance acceptance criteria**
- Tenant keys, FK integrity, case-scoped queries and isolation tests

## RES-004: Threat model and security baseline

**Epic:** Foundation | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want threat model and security baseline so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- DFDs, trust boundaries and ASVS 5.0.0 L2 control matrix reviewed

**Security & compliance acceptance criteria**
- Explicit BOLA, SSRF, PDF attacks, privileged data and insider misuse cases

## RES-005: Resurgo shell and design system

**Epic:** Brand | **Priority:** P1 | **Points:** 3

**User story:** As a Resurgo user or operator, I want resurgo shell and design system so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Responsive Horizon/Renewal design, About, navigation, accessibility

**Security & compliance acceptance criteria**
- No private data in telemetry, CSP-compatible components

## RES-006: Better Auth registration and sessions

**Epic:** Identity | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want better auth registration and sessions so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Verify email, sign in, sign out and recover account

**Security & compliance acceptance criteria**
- Enumeration resistance, CSRF, secure cookies, rate limits, revocation

## RES-007: MFA and passkeys

**Epic:** Identity | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want mfa and passkeys so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Passkeys and recovery work; professional MFA enforced

**Security & compliance acceptance criteria**
- No MFA bypass on recovery/passwordless, step-up for sensitive actions

## RES-008: Session and device management

**Epic:** Identity | **Priority:** P0 | **Points:** 3

**User story:** As a Resurgo user or operator, I want session and device management so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- List and revoke active sessions

**Security & compliance acceptance criteria**
- Server-enforced expiry, rotation and revoke-all

## RES-009: Professional organizations and invitations

**Epic:** Identity | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want professional organizations and invitations so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Scoped case invites expire and can be withdrawn

**Security & compliance acceptance criteria**
- One-time hashed tokens, recipient verification, no org-wide case access

## RES-010: Central case policy engine

**Epic:** Authorization | **Priority:** P0 | **Points:** 8

**User story:** As a Resurgo user or operator, I want central case policy engine so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Actions evaluated by case, membership, classification, purpose and grant

**Security & compliance acceptance criteria**
- Deny-by-default, negative BOLA/IDOR tests, server-side enforcement

## RES-011: Consent and scoped disclosure

**Epic:** Authorization | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want consent and scoped disclosure so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Recipient, purpose, expiry and revocation visible to client

**Security & compliance acceptance criteria**
- Immutable authorization history, legal constraints override client consent

## RES-012: Separate legal and financial domains

**Epic:** Authorization | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want separate legal and financial domains so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Typed handoff contracts carry approved status only

**Security & compliance acceptance criteria**
- No legal privilege, credit or clinical payload in cross-domain events

## RES-013: Create case and select jurisdiction

**Epic:** Discovery | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want create case and select jurisdiction so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Start case, stage, household and jurisdiction fields

**Security & compliance acceptance criteria**
- Data minimization, validated inputs, case ownership checks

## RES-014: Branching resumable intake

**Epic:** Discovery | **Priority:** P0 | **Points:** 8

**User story:** As a Resurgo user or operator, I want branching resumable intake so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Conditional questions, autosave, resume and progress

**Security & compliance acceptance criteria**
- No answers in URLs/logs; versioned schemas and cross-case tests

## RES-015: Deterministic recommendations

**Epic:** Discovery | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want deterministic recommendations so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Versioned rules suggest specialists and explain triggers

**Security & compliance acceptance criteria**
- No AI legal eligibility decisions, jurisdiction guardrails and test fixtures

## RES-016: Personalized case roadmap

**Epic:** Discovery | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want personalized case roadmap so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Milestones, owners, dependencies and next steps appear

**Security & compliance acceptance criteria**
- Role-filtered tasks and sensitive status redaction

## RES-017: Suffolk Assembly Line proof of concept

**Epic:** Discovery | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want suffolk assembly line proof of concept so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- One reviewed jurisdiction form assembles and exports

**Security & compliance acceptance criteria**
- Isolated service, authenticated interface, reviewed legal content

## RES-018: Document/version data model

**Epic:** Documents | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want document/version data model so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Immutable version metadata, hashes, classification and status

**Security & compliance acceptance criteria**
- No mutable object keys, cross-case FK enforcement

## RES-019: Secure upload and quarantine

**Epic:** Documents | **Priority:** P0 | **Points:** 8

**User story:** As a Resurgo user or operator, I want secure upload and quarantine so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Upload progress, limits, retries and quarantine status

**Security & compliance acceptance criteria**
- Short-lived upload grants, MIME validation, private bucket and size caps

## RES-020: Scan and process uploaded documents

**Epic:** Documents | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want scan and process uploaded documents so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- ClamAV scan, safe preview generation, rejection reasons

**Security & compliance acceptance criteria**
- Fail closed, sandbox workers, bomb/polyglot tests

## RES-021: Authorized document retrieval

**Epic:** Documents | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want authorized document retrieval so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Viewer and download work for authorized members

**Security & compliance acceptance criteria**
- Fresh policy decision, short-lived grants, audit reads, no public ACL

## RES-022: PDF.js viewer

**Epic:** Documents | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want pdf.js viewer so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Search, zoom, page navigation and accessible keyboard controls

**Security & compliance acceptance criteria**
- Safe CSP, no embedded script execution, no third-party telemetry

## RES-023: Document requests

**Epic:** Documents | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want document requests so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Professional requests file with owner, due date and reminder

**Security & compliance acceptance criteria**
- Requester case permission; notifications contain no confidential detail

## RES-024: Immutable version history

**Epic:** Documents | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want immutable version history so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- New version preserves earlier versions and hashes

**Security & compliance acceptance criteria**
- No overwrite, authorize every historical read, integrity tests

## RES-025: PDF annotations and review threads

**Epic:** Documents | **Priority:** P1 | **Points:** 8

**User story:** As a Resurgo user or operator, I want pdf annotations and review threads so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Highlights, comments, replies and resolved state per version

**Security & compliance acceptance criteria**
- Sanitized comments, version binding and scoped permissions

## RES-026: Approval workflow

**Epic:** Documents | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want approval workflow so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Review outcomes tied to exact document version

**Security & compliance acceptance criteria**
- Audit decisions, step-up approval, no false e-signature claim

## RES-027: Granular sharing controls

**Epic:** Documents | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want granular sharing controls so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Named grants for view/download/comment/edit and expiry

**Security & compliance acceptance criteria**
- Deny default, immediate revocation, privileged classification safeguards

## RES-028: Retention and legal holds

**Epic:** Documents | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want retention and legal holds so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Retention schedules, export and hold-aware deletion

**Security & compliance acceptance criteria**
- Deletion blocked on hold, audit trail and secure disposal verification

## RES-029: Evaluate self-hosted scheduler

**Epic:** Scheduling | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want evaluate self-hosted scheduler so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- OpenCalendar/Cal.diy/native POC with collective availability

**Security & compliance acceptance criteria**
- License, maintainer, OAuth and tenant isolation review

## RES-030: Professional directory

**Epic:** Scheduling | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want professional directory so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Service specialties, jurisdiction, affiliation and availability

**Security & compliance acceptance criteria**
- Verify credentials before representing as verified

## RES-031: Google and Microsoft calendar sync

**Epic:** Scheduling | **Priority:** P1 | **Points:** 8

**User story:** As a Resurgo user or operator, I want google and microsoft calendar sync so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- OAuth connect, free/busy lookup and disconnect

**Security & compliance acceptance criteria**
- Least-scope OAuth, encrypted tokens, revoke and no event-body ingestion

## RES-032: Intake-driven booking

**Epic:** Scheduling | **Priority:** P1 | **Points:** 8

**User story:** As a Resurgo user or operator, I want intake-driven booking so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Separate or collective appointments based on recommended roles

**Security & compliance acceptance criteria**
- Explicit attendee consent, therapist separate by default, minimum details

## RES-033: Invitations and rescheduling

**Epic:** Scheduling | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want invitations and rescheduling so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Invite, confirm, cancel, reschedule and remind

**Security & compliance acceptance criteria**
- Signed webhooks, replay prevention, safe invitation links

## RES-034: Self-host Temporal dev environment

**Epic:** Workflow | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want self-host temporal dev environment so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Temporal server, workers and sample durable workflow run

**Security & compliance acceptance criteria**
- Restricted UI, service auth, minimal workflow histories

## RES-035: Case workflow orchestration

**Epic:** Workflow | **Priority:** P1 | **Points:** 8

**User story:** As a Resurgo user or operator, I want case workflow orchestration so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Request-review-approval signals, retries, timers and idempotency

**Security & compliance acceptance criteria**
- Authenticated signals, no document bytes in history, least-privilege workers

## RES-036: Lender-attorney structured handoff

**Epic:** Workflow | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want lender-attorney structured handoff so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Mortgage status and required docs pass through approved handoff

**Security & compliance acceptance criteria**
- Schema allowlists, purpose-bound grants, no implicit cross-domain access

## RES-037: Case timeline and notifications

**Epic:** Workflow | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want case timeline and notifications so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Milestone history, assignments, reminders and unread indicators

**Security & compliance acceptance criteria**
- Per-recipient redaction, no sensitive email attachments

## RES-038: Regulatory applicability matrix

**Epic:** Compliance | **Priority:** P0 | **Points:** 8

**User story:** As a Resurgo user or operator, I want regulatory applicability matrix so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Counsel reviews GLBA, Safeguards, RESPA, FCRA, HIPAA, state laws and bar rules

**Security & compliance acceptance criteria**
- Document obligations by actual role, partner contracts and data categories

## RES-039: Data governance and contracts

**Epic:** Compliance | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want data governance and contracts so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Data inventory, subprocessors, DPA templates and retention ownership

**Security & compliance acceptance criteria**
- Contractual security and breach notice duties assessed

## RES-040: Immutable audit events

**Epic:** Compliance | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want immutable audit events so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Record login, grants, reads, denial, upload, review and admin actions

**Security & compliance acceptance criteria**
- Tamper evidence, restricted query access, no secrets or raw PII

## RES-041: Encryption and key lifecycle

**Epic:** Compliance | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want encryption and key lifecycle so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- TLS, at-rest encryption, key rotation and secrets management

**Security & compliance acceptance criteria**
- No plaintext secrets, separated environments and rotation tests

## RES-042: Incident response and breach plan

**Epic:** Compliance | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want incident response and breach plan so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Runbook, escalation, tabletop and contact matrix

**Security & compliance acceptance criteria**
- Counsel-reviewed notification obligations, evidence preservation

## RES-043: Privacy rights and retention process

**Epic:** Compliance | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want privacy rights and retention process so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Notices, data requests, deletion review and export

**Security & compliance acceptance criteria**
- Requester verification, lawful holds and disclosure history

## RES-044: Security release gates

**Epic:** Compliance | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want security release gates so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- ASVS evidence, DAST/SAST/SCA and exception approval

**Security & compliance acceptance criteria**
- No unresolved critical pilot vulnerabilities; documented risk acceptance

## RES-045: Cross-tenant abuse test suite

**Epic:** Compliance | **Priority:** P0 | **Points:** 8

**User story:** As a Resurgo user or operator, I want cross-tenant abuse test suite so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Automated attacker cases cover all resource types

**Security & compliance acceptance criteria**
- BOLA, IDOR, upload abuse, SSRF, injection, token replay, auth bypass

## RES-046: Synthetic mortgage scenarios

**Epic:** Pilot | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want synthetic mortgage scenarios so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Refinance, sell and undecided cases have realistic fixtures

**Security & compliance acceptance criteria**
- No real borrower data or reused real documents

## RES-047: Lender workspace

**Epic:** Pilot | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want lender workspace so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Assigned requests, statuses and permitted files visible

**Security & compliance acceptance criteria**
- No privileged legal or unrelated borrower information

## RES-048: Attorney workspace

**Epic:** Pilot | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want attorney workspace so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Legal tasks, settlement dependencies and review queue visible

**Security & compliance acceptance criteria**
- Matter scope and privilege controls enforced

## RES-049: Pilot KPI dashboard

**Epic:** Pilot | **Priority:** P1 | **Points:** 5

**User story:** As a Resurgo user or operator, I want pilot kpi dashboard so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Measure turnaround, follow-ups, overdue tasks and time saved

**Security & compliance acceptance criteria**
- Aggregated metrics, retention controls and no content capture

## RES-050: Pilot readiness gate

**Epic:** Pilot | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want pilot readiness gate so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Signed scope, restore drill, accessibility and operations signoff

**Security & compliance acceptance criteria**
- Partner compliance and counsel approval, incident tabletop, external assessment

## RES-051: Tyler and EFileProxyServer feasibility

**Epic:** Integrations | **Priority:** P2 | **Points:** 5

**User story:** As a Resurgo user or operator, I want tyler and efileproxyserver feasibility so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Document court-specific access, adapters and filing prerequisites

**Security & compliance acceptance criteria**
- No live court integration without permission or certification

## RES-052: Manual court milestone tracking

**Epic:** Integrations | **Priority:** P2 | **Points:** 5

**User story:** As a Resurgo user or operator, I want manual court milestone tracking so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Legal professional attaches stamped documents and updates status

**Security & compliance acceptance criteria**
- Provenance, role restrictions and no false automated filing claim

## RES-053: Select optional professional services

**Epic:** Marketplace | **Priority:** P2 | **Points:** 5

**User story:** As a Resurgo user or operator, I want select optional professional services so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Client selects relevant specialties and receives neutral options

**Security & compliance acceptance criteria**
- RESPA, advertising and referral fee review

## RES-054: Encrypted backups and restore test

**Epic:** Operations | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want encrypted backups and restore test so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Recovery drill meets documented pilot RPO/RTO

**Security & compliance acceptance criteria**
- Restricted backup access and restore audit

## RES-055: Observability and security alerting

**Epic:** Operations | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want observability and security alerting so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Metrics, redacted traces, health and suspicious activity alerts

**Security & compliance acceptance criteria**
- No document contents in logs, restricted dashboards

## RES-056: WCAG 2.2 AA baseline

**Epic:** Accessibility | **Priority:** P0 | **Points:** 5

**User story:** As a Resurgo user or operator, I want wcag 2.2 aa baseline so I can complete this workflow safely and efficiently.

**Functional acceptance criteria**
- Keyboard, screen reader, focus, contrast and errors tested

**Security & compliance acceptance criteria**
- Accessible MFA and private error messaging

