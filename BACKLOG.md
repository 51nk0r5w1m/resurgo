# Resurgo Engineering Backlog

Navigate today. Build tomorrow.

## Global Definition of Done

- Functional acceptance criteria satisfied and tested.
- Separate security and compliance acceptance criteria verified.
- Code reviewed; CI checks pass.
- Negative authorization tests for case-scoped resources.
- No real client data in development or test fixtures.
- Architecture and security decisions documented.
- OWASP ASVS 5.0.0 Level 2 is the proposed baseline.
- Consider OWASP Top 10:2025, API Security Top 10:2023, and WCAG 2.2 AA.
- Regulatory applicability requires legal and partner review.
- Do not claim compliance or verified controls without evidence.

Priority:
P0 = Secure external pilot
P1 = Complete MVP
P2 = Later integrations/enhancements

Points use Fibonacci estimates.

---

# EPIC: Foundation

## RES-001: Bootstrap monorepo and CI
Priority: P0 | Points: 3
Story: Establish the application repository and CI.
Functional AC:
- Next.js workspace, shared packages, lint, tests, reproducible build.
Security & Compliance AC:
- Pin dependencies; enable secret, SCA and SAST scanning.
- No committed credentials.

## RES-002: Local self-hosted environment
Priority: P0 | Points: 5
Story: Run the development environment locally.
Functional AC:
- PostgreSQL, object storage and mock email start via Compose.
Security & Compliance AC:
- Local-only endpoints, externalized secrets, least-privilege identities.

## RES-003: Domain schema and migrations
Priority: P0 | Points: 5
Story: Persist cases, organizations and memberships.
Functional AC:
- Case, organization, membership and service-need schemas.
- Validated database migrations.
Security & Compliance AC:
- Tenant keys, foreign-key integrity, isolation tests.

## RES-004: Threat model and security baseline
Priority: P0 | Points: 5
Story: Establish security requirements before implementation.
Functional AC:
- Data flow diagrams, trust boundaries, ASVS 5.0.0 L2 matrix.
Security & Compliance AC:
- Cover BOLA, SSRF, malicious PDFs, privileged data, insider misuse.

# EPIC: Brand

## RES-005: Resurgo shell and design system
Priority: P1 | Points: 3
Story: Deliver the Resurgo application experience.
Functional AC:
- Responsive Horizon/Renewal identity, About, navigation, accessibility.
Security & Compliance AC:
- No private data in telemetry; CSP-compatible components.

# EPIC: Identity

## RES-006: Better Auth registration and sessions
Priority: P0 | Points: 5
Story: Register and authenticate users.
Functional AC:
- Email verification, login, logout, recovery.
Security & Compliance AC:
- Enumeration resistance, CSRF protection, secure cookies, rate limits, revocation.

## RES-007: MFA and passkeys
Priority: P0 | Points: 5
Story: Provide secure authentication options.
Functional AC:
- Passkeys, recovery, mandatory professional MFA.
Security & Compliance AC:
- No recovery or passwordless MFA bypass.
- Step-up authentication for sensitive operations.

## RES-008: Session and device management
Priority: P0 | Points: 3
Story: Manage active sessions.
Functional AC:
- List and revoke sessions.
Security & Compliance AC:
- Server-side expiration, rotation and revoke-all.

## RES-009: Professional organizations and invitations
Priority: P0 | Points: 5
Story: Invite professionals into authorized cases.
Functional AC:
- Scoped, expiring, revocable invitations.
Security & Compliance AC:
- One-time hashed tokens and recipient verification.
- No implicit organization-wide case access.

# EPIC: Authorization

## RES-010: Central case policy engine
Priority: P0 | Points: 8
Story: Enforce resource-specific authorization.
Functional AC:
- Evaluate case, membership, classification, purpose and grants.
Security & Compliance AC:
- Deny by default.
- Server-side enforcement and negative BOLA/IDOR tests.

## RES-011: Consent and scoped disclosure
Priority: P0 | Points: 5
Story: Control professional information sharing.
Functional AC:
- Recipient, purpose, expiry and revocation visible to clients.
Security & Compliance AC:
- Immutable authorization history.
- Professional and legal restrictions override insufficient consent.

## RES-012: Separate legal and financial domains
Priority: P0 | Points: 5
Story: Coordinate professionals without unrestricted data sharing.
Functional AC:
- Typed, approved status handoff contracts.
Security & Compliance AC:
- No privileged legal, credit or clinical payload in cross-domain events.

