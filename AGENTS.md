# Resurgo Agent Instructions

Resurgo is a secure, self-hostable divorce transition coordination platform.
Tagline: Navigate today. Build tomorrow.

## Product intent
A client completes a guided discovery interview, receives a jurisdiction-aware roadmap, uploads documents, and selectively coordinates with attorneys, lenders, accountants, and other professionals. The system coordinates work without merging regulated information domains.

## First milestone: v0.1 Discovery to Documents
Implement a working vertical slice:
1. Account registration, sign-in, sign-out, and protected routes using Better Auth.
2. Create and view a case with owner membership.
3. Branching, resumable intake with synthetic seed data, versioned answers, and jurisdiction field.
4. Deterministic recommendation rules that produce a roadmap with explanations; never present recommendations as legal advice.
5. Private PDF upload to quarantine, validation/scanning pipeline, authorized preview using PDF.js, and immutable document versions.
6. Basic case-scoped authorization and audit events.
7. Tests covering cross-case access denial and upload authorization.

## Stack
Next.js + TypeScript + Tailwind + shadcn/ui; PostgreSQL + Drizzle; Better Auth; PDF.js; pdf-lib where necessary; private S3-compatible object storage; ClamAV for malware scanning. Use Docker Compose for local development. Prefer maintained, genuinely open-source dependencies. Record exact license and version in docs/dependencies.md. Temporal, Docassemble/Assembly Line, scheduling, and court integrations are future adapters, not required to run v0.1.

## Security invariants
- Deny by default. Authenticate and authorize on the server for every object and action.
- Case membership does not grant access to every document. Document grants must be explicit and scoped.
- Keep privileged legal, lending/financial, and health-related information separated.
- No real client information in fixtures, logs, screenshots, or tests.
- Private object storage only; no public buckets or long-lived public URLs.
- Upload to quarantine; validate size, MIME and signature, scan before release, and process untrusted files in isolated workers.
- Document versions are immutable with content hashes; audit uploads, views, grants, revocations, and downloads.
- Do not imply that client consent alone overrides professional confidentiality or legal restrictions.
- Do not implement production e-filing, banking integrations, or regulated advice in this milestone.

## Engineering expectations
- Before writing code, inspect the repository and write a short implementation plan.
- Deliver migrations, tests, local run instructions, and an architecture decision record for major choices.
- Keep domain logic independent from web routes and external providers.
- Use accessible forms, autosave with clear state, and responsive design.
- No mock UI controls that imply functionality they do not perform.
- Treat authorization and data separation tests as release blockers.

## Brand
Name: Resurgo. Tagline: Navigate today. Build tomorrow. Visual direction: minimalist horizon motif, deep forest green, sage, warm ivory, restrained editorial typography. Professional and practical, not sentimental.

## Definition of done
A developer can run the app locally, register a test user, create a case, complete an interview, see an explainable roadmap, upload a harmless test PDF, preview it, and verify that a second unrelated user cannot access the case or PDF. Tests and lint pass.
