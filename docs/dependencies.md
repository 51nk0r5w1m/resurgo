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

| Dependency                     |     Version | License      | Purpose                                                       |
| ------------------------------ | ----------: | ------------ | ------------------------------------------------------------- |
| Node.js                        | 26.13.0 LTS | MIT          | JavaScript runtime                                            |
| pnpm                           |     12.16.1 | MIT          | Workspace package manager                                     |
| Next.js / `eslint-config-next` |      16.4.3 | MIT          | App Router application and lint rules                         |
| React / React DOM              |      19.3.1 | MIT          | User interface runtime                                        |
| TypeScript                     |       6.0.3 | Apache-2.0   | Newest release supported by Next.js's TypeScript ESLint chain |
| Tailwind CSS / PostCSS adapter |       4.3.3 | MIT          | Design tokens and utility CSS                                 |
| Drizzle ORM                    |      0.45.4 | Apache-2.0   | Typed PostgreSQL access                                       |
| Drizzle Kit                    |     0.31.11 | MIT          | Migration generation and validation                           |
| `pg` / `@types/pg`             |      8.23.1 | MIT          | PostgreSQL driver and types                                   |
| Zod                            |       4.6.7 | MIT          | Environment and boundary validation                           |
| Radix Slot                     |       1.5.0 | MIT          | shadcn-compatible composition primitive                       |
| Class Variance Authority       |       0.7.1 | Apache-2.0   | shadcn-compatible component variants                          |
| `clsx`                         |       2.1.1 | MIT          | Conditional class composition                                 |
| `tailwind-merge`               |       3.7.0 | MIT          | Tailwind class conflict resolution                            |
| Lucide React                   |      1.64.0 | ISC          | Accessible icon components                                    |
| Vitest                         |      4.1.12 | MIT          | Unit tests                                                    |
| Playwright                     |      1.64.1 | Apache-2.0   | Browser acceptance tests                                      |
| ESLint                         |      9.39.5 | MIT          | Newest major supported by Next.js's lint plugins              |
| Prettier                       |      3.9.10 | MIT          | Formatting                                                    |
| Prettier Tailwind plugin       |       0.8.1 | MIT          | Deterministic class ordering                                  |
| `dotenv-cli`                   |      11.1.0 | MIT          | Root environment injection for workspace commands             |
| Better Auth / Drizzle adapter  |      1.7.14 | MIT          | Identity, sessions, recovery, verification, and TOTP MFA      |
| Nodemailer                     |      10.3.1 | MIT-0        | SMTP delivery to the local email-capture service              |
| Fastify Busboy                 |       3.2.4 | MIT          | Streaming multipart parsing with explicit upload limits       |
| AWS SDK S3 client              |    3.1159.0 | Apache-2.0   | Private S3-compatible quarantine and released-object access   |
| PDF.js                         |     6.4.299 | Apache-2.0   | Sandboxed PDF parsing and client rendering                    |
| pdf-lib                        |      1.17.1 | MIT          | Server-side PDF structural parsing/manipulation               |
| ZIP.js                         |      2.24.0 | BSD-3-Clause | Bounded native DOCX/OOXML archive inspection                  |
| fast-xml-parser                |      5.11.2 | MIT          | Required DOCX XML-part parsing and structural validation      |
| `@napi-rs/canvas`              |      1.0.13 | MIT          | Worker-only PDF page rasterization                            |
| tsx                            |     4.23.15 | MIT          | Worker TypeScript runtime with ESM workspace resolution       |

Type packages use their corresponding published MIT licenses:
`@types/node` 26.6.6, `@types/react` 19.3.0, and `@types/react-dom`
19.3.0.

Better Auth 1.7.14 is fixed to the reviewed RES-006 release. Runtime schema and
clean-migration validation are acceptance gates. Worker-only native rendering is
kept out of the Next.js package export and image.

## Local infrastructure

| Component  | Version and immutable image                                                                     | License            | Notes                                                                |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| PostgreSQL | `18.6-alpine3.24@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5`       | PostgreSQL License | Official multi-architecture image; loopback-only port                |
| Garage     | `v2.5.0@sha256:677e5b758e4425a325b811c425c026bf35a4bf42f7ddbaa773de3f4fd779a5a5`                | AGPL-3.0           | Official `dxflrs/garage`; private single-node local development only |
| Mailpit    | `v1.32.0@sha256:0790692be935ea4420d085694f7985b1f692ca6a8771ab0e0bd8ba75ac180498`               | MIT                | Loopback-only SMTP and browser inbox for synthetic local email       |
| ClamAV     | `1.5.4-debian13-slim@sha256:cce3e1a43ae2bb40e11335c52c0e1e98273b12fa3d587e617f63a6907cc4b70b`   | GPL-2.0-only       | Loopback-only malware scanner with restricted runtime resources      |
| Worker     | `26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9` | MIT                | Node runtime for the isolated, no-inbound-port document processor    |

Garage 2.5.0 was selected after verifying that its upstream repository is not
archived, its default branch was active in October 2026, and the fixed tag is the
version used by its official single-node documentation. Single-node Garage has no
redundancy and is not a production topology.

## CI actions

GitHub Actions are pinned to immutable commits, with version comments in
`.github/workflows/ci.yml`: checkout v5, setup-node v6, and pnpm/action-setup
v6.1.0. Gitleaks 8.30.1 runs from an immutable container digest against the
full checked-out Git history, without GitHub API permissions.

## Unresolved licensing decision

The Resurgo source repository itself does not yet contain an approved project
license. The root package is therefore marked `UNLICENSED`; adopting an
open-source license requires an explicit maintainer decision and a `LICENSE` file.
