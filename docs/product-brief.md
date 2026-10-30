# Resurgo Product Brief

## Positioning
Resurgo is a divorce transition operating system, not merely a form generator or professional directory. The name references rising again. The experience should be calm, credible, and efficient.

## Primary journey
1. Visitor learns what Resurgo does.
2. Client registers and starts a case.
3. Client completes conditional discovery covering jurisdiction, case stage, household, property, finances, dependents, priorities, and optional support needs.
4. Rules engine explains recommended next steps and relevant professional categories.
5. Client sees a case roadmap and uploads supporting documents.
6. In later milestones, the client authorizes scoped professional access, responds to document requests, and schedules coordinated consultations.

## v0.1 pilot market

The pilot is limited to Atlanta-area divorce clients, family-law attorneys, and
mortgage professionals coordinating divorce-related mortgage and property
transitions. Fulton County Superior Court and DeKalb County Superior Court are the
only enabled court jurisdictions. Atlanta is not treated as a single court
jurisdiction.

Centurion is a prospective commercial design partner subject to a formal pilot
agreement. It must not be represented in fixtures or configuration as a verified
provider before that agreement and onboarding review are complete. All test data
is synthetic.

Geographic expansion, nationwide court integration, and 50-state form support are
out of scope. Court guidance and mortgage recommendations must identify the need
for qualified professional review and must not be presented as authoritative
legal or eligibility determinations.

## UX surfaces
- Marketing home and About
- Authentication and case creation
- Guided intake with progress, save/resume, and plain-language explanations
- Roadmap with milestones, dependencies, and service recommendations
- Documents: private upload, list, preview, version metadata, access activity
- Future: professional marketplace, scheduling, requests, comments, court activity

## Architecture principles
- Domain boundaries: legal, financial, clinical/support, court, and shared coordination metadata.
- Separate status events from underlying confidential documents.
- Explicit purpose-limited grants; no implicit cross-domain sharing.
- Deterministic, reviewed jurisdiction rules; no LLM making binding legal decisions.
- Adapter interfaces for Docassemble, scheduling, Temporal, e-filing, and storage.
- Open-source and self-hostable where practical; verify licenses per version.

## Suggested core tables
users (managed by auth), cases, case_memberships, intake_sessions, intake_answers, rule_versions, recommendations, roadmap_items, documents, document_versions, document_grants, audit_events. Add document_requests, annotations, appointments, professional_organizations, and workflow_events in later milestones.

## Non-goals for v0.1
Real court filing, actual legal advice, lender data exchange, medical records, payments, live professional marketplace, or production e-signature.

## Quality gates
Server-side authorization, cross-tenant isolation tests, no sensitive data in logs, private storage, malware scanning before release, accessible UI, deterministic rules tests, and a reproducible local setup.
