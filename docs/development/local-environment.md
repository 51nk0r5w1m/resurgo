# Local development environment

**Status:** Implemented through Checkpoint C2 (RES-019 through RES-022).

## Runtime topology

| Component                  | Local exposure                           | Identity and data boundary                                                                    |
| -------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Next.js web                | loopback application port                | application DB role; session secret; quarantine write/released read through storage adapter   |
| PostgreSQL                 | loopback only                            | one local owner role currently; runtime/migration/audit role separation is a later gate       |
| Mailpit                    | `127.0.0.1:1025`, UI at `127.0.0.1:8025` | synthetic local verification/recovery mail only; never a production mail provider             |
| S3-compatible object store | API on loopback; admin UI opt-in         | distinct web/worker credentials; private quarantine and released buckets; no anonymous policy |
| ClamAV daemon              | `127.0.0.1:3310` for local tests         | accepts bounded streams; worker reaches it over an internal network                           |
| Document worker            | no inbound port                          | DB, object-storage, and scanner credentials only; no auth/session or SMTP secret              |

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
   Its named volume is mounted at `/var/lib/postgresql/18/docker`, matching the
   pinned PostgreSQL 18 image's configured `PGDATA`. The
   `pnpm test:postgres-persistence` regression test removes and recreates an
   isolated container and verifies the canary row survives in its named volume.
3. `pnpm env:init` creates random, ignored local credentials with restrictive
   file permissions. Files are completely written and synchronized before an
   exclusive hard-link publication; existing files are preserved and symlink
   destinations are rejected. Compose exposes only PostgreSQL and S3 APIs on
   loopback.
4. ClamAV 1.5.4 and the Node 26 document worker use read-only root filesystems,
   bounded CPU/memory/PID resources, internal networking, and dedicated writable
   temporary/signature mounts. The worker exposes no network listener.
5. PDF.js 6.4.299, pdf-lib 1.17.1, and bounded ZIP.js inspection validate source
   structure. PDF previews are rasterized into a new PDF in the isolated worker.

## Remaining selection gates

1. Decide whether local at-rest encryption is supplied by the object store,
   application envelope encryption, or both. Document how production keys differ.
2. Split runtime, migration, worker, and audit-reader database/storage identities
   before production deployment; the local stack currently shares development
   credentials.

## Reproducibility acceptance

On a clean machine with only the documented Node/pnpm and Docker-compatible
runtime, one command starts dependencies, one applies all migrations, and the
standard quality-gate commands run without manually creating buckets, roles, or
mail configuration. CI performs the same clean initialization rather than using a
pre-seeded developer database.
