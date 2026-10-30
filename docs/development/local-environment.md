# Local development environment

**Status:** Implemented through Checkpoint B1 (RES-001/RES-002/RES-003).

## Runtime topology

| Component                  | Local exposure                             | Identity and data boundary                                                                    |
| -------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Next.js web                | loopback application port                  | application DB role; session secret; quarantine write/released read through storage adapter   |
| PostgreSQL                 | loopback only                              | one local owner role currently; runtime/migration/audit role separation is a later gate       |
| S3-compatible object store | API on loopback; admin UI opt-in           | distinct web/worker credentials; private quarantine and released buckets; no anonymous policy |
| ClamAV daemon              | deferred to document-processing checkpoint | will accept streams from the worker only; no host port                                        |
| Document worker            | deferred to document-processing checkpoint | will have no inbound host port or auth/session secrets                                        |
| Mail catcher               | deferred to identity checkpoint            | synthetic development messages only                                                           |

Compose images must use immutable digests plus human-readable version comments.
Named volumes are acceptable for local state; reset must be an explicit command
that names only project-owned volumes. Health checks gate migrations and tests.

## Configuration contract

- Commit `.env.example` with safe placeholders only; ignore `.env` and generated
  secrets.
- Generate development secrets on first setup rather than embedding defaults in
  Compose. Tests use isolated, non-production credentials.
- Validate configuration at process start and refuse known placeholder/empty
  secrets outside the test environment.
- Keep object-store and database administrative credentials out of the web and
  worker processes.
- Use synthetic identities and generated harmless PDF fixtures only.

## Implemented selections

1. Garage 2.5.0 (AGPL-3.0) is the local S3-compatible service. The image is pinned
   by version and multi-architecture digest in Compose.
2. PostgreSQL 18.6 is pinned by version, Alpine version, and image digest.
3. `pnpm env:init` creates random, ignored local credentials with restrictive
   file permissions. Compose exposes only PostgreSQL and S3 APIs on loopback.

## Remaining selection gates

1. Select and license-review a PDF structural validator/preview transformation
   tool in addition to ClamAV and PDF.js.
2. Pin ClamAV and the mail catcher when their owning tickets begin.
3. Decide whether local at-rest encryption is supplied by the object store,
   application envelope encryption, or both. Document how production keys differ.

## Reproducibility acceptance

On a clean machine with only the documented Node/pnpm and Docker-compatible
runtime, one command starts dependencies, one applies all migrations, and the
standard quality-gate commands run without manually creating buckets, roles, or
mail configuration. CI performs the same clean initialization rather than using a
pre-seeded developer database.
