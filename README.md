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

## Checkpoint B1 foundation

The repository is a pnpm modular monolith with a Next.js App Router application,
shared configuration/UI/database packages, PostgreSQL with Drizzle migrations,
and private Garage object storage for local development. Phase B1 adds the
Better Auth-compatible identity schema and separate organization, case,
classified-resource, consent/grant, and audit boundaries. Authentication and
document handling are deliberately not implemented yet.

### Prerequisites

- Node.js 26.13.0 (see `.node-version` and `.nvmrc`)
- Docker Engine with Docker Compose
- pnpm 12.16.1

Bootstrap pnpm without relying on a global floating version:

```bash
npm install --global pnpm@12.16.1
pnpm install --frozen-lockfile
```

Create random local-only credentials, start PostgreSQL and Garage, and apply the
initial migration:

```bash
pnpm setup:local
```

Start the application at <http://127.0.0.1:3000>:

```bash
pnpm dev
```

Generated `.env` and `.secrets/` files are ignored by Git. The committed
`.env.example` contains placeholders only. PostgreSQL and Garage publish ports on
loopback; Garage has no anonymous/public bucket policy or exposed administration
port.

### Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm db:validate
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm audit --audit-level moderate
```

`pnpm db:validate` creates a temporary empty database, applies every migration,
asserts all expected relations and security triggers, and drops the database. The
integration suite creates another isolated temporary database and proves the B1
cross-case, cross-organization, consent-scope, ownership, and audit invariants.
CI runs the same quality gates and a Gitleaks secret scan.

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
