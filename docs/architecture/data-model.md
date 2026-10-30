# Proposed v0.1 data model

**Status:** Proposed; no migration has been generated.
**Tickets:** RES-003, RES-010 through RES-016, RES-018 through RES-021, RES-040

## Ownership and authorization rules

- Better Auth owns user, credential, verification, account, and session tables.
- A case is the primary coordination boundary. Creation transactionally adds an
  active `owner` membership.
- Case membership permits case-level actions only. It never implies document
  access.
- Every document read requires a current, action-specific `document_grant`.
  Creating a document transactionally creates an explicit owner grant; owner
  access is therefore visible and revocable subject to retention/legal rules.
- Consent and access are distinct. A disclosure authorization records the
  client's instruction and purpose; a grant is the technical permission. Policy
  may deny a grant even when consent exists because professional duties or legal
  restrictions take precedence.
- Legal, financial, and personal-support content uses an explicit classification
  and compartment. Cross-compartment status exchange is allowlisted and carries
  coordination metadata only.

## Core relations

| Relation                    | Important fields and constraints                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cases`                     | `id`, owner reference, `jurisdiction_code`, stage, household shape, timestamps; validated jurisdiction allowlist                                                                                          |
| `case_memberships`          | composite key `(case_id, user_id)`, role, status, valid interval; no global case role                                                                                                                     |
| `intake_sessions`           | `case_id`, schema version, status, current step, revision, timestamps; one active session per schema version                                                                                              |
| `intake_answer_versions`    | immutable `id`, `case_id`, session, question key, answer JSON, answer schema version, supersedes ID, actor, recorded time                                                                                 |
| `rule_versions`             | immutable version, jurisdiction scope, published status, content hash, effective interval, reviewer metadata                                                                                              |
| `recommendations`           | case, rule version, type, explanation code and rendered explanation, trigger references, generated time                                                                                                   |
| `roadmap_items`             | case, recommendation, milestone type, owner kind, dependency references, status, display order                                                                                                            |
| `disclosure_authorizations` | case, grantor, recipient, purpose, allowed classification/action, expiry, revoked time, immutable terms hash                                                                                              |
| `documents`                 | id, case, classification, title, created actor/time; metadata container only                                                                                                                              |
| `document_versions`         | immutable id, document and case, sequence, generated object key, SHA-256, byte size, detected media type, scan/validation state, created actor/time; unique `(document_id, sequence)` and `(case_id, id)` |
| `document_grants`           | document and case, grantee principal, allowed action, purpose, source authorization, expiry/revocation; no wildcard documents in v0.1                                                                     |
| `processing_jobs`           | version and case, job type/state, attempt count, lease fields, bounded error code; never stores file bytes                                                                                                |
| `outbox_events`             | transactionally created job/event notification with delivery state and idempotency key                                                                                                                    |
| `audit_events`              | append-only actor, action, target type/id, case, result, reason code, request correlation, UTC time, previous/event hash; no raw answers, filenames, tokens, or document content                          |

Professional organizations and invitations are later relations. The principal
shape reserves a typed identifier, but v0.1 accepts user principals only; it does
not create unused organization access paths.

## Integrity requirements

1. Case IDs are included in composite foreign keys between case-owned relations
   to make cross-case references fail at the database boundary.
2. Answer, rule, recommendation evidence, document version, consent terms, and
   audit records are immutable. Corrections append a superseding row.
3. Object keys are server-generated from random identifiers and content hashes;
   original filenames are display metadata only and are never paths.
4. Version content hash and size are calculated while streaming into quarantine
   and verified again before release. Released objects are write-once.
5. Grant uniqueness prevents duplicate active permissions for the same principal,
   version/document, action, and purpose. Expiry and revocation are evaluated for
   every read.
6. Policy decisions fail closed when membership, classification, purpose,
   authorization, or resource state is missing or unknown.
7. Sensitive answer values and object locations never appear in URLs, job errors,
   analytics, or audit details.

## Transaction boundaries

- Create case + owner membership + audit event
- Save answer version + advance session revision + audit event
- Publish rule version (reviewed content only)
- Generate recommendations + roadmap against one rule/answer snapshot
- Create document/version + owner grant + quarantine job + audit event
- Release/reject version + integrity metadata + audit event
- Grant/revoke access + immutable authorization history + audit event