# EPIC: Discovery

## RES-013: Create case and select jurisdiction
Priority: P0 | Points: 5
Story: Create a divorce transition case.
Functional AC:
- Capture case stage, household and jurisdiction.
Security & Compliance AC:
- Input validation, minimization, ownership checks.

## RES-014: Branching resumable intake
Priority: P0 | Points: 8
Story: Complete and resume conditional discovery.
Functional AC:
- Branching questions, autosave, progress and resume.
Security & Compliance AC:
- No answers in URLs or logs.
- Versioned schemas and cross-case access tests.

## RES-015: Deterministic recommendations
Priority: P0 | Points: 5
Story: Recommend appropriate professional services.
Functional AC:
- Versioned rules explain specialist recommendations.
Security & Compliance AC:
- No AI legal eligibility decisions.
- Jurisdiction guardrails and test fixtures.

## RES-016: Personalized case roadmap
Priority: P0 | Points: 5
Story: Display next steps and dependencies.
Functional AC:
- Milestones, owners, dependencies and tasks.
Security & Compliance AC:
- Role-filtered tasks and sensitive status redaction.

## RES-017: Suffolk Assembly Line proof of concept
Priority: P1 | Points: 5
Story: Generate jurisdiction-specific legal documents.
Functional AC:
- One reviewed form assembles and exports.
Security & Compliance AC:
- Isolated service, authenticated interface, reviewed legal content.

# EPIC: Documents

## RES-018: Document/version data model
Priority: P0 | Points: 5
Story: Store document metadata and immutable versions.
Functional AC:
- Hashes, classification, status and version metadata.
Security & Compliance AC:
- Immutable object keys and cross-case foreign-key enforcement.

## RES-019: Secure upload and quarantine
Priority: P0 | Points: 8
Story: Upload documents securely.
Functional AC:
- Progress, limits, retries, quarantine status.
Security & Compliance AC:
- Short-lived upload grants, MIME validation, private storage, size limits.

## RES-020: Scan and process uploaded documents
Priority: P0 | Points: 5
Story: Validate and prepare uploaded documents.
Functional AC:
- ClamAV scanning, preview generation, rejection reasons.
Security & Compliance AC:
- Fail closed, sandbox processing, PDF bomb and polyglot tests.

## RES-021: Authorized document retrieval
Priority: P0 | Points: 5
Story: Access documents through the secure portal.
Functional AC:
- Authorized preview and download.
Security & Compliance AC:
- Fresh policy decisions, short-lived grants, audit reads, no public ACLs.

## RES-022: PDF.js viewer
Priority: P0 | Points: 5
Story: Preview PDFs inside Resurgo.
Functional AC:
- Search, zoom, navigation, keyboard accessibility.
Security & Compliance AC:
- Safe CSP, no embedded script execution, no third-party telemetry.

## RES-023: Document requests
Priority: P0 | Points: 5
Story: Request documents from case participants.
Functional AC:
- Assigned owner, due date, instructions and reminders.
Security & Compliance AC:
- Requester authorization; no confidential details in notifications.

## RES-024: Immutable version history
Priority: P0 | Points: 5
Story: Preserve document revision history.
Functional AC:
- Every version retains previous content and hashes.
Security & Compliance AC:
- No overwrite, historical access authorization, integrity tests.

## RES-025: PDF annotations and review threads
Priority: P1 | Points: 8
Story: Collaboratively review documents.
Functional AC:
- Highlights, comments, replies and resolved states per version.
Security & Compliance AC:
- Sanitized comments, version binding, scoped permissions.

## RES-026: Approval workflow
Priority: P1 | Points: 5
Story: Approve reviewed documents.
Functional AC:
- Review outcomes tied to exact versions.
Security & Compliance AC:
- Audit decisions, step-up approval, no false e-signature claims.

## RES-027: Granular sharing controls
Priority: P0 | Points: 5
Story: Share documents with named professionals.
Functional AC:
- View, download, comment, edit and expiration grants.
Security & Compliance AC:
- Deny default, immediate revocation, privileged-document safeguards.

## RES-028: Retention and legal holds
Priority: P1 | Points: 5
Story: Retain and dispose of documents appropriately.
Functional AC:
- Retention schedules, exports, hold-aware deletion.
Security & Compliance AC:
- Prevent deletion during holds; audit and verify disposal.

# EPIC: Scheduling

