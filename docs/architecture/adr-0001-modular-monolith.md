# ADR-0001: pnpm modular monolith with isolated document worker

- **Status:** Proposed for review
- **Date:** 2026-10-29
- **Tickets:** RES-001, RES-002, RES-003, RES-010, RES-012, RES-020

## Context

Resurgo needs strongly separated domain rules and an isolated untrusted-file
pipeline, but v0.1 does not need independently deployed business microservices.
Future scheduling, Temporal, Docassemble, and court integrations need stable
adapter boundaries without becoming current runtime dependencies.

## Decision

Use a pnpm workspace and a modular monolith. Business rules live in dependency-
light packages and are invoked by server-only Next.js code. The only separate
runtime process in v0.1 is a least-privileged document worker because untrusted
PDF processing must not occur in the web process.

```text
resurgo/
├── apps/
│   ├── web/                 # Next.js App Router; UI and server entry points
│   └── document-worker/     # quarantine validation/scan/preview jobs only
├── packages/
│   ├── auth/                # Better Auth configuration and session adapter
│   ├── db/                  # Drizzle schema, migrations, transaction helpers
│   ├── domain/              # cases, discovery, recommendations, roadmap
│   ├── policy/              # deny-by-default authorization decisions
│   ├── storage/             # object-store ports and S3-compatible adapter
│   └── ui/                  # accessible Resurgo/shadcn components and tokens
├── infra/compose/           # pinned local PostgreSQL, object store, ClamAV, mail
├── tests/e2e/               # Playwright user journeys and cross-user denial
└── docs/                    # ADRs, threat model, traceability, operations
```

Dependency direction is inward: `web` and `document-worker` may depend on the
packages; domain and policy packages do not import Next.js, Better Auth, S3, or a
specific workflow engine. Storage, mail, scanning, and future orchestration are
ports with adapters.

All object access is authenticated and authorized in the trusted server layer.
Database queries include case/resource scope even after a positive policy
decision. Database constraints provide defense in depth; PostgreSQL row-level
security will be evaluated separately rather than claimed implicitly.

Document processing uses an explicit state machine:

```text
created -> quarantined -> validating -> scanning -> released
                         |             |          |
                         +-----------> rejected <-+
                                       |
                                     failed
```

Only `released` immutable versions may be previewed. Job creation and the
corresponding audit event occur in the same database transaction (outbox pattern).
Temporal may later consume the same job boundary; it is not required to run v0.1.

## Consequences

- A single deployable web application keeps operations understandable.
- The worker can have no session secrets, no broad database role, no released-
  bucket write access, and constrained CPU/memory/network permissions.
- Package boundaries must be enforced with lint rules and public exports to avoid
  a monolith becoming an unstructured dependency graph.
- The local S3-compatible implementation remains replaceable. Product selection
  requires a maintenance/license review and a pinned version before RES-002 is
  accepted.
- Docassemble, Assembly Line, scheduling, Temporal, and e-filing directories are
  not created until their tickets begin.

## Alternatives rejected

- **Microservices for each professional domain:** operational cost without a v0.1
  need; logical and data-access boundaries are sufficient now.
- **PDF processing inside Next.js:** violates the isolation requirement for
  untrusted content.
- **Temporal in the first runtime:** durable orchestration is useful later, but
  scanning can begin behind a durable job interface without it.
