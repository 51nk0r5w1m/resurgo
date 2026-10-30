# Initial repository audit

**Checkpoint date:** 2026-10-29
**Branch:** `feat/initial-foundation`
**Scope:** Reconnaissance only; no application implementation has started.

## Evidence reviewed

- `AGENTS.md`, `README.md`, `BACKLOG.md`, `issues.csv`, and
  `docs/product-brief.md`
- `docs/brand/resurgo-wireframes.png`
- Git history, tracked files, branches, and remotes
- GitHub issues #1, #2, and #3 and the pull-request list (no pull requests)

The repository contains planning and brand assets only. The feature branch and
`main` currently point at the same commit.

## Reconciliation findings

1. `BACKLOG.md` says that no GitHub issues exist, but GitHub has three open
   planning issues. None is mapped to a RES identifier. The CSV is therefore the
   only structured ticket source, while the GitHub issues act as milestone-level
   context.
2. The wireframes show court connectivity, generated court forms, a professional
   marketplace, messaging, and scheduling. These are explicitly later than v0.1
   in the written product scope and must not appear as functional controls in the
   first release.
3. `RES-003` requires organizations in the initial schema, while the product brief
   lists professional organizations as later work. The initial model should keep
   cases user-owned and reserve organization principals for later migrations;
   empty organization UI or implied organization access is out of scope.
4. `RES-006` requires verified email, recovery, enumeration resistance, rate
   limiting, and session revocation, while the milestone wording only mentions
   registration, sign-in, and sign-out. The stronger ticket criteria govern; a
   login-only implementation would not complete `RES-006`.
5. `RES-007` and `RES-008` are P0, but MFA/passkeys and full device management are
   not part of the v0.1 definition of done. They remain pilot blockers, not
   prerequisites for demonstrating the first local vertical slice, unless the
   release boundary is changed.
6. The backlog originally sequences document work alongside the authorization
   model. The decision for this checkpoint is stricter: `RES-010`, `RES-011`,
   `RES-012`, and the audit foundation from `RES-040` precede document upload and
   retrieval.
7. The proposed `services/docassemble` directory in GitHub issue #3 conflicts
   with the explicit later-increment boundary. No Docassemble service should be
   scaffolded in v0.1.
8. Temporal is named in the target stack but is not required for v0.1. A database
   job/outbox boundary can support the isolated scan worker now without making
   Temporal a runtime prerequisite.
9. "Encrypted document storage" is a requirement, but no key owner, encryption
   mode, rotation approach, or local object-store product is selected. This is a
   blocking architecture decision for document implementation, not a control that
   can be inferred from a private bucket.
10. "Safe preview" is underspecified. ClamAV detects known malware but does not
    sanitize arbitrary PDF behavior. Parser validation, isolation, preview policy,
    PDF.js hardening, and rejection behavior require explicit acceptance tests.

## Missing prerequisites and decisions

- Node.js and pnpm versions, a committed lockfile policy, and exact dependency
  versions/licenses
- Rule-content approval governance (the B1 pilot jurisdiction set is now limited
  to Fulton and DeKalb Superior Courts)
- Better Auth email transport, trusted-origin configuration, password/session
  policy, recovery behavior, and production rate-limit store
- Canonical policy actions, principal types, classifications, purposes, and the
  relationship between consent, a grant, and a professional's legal authority
- Data-classification, retention, deletion, legal-hold, backup, and restore rules
- Audit-event integrity design and access policy
- Object-store selection, encryption/key lifecycle, bucket policy, and presigned
  URL policy
- PDF limits, structural validator, scanner isolation boundary, timeouts, retry
  limits, fail-closed behavior, and preview transformation decision
- Production deployment topology, TLS termination, trusted proxy rules, and
  outbound network allowlists
- Synthetic PDF fixtures for clean, EICAR, malformed, oversized, polyglot, and
  decompression/resource-exhaustion cases
- Regulatory applicability and counsel review; no regulatory compliance claim is
  supported by the repository today

## Checkpoint conclusion

The product direction is coherent, but implementation should not begin with a
document portal. Establish the repository/security baseline, local dependencies,
identity, centralized case policy, scoped disclosure model, domain separation,
and audit semantics first. The dependency-ordered plan is in
`docs/plans/v0.1-implementation-plan.md`.
