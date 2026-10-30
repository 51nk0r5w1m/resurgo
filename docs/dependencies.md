# Dependency inventory

**Reviewed:** 2026-10-30
**Policy:** Direct dependencies and critical infrastructure use exact versions.
The lockfile is authoritative for transitive versions. CI produces dependency
audit evidence; this inventory is not a vulnerability-free claim.

The root pnpm override upgrades legacy `esbuild <=0.24.2` references in Drizzle
Kit's development-only loader to patched `esbuild 0.25.12` for
`GHSA-67mh-4wv8-2f99`. Migration generation and validation are release gates for
this compatibility override.

## Application and workspace

| Dependency                     |     Version | License    | Purpose                                                       |
| ------------------------------ | ----------: | ---------- | ------------------------------------------------------------- |
| Node.js                        | 26.13.0 LTS | MIT        | JavaScript runtime                                            |
| pnpm                           |     12.16.1 | MIT        | Workspace package manager                                     |
| Next.js / `eslint-config-next` |      16.4.3 | MIT        | App Router application and lint rules                         |
| React / React DOM              |      19.3.1 | MIT        | User interface runtime                                        |
| TypeScript                     |       6.0.3 | Apache-2.0 | Newest release supported by Next.js's TypeScript ESLint chain |
| Tailwind CSS / PostCSS adapter |       4.3.3 | MIT        | Design tokens and utility CSS                                 |
| Drizzle ORM                    |      0.45.4 | Apache-2.0 | Typed PostgreSQL access                                       |
| Drizzle Kit                    |     0.31.11 | MIT        | Migration generation and validation                           |
| `pg` / `@types/pg`             |      8.23.1 | MIT        | PostgreSQL driver and types                                   |
| Zod                            |       4.6.7 | MIT        | Environment and boundary validation                           |
| Radix Slot                     |       1.5.0 | MIT        | shadcn-compatible composition primitive                       |
| Class Variance Authority       |       0.7.1 | Apache-2.0 | shadcn-compatible component variants                          |
| `clsx`                         |       2.1.1 | MIT        | Conditional class composition                                 |
| `tailwind-merge`               |       3.7.0 | MIT        | Tailwind class conflict resolution                            |
| Lucide React                   |      1.64.0 | ISC        | Accessible icon components                                    |
| Vitest                         |      4.1.12 | MIT        | Unit tests                                                    |
| Playwright                     |      1.64.1 | Apache-2.0 | Browser acceptance tests                                      |
| ESLint                         |      9.39.5 | MIT        | Newest major supported by Next.js's lint plugins              |
| Prettier                       |      3.9.10 | MIT        | Formatting                                                    |
| Prettier Tailwind plugin       |       0.8.1 | MIT        | Deterministic class ordering                                  |
| `dotenv-cli`                   |      11.1.0 | MIT        | Root environment injection for workspace commands             |

Type packages use their corresponding published MIT licenses:
`@types/node` 26.6.6, `@types/react` 19.3.0, and `@types/react-dom`
19.3.0.

The Phase B1 identity schema targets Better Auth 1.7.14 (MIT), the current stable
release reviewed on 2026-10-30. The runtime and Drizzle adapter are intentionally
not installed until RES-006 begins; adapter schema validation is an acceptance
gate for that ticket. PDF.js, pdf-lib, S3 SDK, and ClamAV client packages remain
uninstalled until their implementation tickets begin.

## Local infrastructure

| Component  | Version and immutable image                                                               | License            | Notes                                                                |
| ---------- | ----------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| PostgreSQL | `18.6-alpine3.24@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5` | PostgreSQL License | Official multi-architecture image; loopback-only port                |
| Garage     | `v2.5.0@sha256:677e5b758e4425a325b811c425c026bf35a4bf42f7ddbaa773de3f4fd779a5a5`          | AGPL-3.0           | Official `dxflrs/garage`; private single-node local development only |

Garage 2.5.0 was selected after verifying that its upstream repository is not
archived, its default branch was active in October 2026, and the fixed tag is the
version used by its official single-node documentation. Single-node Garage has no
redundancy and is not a production topology.

## CI actions

GitHub Actions are pinned to immutable commits, with version comments in
`.github/workflows/ci.yml`: checkout v5, setup-node v6, and pnpm/action-setup v4.
Gitleaks 8.30.1 runs from an immutable container digest against the full
checked-out Git history, without GitHub API permissions.

## Unresolved licensing decision

The Resurgo source repository itself does not yet contain an approved project
license. The root package is therefore marked `UNLICENSED`; adopting an
open-source license requires an explicit maintainer decision and a `LICENSE` file.