## RES-029: Evaluate self-hosted scheduler
Priority: P1 | Points: 5
Story: Select an OSS scheduling solution.
Functional AC:
- Compare OpenCalendar, Cal.diy and native implementation.
- Test collective availability.
Security & Compliance AC:
- Review licensing, maintenance, OAuth and tenant isolation.

## RES-030: Professional directory
Priority: P1 | Points: 5
Story: Discover relevant professionals.
Functional AC:
- Specialties, jurisdiction, affiliation and availability.
Security & Compliance AC:
- Verify credentials before displaying verified status.

## RES-031: Google and Microsoft calendar sync
Priority: P1 | Points: 8
Story: Connect professional calendars.
Functional AC:
- OAuth connection, free/busy lookup, disconnect.
Security & Compliance AC:
- Least-privilege scopes, encrypted tokens, revocation.
- Do not ingest unrelated event descriptions.

## RES-032: Intake-driven booking
Priority: P1 | Points: 8
Story: Schedule recommended professionals.
Functional AC:
- Individual or collective booking based on discovered needs.
Security & Compliance AC:
- Explicit attendee consent, minimum disclosure.
- Therapists scheduled separately by default.

## RES-033: Invitations and rescheduling
Priority: P1 | Points: 5
Story: Coordinate appointments.
Functional AC:
- Invite, confirm, cancel, reschedule, remind.
Security & Compliance AC:
- Signed webhooks, replay protection, safe invitation links.

# EPIC: Workflow

## RES-034: Self-host Temporal development environment
Priority: P1 | Points: 5
Story: Establish durable workflow infrastructure.
Functional AC:
- Temporal server, workers and sample workflow.
Security & Compliance AC:
- Restricted UI, service authentication, minimal workflow histories.

## RES-035: Case workflow orchestration
Priority: P1 | Points: 8
Story: Coordinate long-running case processes.
Functional AC:
- Signals, retries, timers and idempotency.
Security & Compliance AC:
- Authenticated signals, least-privilege workers.
- No document bytes in workflow histories.

## RES-036: Lender-attorney structured handoff
Priority: P1 | Points: 5
Story: Exchange approved mortgage milestones.
Functional AC:
- Status and required-document handoffs.
Security & Compliance AC:
- Schema allowlists, purpose-bound grants.
- No implicit cross-domain access.

## RES-037: Case timeline and notifications
Priority: P1 | Points: 5
Story: Track case activity.
Functional AC:
- Milestones, assignments, reminders and unread status.
Security & Compliance AC:
- Recipient-specific redaction, no sensitive email attachments.

# EPIC: Compliance

## RES-038: Regulatory applicability matrix
Priority: P0 | Points: 8
Story: Determine actual regulatory obligations.
Functional AC:
- Counsel reviews GLBA, FTC Safeguards, RESPA, FCRA, HIPAA, state laws and bar rules.
Security & Compliance AC:
- Map obligations to actual roles, contracts and data categories.

## RES-039: Data governance and contracts
Priority: P0 | Points: 5
Story: Establish data governance.
Functional AC:
- Data inventory, subprocessors, DPA templates and retention ownership.
Security & Compliance AC:
- Review contractual security and breach-notification duties.

## RES-040: Immutable audit events
Priority: P0 | Points: 5
Story: Audit sensitive platform operations.
Functional AC:
- Record authentication, grants, reads, denials, uploads, reviews and admin actions.
Security & Compliance AC:
- Tamper evidence, restricted queries, no secrets or raw sensitive data.

## RES-041: Encryption and key lifecycle
Priority: P0 | Points: 5
Story: Protect sensitive information.
Functional AC:
- TLS, at-rest encryption, key rotation, secrets management.
Security & Compliance AC:
- No plaintext secrets, environment separation, rotation tests.

## RES-042: Incident response and breach plan
Priority: P0 | Points: 5
Story: Establish incident response procedures.
Functional AC:
- Runbooks, escalation, tabletop and contact matrix.
Security & Compliance AC:
- Counsel-reviewed notification duties and evidence preservation.

## RES-043: Privacy rights and retention process
Priority: P0 | Points: 5
Story: Support lawful data requests and retention.
Functional AC:
- Notices, requests, deletion review, export.
Security & Compliance AC:
- Requester verification, legal holds, disclosure history.

## RES-044: Security release gates
Priority: P0 | Points: 5
Story: Prevent unsafe pilot releases.
Functional AC:
- ASVS evidence, DAST/SAST/SCA, exception approval.
Security & Compliance AC:
- No unresolved critical pilot vulnerabilities.
- Documented risk acceptance.

