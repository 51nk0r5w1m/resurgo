# Checkpoint B3 — RES-010 case authorization

**Date:** 2026-10-30  
**Branch:** `feat/initial-foundation`

## Functional acceptance

- Authenticated principals can create private Fulton or DeKalb Superior Court
  cases; the server derives ownership from the validated session.
- Case creation, owner membership, and the audit event commit in one database
  transaction.
- Central domain decisions support case reads, management, membership grants,
  membership revocation, and classified-resource operations.
- Membership grant and revocation APIs delegate to the same policy used by web
  reads and are reusable from future server actions and background jobs.
- Organization membership remains only an affiliation input. It never implies
  case membership or resource access.

## Security acceptance

- Missing, paused, expired, suspended, or revoked state denies access by default.
- Professional decisions revalidate the verified pilot organization, active
  organization affiliation, active case membership, and enrolled MFA on every
  operation.
- Non-owner members cannot grant or revoke membership.
- Case lists originate from the authenticated user and are rechecked through the
  current-state policy before returning data.
- Unrelated and nonexistent case reads return the same generic HTTP 404 shape.
- Denied request-level decisions append minimized audit events without request
  bodies or personal data.
- Existing resource decisions continue to require a current, scoped grant and
  current consent when the grant basis is explicit consent.

## Evidence

- Database integration tests cover cross-case and cross-organization access,
  professional lifecycle changes, consent/grant expiry and revocation,
  professional MFA, privilege escalation, and concurrent membership revocation.
- HTTP-bound integration tests create a case using a Better Auth session and
  prove an unrelated session cannot read or enumerate it.

No document upload or processing capability is introduced by this checkpoint.
