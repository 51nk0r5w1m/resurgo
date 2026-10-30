# Checkpoint B4 — first functional client journey

**Date:** 2026-10-30  
**Branch:** `feat/initial-foundation`

## Functional acceptance

- A client can register, verify the captured development email, sign in, and
  create a private case without a spouse account or invitation.
- Case creation supports only Fulton County Superior Court and DeKalb County
  Superior Court for the Atlanta pilot. The interface warns that a Georgia
  attorney must confirm venue.
- Guided discovery branches around real-property involvement, saves each answer
  as a new revision, and resumes from the latest applicable answer.
- Versioned `atlanta-pilot-v1` rules produce explainable recommendations for a
  Georgia divorce attorney, mortgage specialist, financial specialist, and
  optional personal support as applicable.
- Completion creates an ordered roadmap and clearly states that its output is
  neither legal advice nor a mortgage eligibility decision.

## Security acceptance

- Every discovery read and mutation obtains the principal from a server-validated
  session and invokes the centralized case policy with no client-supplied
  ownership or organization trust.
- Unrelated users are denied discovery state at the domain boundary; case reads
  remain enumeration-resistant at the HTTP boundary.
- Database composite foreign keys prevent recommendations and roadmap items from
  referencing a session or recommendation belonging to another case.
- Answers remain revisioned rather than overwritten. Generated output carries a
  rule version and generation number.
- Discovery audit events contain identifiers and outcomes but not answer values.
- Protected discovery responses use `Cache-Control: no-store`.

## Evidence

- Unit tests cover branching, deterministic output, explanations, and mortgage
  eligibility disclaimers.
- Database integration tests cover revision history, resume behavior, cross-case
  reference rejection, unrelated-user denial, and both property branches.
- Playwright exercises registration, Mailpit email verification, login, private
  case creation, save/reload/resume, all recommendation categories, roadmap
  display, logout, and subsequent protected-route denial.
- Migrations `0007` and `0008` add the journey schema, backfill sessions for
  pre-existing cases, and add case-consistent foreign keys without rewriting
  earlier migration history.

Document upload, professional matching, court integration, billing, Docxodus,
and OpenContracts are not introduced by this checkpoint.