## RES-045: Cross-tenant abuse test suite
Priority: P0 | Points: 8
Story: Verify tenant and case isolation.
Functional AC:
- Automated adversarial tests across resources.
Security & Compliance AC:
- BOLA, IDOR, SSRF, injection, token replay, upload abuse and auth bypass.

# EPIC: Pilot

## RES-046: Synthetic mortgage scenarios
Priority: P0 | Points: 5
Story: Demonstrate divorce mortgage workflows.
Functional AC:
- Refinance, sale and undecided scenarios.
Security & Compliance AC:
- No real borrower information or reused real documents.

## RES-047: Lender workspace
Priority: P1 | Points: 5
Story: Provide lender-specific case coordination.
Functional AC:
- Assigned requests, statuses and permitted documents.
Security & Compliance AC:
- No privileged legal or unrelated borrower data.

## RES-048: Attorney workspace
Priority: P1 | Points: 5
Story: Provide attorney-specific case coordination.
Functional AC:
- Legal tasks, settlement dependencies, review queue.
Security & Compliance AC:
- Matter-scoped authorization and privilege safeguards.

## RES-049: Pilot KPI dashboard
Priority: P1 | Points: 5
Story: Measure workflow improvements.
Functional AC:
- Turnaround, follow-ups, overdue tasks, time saved.
Security & Compliance AC:
- Aggregated metrics, retention controls, no content capture.

## RES-050: Pilot readiness gate
Priority: P0 | Points: 5
Story: Approve external pilot deployment.
Functional AC:
- Signed scope, restore drill, accessibility and operational signoff.
Security & Compliance AC:
- Partner/counsel approval, incident tabletop, external assessment.

# EPIC: Integrations

## RES-051: Tyler and EFileProxyServer feasibility
Priority: P2 | Points: 5
Story: Research authorized court integration.
Functional AC:
- Document court-specific adapters, access and filing prerequisites.
Security & Compliance AC:
- No live integration without required permission or certification.

## RES-052: Manual court milestone tracking
Priority: P2 | Points: 5
Story: Track court events without an API.
Functional AC:
- Authorized legal professionals attach court documents and update status.
Security & Compliance AC:
- Provenance, role restrictions, no false automated-filing claims.

# EPIC: Marketplace

## RES-053: Select optional professional services
Priority: P2 | Points: 5
Story: Select relevant professional services.
Functional AC:
- Client selects specialties and sees neutral options.
Security & Compliance AC:
- RESPA, advertising and referral compensation review.

# EPIC: Operations

## RES-054: Encrypted backups and restore test
Priority: P0 | Points: 5
Story: Recover from infrastructure failures.
Functional AC:
- Restore drill meets documented RPO/RTO.
Security & Compliance AC:
- Restricted backup access and restore audit.

## RES-055: Observability and security alerting
Priority: P0 | Points: 5
Story: Monitor operational and security events.
Functional AC:
- Metrics, redacted traces, health and suspicious-activity alerts.
Security & Compliance AC:
- No document contents in logs; restricted dashboards.

# EPIC: Accessibility

## RES-056: WCAG 2.2 AA baseline
Priority: P0 | Points: 5
Story: Ensure accessible user workflows.
Functional AC:
- Keyboard, screen-reader, focus, contrast and error testing.
Security & Compliance AC:
- Accessible MFA and privacy-preserving error messages.

---

# EPIC: Court Activity

## RES-COURT-01: Georgia court/provider capability registry
Priority: P1 | Points: 5
Dependencies: RES-003
Story: As a case manager, I need to identify supported court channels per jurisdiction.
Functional AC:
- Registry distinguishes filing, service, docket, orders and public access.
- Coverage and access requirements documented per court.
- Unsupported capabilities displayed accurately.
Security & Compliance AC:
- No unapproved court access or scraping.
- Court rules and provider agreements reviewed.
- No credentials in registry.

## RES-COURT-02: Court event schema and provenance
Priority: P1 | Points: 5
Dependencies: RES-COURT-01
Story: As an attorney, I need traceable docket events.
Functional AC:
- Record source, external ID, event time, observation time, verification and review.
- Idempotent ingestion and corrections.
- Link raw source evidence.
Security & Compliance AC:
- Source authenticity checks.
- Append-only audit history.
- Prevent cross-case disclosure through case matching.

## RES-COURT-03: Attorney-entered verified court updates
Priority: P1 | Points: 5
Dependencies: RES-
