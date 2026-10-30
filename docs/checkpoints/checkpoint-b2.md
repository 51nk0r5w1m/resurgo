# Checkpoint B2 — RES-006 authentication

**Date:** 2026-10-30  
**Branch:** `feat/initial-foundation`

## Functional acceptance

- Better Auth 1.7.14 provides registration, verification, password sign-in,
  recovery, logout, session lookup, and TOTP/backup-code MFA.
- Local Mailpit captures synthetic email at `http://127.0.0.1:8025` without an
  external provider.
- Protected dashboard and security settings validate the session on the server.
- Individual onboarding neither requires nor notifies a spouse.
- Professional identity and verification are explicitly distinct; organization
  affiliation is not authorization.

## Security acceptance

- Database-backed limits apply stricter thresholds to all credential, recovery,
  verification, and MFA endpoints.
- Trusted-origin and CSRF protections are enabled and a cross-origin test fails.
- Session cookie caching is disabled so revocation is immediate at the next
  server-side lookup.
- Recovery expires after 30 minutes, is single-use, and revokes prior sessions.
- Production session cookies are host-only, secure, HTTP-only, and SameSite Lax.
- Authentication audit records contain action, outcome, correlation, and actor ID
  where known, but never credentials, email addresses, tokens, or raw requests.
- TOTP setup requires password reauthentication. Professional MFA enforcement is
  an RES-010 authorization activation rule, not an organization-membership rule.

## Open security gates

- Select a self-hostable breached-password dataset or accept the documented risk;
  `v5.0.0-6.2.12` is not implemented or verified.
- Production mail delivery and domain authentication are external deployment
  decisions; Mailpit is development-only.
