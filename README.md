# Resurgo

**Navigate today. Build tomorrow.**

Resurgo is an open-source-first divorce transition coordination platform. Its purpose is to replace fragmented email chains with guided discovery, personalized case roadmaps, secure document exchange, and carefully scoped professional handoffs.

The v0.1 pilot is limited to divorce-related mortgage and property transition
coordination in the Atlanta, Georgia area. Fulton and DeKalb Superior Courts are
the only enabled jurisdictions. Outputs require qualified legal or mortgage
professional review and are not authoritative advice or eligibility decisions.

## Product boundaries

The platform coordinates legal, financial, housing, and personal-support workflows. It does not itself practice law, underwrite loans, or provide clinical care. Information exchange is explicit, purpose-limited, and auditable.

## MVP v0.1

Discovery to Documents: identity, case creation, guided intake, deterministic service recommendations, private PDF upload and preview, basic access controls, and audit events.

## Later milestones

- v0.2: document requests, comments, immutable version comparison, professional invitations and grants
- v0.3: coordinated scheduling and availability integration
- v0.4: durable cross-professional handoffs using Temporal
- v0.5: Docassemble/Suffolk Assembly Line and jurisdiction-specific document packages
- Later: authorized court filing adapters and regulated provider integrations

## Current foundation through Checkpoint C2

The repository is a pnpm modular monolith with a Next.js App Router application,
shared configuration/UI/database packages, PostgreSQL with Drizzle migrations,
and private Garage object storage for local development. Better Auth identity,
case authorization, guided discovery, immutable document metadata, bounded
quarantine uploads, ClamAV scanning, structural PDF/DOCX validation, and an
isolated PDF-preview worker are implemented. Cross-professional document access
still requires explicit consent and a document grant; C3 collaboration and
professional-review interfaces remain in progress.

### Prerequisites

- Node.js 26.13.0 (see `.node-version` and `.nvmrc`)
- Docker Engine with Docker Compose
- pnpm 12.16.1

Bootstrap pnpm without relying on a global floating version:

```bash
npm install --global pnpm@12.16.1
pnpm install --frozen-lockfile
```

Create random local-only credentials, start PostgreSQL, Garage, Mailpit, ClamAV,
and the document worker, then apply the migrations:

```bash
pnpm setup:local
```

Start the application at <http://127.0.0.1:3000>:

```bash
pnpm dev
```

Generated `.env` and `.secrets/` files are ignored by Git. The committed
`.env.example` contains placeholders only. Published development ports are
loopback-only; Garage has no anonymous/public bucket policy or exposed
administration port. The worker has no inbound port or authentication/session
secret.

### Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:postgres-persistence
pnpm db:validate
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm audit --audit-level moderate
```

`pnpm db:validate` creates a temporary empty database, applies every migration,
asserts all expected relations and security triggers, and drops the database. The
integration suite creates another isolated temporary database and proves the B1
cross-case, cross-organization, lifecycle, consent-scope, ownership, grant-history,
and audit invariants. The persistence test removes and recreates a PostgreSQL 18
container against an isolated named volume. CI also proves that Gitleaks rejects
and redacts a runtime-generated synthetic secret canary.

### Local operations

```bash
pnpm infra:up
pnpm infra:logs
pnpm infra:down
```

Removing local volumes is intentionally not wrapped in a convenience command;
data deletion must be an explicit Docker Compose operation.

Read [AGENTS.md](AGENTS.md), [the product brief](docs/product-brief.md), and the
[Checkpoint A architecture](docs/architecture/adr-0001-modular-monolith.md)
before making changes.
