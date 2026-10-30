# Checkpoint A implementation review

**Date:** 2026-10-30
**Branch:** `feat/initial-foundation`
**Tickets:** RES-001 foundation, RES-002 local foundation, RES-003 migration
prerequisite, RES-005 application shell

## Delivered

- pnpm workspace with strict shared TypeScript configuration
- Next.js App Router landing page using the Resurgo horizon motif, forest/sage/
  ivory palette, editorial typography, responsive navigation, and reduced-motion
  handling
- shadcn-compatible shared button primitive and component aliases
- environment schema plus an idempotent local secret generator that does not print
  generated values
- digest-pinned PostgreSQL 18.6 and Garage 2.5.0 Compose services, bound only to
  loopback with private generated credentials
- Drizzle schema, generated initial migration, consistency check, and clean
  temporary-database migration validator
- security response headers and browser assertions
- unit and browser smoke tests, formatting, linting, strict type checking,
  dependency audit, and Gitleaks CI workflow
- exact direct dependency/license inventory and local startup documentation

The public page contains only functional in-page navigation. Authentication,
case, upload, professional, court, scheduling, messaging, payment, and signature
controls are absent.

## Acceptance evidence

| Gate                   | Evidence                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Reproducible install   | `pnpm install --frozen-lockfile` passed with explicit build-script allowlist                                   |
| One-command setup      | `pnpm setup:local` passed; PostgreSQL and Garage reported healthy                                              |
| Environment validation | generated configuration passed; unit test proves placeholder rejection does not echo the value                 |
| Migration application  | normal migrate passed; `pnpm db:validate` applied migrations to a temporary empty database and removed it      |
| Formatting/lint/types  | Prettier, ESLint with zero warnings, and all workspace TypeScript checks passed                                |
| Unit tests             | 2 files, 4 tests passed                                                                                        |
| Production build       | Next.js 16.4.3 production build passed; landing page is statically rendered                                    |
| Browser tests          | 2 Chromium tests passed, including headers, CTA target behavior, brand styling, and absence of future controls |
| Dependency audit       | `pnpm audit --audit-level moderate` reported no known vulnerabilities after tested esbuild override            |
| Staged secret scan     | Gitleaks 8.30.1 scanned 292.52 KB of staged content with no leaks found                                        |
| Visual check           | full landing page and hero were inspected at desktop size after correcting shared Tailwind source detection    |

## Security evidence and limits

- Generated `.env` and `.secrets/` are ignored and mode-restricted; committed
  examples contain placeholders or explicitly synthetic CI values.
- PostgreSQL and Garage publish only loopback ports. Garage administration is not
  published and its bucket is not configured for anonymous access.
- Container images and CI actions are immutable-digest/commit pinned.
- CSP blocks objects and framing; COOP, permissions policy, referrer policy,
  `nosniff`, and frame denial are asserted. The Next.js CSP still requires
  `unsafe-inline` until nonce-based rendering is designed; this is not claimed as
  an ASVS verification.
- Local Compose uses one PostgreSQL owner identity and unencrypted local volumes.
  Least-privilege runtime/migration roles and production encryption/key management
  remain gates before real information is handled.
- The Gitleaks workflow is configured, but remote CI has not run until the commit
  is pushed. Local staged-content scan evidence is recorded in the checkpoint
  handoff.
- The repository project license remains undecided and is marked `UNLICENSED`.

No authentication, authorization, document, audit-event, or regulatory control is
claimed complete in this checkpoint.
