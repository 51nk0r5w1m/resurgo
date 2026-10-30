# OWASP ASVS 5.0.0 traceability seed

**Status:** Planned evidence only; no control is marked verified.
**Baseline:** OWASP ASVS 5.0.0 Level 2. Identifiers use OWASP's required
version-qualified form. RES-004 must expand this seed to the complete applicable
L2 matrix and record applicability decisions.

| ASVS requirement                                                                | Resurgo implementation evidence                                                               | Planned automated evidence                        |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `v5.0.0-2.2.1` input validation                                                 | Schemas at every server boundary                                                              | invalid jurisdiction/intake/upload metadata tests |
| `v5.0.0-3.3.1` through `v5.0.0-3.3.4` cookie controls                           | Better Auth secure host-only, SameSite, HttpOnly session cookie configuration                 | production-config cookie assertions               |
| `v5.0.0-3.5.1` CSRF defense                                                     | trusted origins plus anti-forgery/origin checks on mutations                                  | cross-origin mutation rejection test              |
| `v5.0.0-5.1.1` upload policy                                                    | documented PDF type, size, processing, and rejection rules                                    | policy/config consistency test                    |
| `v5.0.0-5.2.1` upload size                                                      | streaming byte cap before persistence completes                                               | over-limit stream rejection test                  |
| `v5.0.0-5.2.2` file type validation                                             | extension, declared MIME, magic bytes, and parser agree                                       | mismatch/polyglot fixture tests                   |
| `v5.0.0-5.3.2` safe file paths                                                  | server-generated object keys; display name never used as a path                               | traversal filename test                           |
| `v5.0.0-5.4.1` and `v5.0.0-5.4.2` served filenames                              | ignored/sanitized upload name and safe content disposition                                    | response header injection tests                   |
| `v5.0.0-5.4.3` malware scanning                                                 | quarantined object scanned before release                                                     | EICAR rejected; scanner unavailable fails closed  |
| `v5.0.0-6.1.1` and `v5.0.0-6.3.1` authentication abuse defense                  | documented account/IP rate limits and non-lockout behavior                                    | rate-limit integration tests                      |
| `v5.0.0-6.2.1`, `v5.0.0-6.2.4`, `v5.0.0-6.2.9`, `v5.0.0-6.2.12` password policy | Better Auth password policy and breached-password screening                                   | boundary and known-breached password tests        |
| `v5.0.0-7.2.1` through `v5.0.0-7.2.4` session verification/token lifecycle      | trusted backend session lookup and token rotation                                             | fixation and stale-token tests                    |
| `v5.0.0-7.4.1` logout invalidation                                              | server-side session termination                                                               | replay after sign-out test                        |
| `v5.0.0-8.1.1` and `v5.0.0-8.1.2` authorization documentation                   | action/resource/field policy matrix                                                           | policy table completeness test                    |
| `v5.0.0-8.2.2` object authorization                                             | explicit case and document permissions                                                        | unrelated-user case/document denial tests         |
| `v5.0.0-8.2.3` field authorization                                              | role/classification response projection                                                       | sensitive-field omission tests                    |
| `v5.0.0-8.3.1` trusted enforcement                                              | server-only policy entry point; no UI-only authorization                                      | direct route/API bypass tests                     |
| `v5.0.0-8.4.1` tenant isolation                                                 | case-scoped queries and composite foreign keys                                                | cross-case read/write/reference tests             |
| `v5.0.0-11.1.1` and `v5.0.0-11.1.2` key lifecycle/inventory                     | key policy and crypto inventory                                                               | configuration/rotation runbook evidence           |
| `v5.0.0-12.3.1` encrypted transport                                             | TLS for application, database, object store, scanner, and operations in deployed environments | deployment configuration scan                     |
| `v5.0.0-13.2.4` and `v5.0.0-13.2.5` outbound allowlist                          | worker egress denied; application integrations allowlisted                                    | SSRF and denied-egress tests                      |
| `v5.0.0-13.3.1` and `v5.0.0-13.3.2` secret management                           | external secrets and least-privilege service identities                                       | secret scan and identity permission tests         |
| `v5.0.0-14.1.1` and `v5.0.0-14.1.2` sensitive-data classification               | legal/financial/personal-support/shared classification policy                                 | schema and policy matrix tests                    |
| `v5.0.0-14.2.1` no sensitive URL data                                           | answers and object locations only in bodies/server state                                      | URL/log capture E2E assertion                     |
| `v5.0.0-14.3.2` no browser caching                                              | private responses use `Cache-Control: no-store`                                               | protected response header tests                   |
| `v5.0.0-15.1.2` component inventory                                             | lockfile, SBOM, exact dependency/version/license document                                     | CI SBOM generation and SCA                        |
| `v5.0.0-16.2.1` and `v5.0.0-16.2.5` audit metadata/redaction                    | allowlisted actor/action/target/result metadata; no raw sensitive values                      | audit shape and forbidden-field tests             |
| `v5.0.0-16.3.1` through `v5.0.0-16.3.4` security event logging                  | auth, denial, upload/view/grant/revoke, bypass, and failure events                            | event emission integration tests                  |
| `v5.0.0-16.4.2` log integrity                                                   | append-only role and tamper-evident chain                                                     | update/delete denial and chain verification tests |
| `v5.0.0-16.5.1` and `v5.0.0-16.5.3` safe failure                                | generic errors and fail-closed policy/scan paths                                              | dependency-failure and error leakage tests        |

Manual review and operational evidence are necessary for requirements that cannot
be proven by a unit or integration test. Passing a mapped test is evidence for a
requirement, not by itself a claim that the requirement or ASVS level is verified.

## Checkpoint A evidence

No requirement is marked verified. The following implementation evidence now
exists and remains subject to RES-004 review:

| Requirement                               | Current evidence                                                                                                                | Status                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `v5.0.0-3.2.1` response context           | CSP denies object content and framing; browser/header tests pass                                                                | Partial; document responses do not exist       |
| `v5.0.0-3.4.5` referrer policy            | `strict-origin-when-cross-origin` asserted in central response header configuration                                             | Implemented, not independently verified        |
| `v5.0.0-13.3.1` secret management         | atomic exclusive local-secret publication, symlink/overwrite regression tests, and a pinned Gitleaks synthetic-detection canary | Partial; production secret manager deferred    |
| `v5.0.0-13.3.2` least privilege           | loopback service exposure, Garage admin port withheld, container `no-new-privileges`                                            | Partial; separate PostgreSQL roles deferred    |
| `v5.0.0-15.1.2` component inventory       | exact direct versions/licenses, frozen lockfile, explicit install-script allowlist, moderate-threshold audit                    | Implemented evidence; SBOM generation deferred |
| `v5.0.0-16.5.1` safe configuration errors | environment parser rejects malformed lines without values and validates exported variables when `.env` is absent                | Partial; application error boundary deferred   |

## Checkpoint B1 evidence

No requirement is marked verified. Phase B1 adds the following automated,
partial evidence; RES-010 must add request-level deny-by-default tests before any
authorization requirement can be considered for verification.

| Requirement                      | Current evidence                                                                                                                        | Status                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `v5.0.0-8.1.1`, `v5.0.0-8.1.2`   | ADR-0002 defines identity, organization, case, consent, grant, classification, operation, and lifecycle inputs                          | Documented design; policy implementation absent        |
| `v5.0.0-8.2.2`                   | PostgreSQL tests reject cross-case references; current-state case/resource decisions deny unrelated principals and ineffective grants   | Partial database/domain evidence; route tests absent   |
| `v5.0.0-8.3.1`                   | Server-domain policy functions and database constraints enforce scoped references and deny missing or stale authorization inputs        | Partial trusted-layer evidence; route binding absent   |
| `v5.0.0-8.4.1`                   | Tests prove organization peers do not inherit grants and suspended organizations/revoked affiliations immediately lose effective access | Partial database/domain evidence; request tests absent |
| `v5.0.0-14.1.1`, `v5.0.0-14.1.2` | Resource classification enum separates shared, legal, financial, personal-support, and health-related envelopes                         | Schema evidence; field projection tests absent         |
| `v5.0.0-16.2.1`, `v5.0.0-16.2.5` | Audit schema limits event fields to actor/action/target/outcome/reason/correlation/integrity metadata                                   | Schema evidence; emission/redaction tests absent       |
| `v5.0.0-16.4.2`                  | Integration test proves the database rejects audit-event update and delete; hash fields are format-checked and unique                   | Partial; hash-chain verification deferred              |

## PR #4 remediation evidence

No requirement is marked verified. The following tests add implementation
evidence only:

| Requirement                                    | Automated evidence                                                                                                                                                                                                                      | Remaining limitation                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `v5.0.0-8.2.2`, `v5.0.0-8.3.1`, `v5.0.0-8.4.1` | `security-boundaries.integration.test.ts` covers unrelated principals, organization suspension, affiliation revocation, inactive cases, owner-basis enforcement, consent revocation, grant expiry/revocation, and historical regranting | Authenticated request binding is deferred to RES-010/B2      |
| `v5.0.0-13.3.1`                                | `secure-files.test.mjs` covers exclusive publication, overwrite preservation, partial-write cleanup, and symlink rejection; `test-gitleaks-negative.mjs` requires detection and redaction of a generated canary                         | Production secret manager selection remains open             |
| `v5.0.0-16.4.2`                                | Existing database integration test still rejects audit update/delete after migration `0003`                                                                                                                                             | Cryptographic chain generation/verification remains deferred |
| `v5.0.0-16.5.1`                                | `environment-file.test.mjs` and `check-env.test.mjs` cover malformed input and process-only configuration                                                                                                                               | Deployed startup wiring remains a B2 gate                    |

## RES-006 authentication evidence

No ASVS requirement is marked fully verified by this checkpoint. The following
version-qualified mappings record implementation and test evidence:

| Requirement                                                    | Evidence                                                                                                                                                                                                     | Status / limitation                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `v5.0.0-3.3.1`–`v5.0.0-3.3.4`                                  | Production configuration uses a `Secure`, `HttpOnly`, `SameSite=Lax`, path-rooted `__Host-resurgo.session` cookie; integration tests assert production configuration and emitted development-cookie controls | Implemented automated evidence                                                                               |
| `v5.0.0-3.5.1`                                                 | Better Auth origin and CSRF checks remain enabled; integration test rejects an untrusted origin with HTTP 403                                                                                                | Implemented automated evidence                                                                               |
| `v5.0.0-6.1.1`, `v5.0.0-6.3.1`                                 | Database-backed per-route limits cover registration, login, verification, recovery, reset, and MFA; registration exhaustion test proves HTTP 429 after the configured threshold                              | Implemented automated evidence                                                                               |
| `v5.0.0-6.2.1`, `v5.0.0-6.2.5`, `v5.0.0-6.2.6`, `v5.0.0-6.2.9` | Better Auth enforces 12–128 character passwords; forms use password inputs and permit paste/password managers                                                                                                | Breached-password screening (`V6.2.12`) remains unresolved and is not claimed                                |
| `v5.0.0-6.3.3`                                                 | TOTP enrollment, verification, recovery codes, account lockout, and UI flows are configured                                                                                                                  | Partial: MFA is required for professionals at RES-010 activation, but not yet enforced for all client access |
| `v5.0.0-6.4.3`                                                 | Recovery tokens expire after 30 minutes, are single-use, and password reset revokes sessions; replay/revocation integration test passes                                                                      | Implemented automated evidence; recovery with enrolled MFA requires further E2E evidence                     |
| `v5.0.0-6.5.1`, `v5.0.0-6.5.3`, `v5.0.0-6.5.5`                 | Better Auth 1.7.14 TOTP and backup-code implementation; integration test enrolls and verifies TOTP, consumes a backup code, and rejects replay                                                               | Implemented automated evidence for configured flow                                                           |
| `v5.0.0-6.3.8`                                                 | Generic sign-in, registration, and recovery interface messages; known/unknown recovery responses are equal in integration tests                                                                              | ASVS L3 requirement used as additional risk-based evidence; timing analysis remains                          |
| `v5.0.0-7.2.1`                                                 | Dashboard and security routes call server-side `getSession`; cookie cache is disabled so every request revalidates database state                                                                            | Implemented automated session lookup evidence                                                                |
| `v5.0.0-7.4.1`, `v5.0.0-7.4.4`                                 | Logout is visible on the protected dashboard; integration test proves the revoked cookie cannot retrieve a session                                                                                           | Implemented automated evidence                                                                               |
| `v5.0.0-16.2.1`, `v5.0.0-16.2.5`, `v5.0.0-16.3.1`              | Registration, verification, session creation/revocation, recovery, reset, and denied login events use allowlisted identifiers/outcomes without email, token, password, IP, or user-agent values              | Event-presence/redaction assertions remain before verification claim                                         |

## RES-010 authorization evidence

No ASVS control is marked fully verified solely by this checkpoint. These tests
are the named evidence for the applicable requirements:

| Requirement                    | Evidence                                                                                                                                                                  | Status / limitation                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `v5.0.0-8.1.1`, `v5.0.0-8.1.2` | ADR-0002 plus typed case/resource operations define principal, role, case, organization, resource, classification, grant, consent, lifecycle, and MFA inputs              | Documented and implemented for current case/resource fields; discovery field projections remain B4                        |
| `v5.0.0-8.2.1`                 | Owner-only membership grant/revoke decisions and negative privilege-escalation integration test                                                                           | Implemented automated evidence                                                                                            |
| `v5.0.0-8.2.2`                 | Better Auth-bound HTTP test proves an unrelated principal receives the same 404 for another case and an absent case; list response excludes the case                      | Implemented automated evidence                                                                                            |
| `v5.0.0-8.2.3`                 | Case API returns an allowlisted projection and never returns owner/authentication internals in list/create responses                                                      | Partial; broader field-projection tests remain with discovery and documents                                               |
| `v5.0.0-8.3.1`                 | Central `@resurgo/db` policy is invoked by API factories and membership transactions; no client identifier establishes the acting principal                               | Implemented automated evidence                                                                                            |
| `v5.0.0-8.3.2`                 | Current-state queries and concurrent-revocation test prove the next decision denies revoked membership; professional organization and affiliation changes are revalidated | Additional risk-based L3 evidence; distributed-cache behavior is not applicable because authorization caching is disabled |
| `v5.0.0-8.4.1`                 | Cross-case foreign-key tests, cross-organization tests, organization-peer grant denial, and request-level case isolation                                                  | Implemented automated evidence for current relations                                                                      |
| `v5.0.0-16.3.1`                | Case creation/grant/revoke success and request-level denials append minimized audit events                                                                                | Event content is schema-constrained; explicit event-presence test remains                                                 |

## First client journey evidence

No ASVS control is marked fully verified solely by this checkpoint. The client
journey adds the following named implementation and automated evidence:

| Requirement                                       | Evidence                                                                                                                                                | Status / limitation                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `v5.0.0-2.2.1`                                    | Server schemas restrict case creation to the two enabled pilot jurisdictions and discovery answers to known question/option pairs                       | Implemented evidence for the current journey inputs                                  |
| `v5.0.0-8.2.2`, `v5.0.0-8.3.1`, `v5.0.0-8.4.1`    | Central case policy guards every discovery operation; integration tests deny an unrelated principal and composite foreign keys reject cross-case output | Implemented automated evidence for discovery, recommendations, and roadmap relations |
| `v5.0.0-14.2.1`                                   | Answer values are sent in request bodies and are absent from route URLs, audit metadata, and browser navigation                                         | Integration test asserts raw answer values are absent from audit events              |
| `v5.0.0-14.3.2`                                   | Discovery API responses emit `Cache-Control: no-store`                                                                                                  | Header is configured; direct browser assertion remains                               |
| `v5.0.0-16.2.1`, `v5.0.0-16.2.5`, `v5.0.0-16.3.1` | Answer-save and completion events record actor, case/session, action, outcome, correlation ID, and integrity value without answer content               | Integration test asserts event presence and raw-answer redaction                     |

## RES-018 immutable document and review-register evidence

No ASVS control is marked fully verified by C1. Upload and rendering controls
remain planned for C2 and are not claimed here.

| Requirement                                       | Current evidence                                                                                                                                                                                                        | Status / limitation                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `v5.0.0-8.2.2`, `v5.0.0-8.3.1`, `v5.0.0-8.4.1`    | Central case/resource decisions protect document and review mutations; composite foreign keys bind versions, contributors, evidence, and reviews to one case; revoked professional affiliation denies the next revision | Implemented domain/database evidence; HTTP document routes do not exist yet                               |
| `v5.0.0-14.1.1`, `v5.0.0-14.1.2`                  | Document resources carry separate shared, legal, financial, personal-support, and health classifications plus document confidentiality labels                                                                           | Schema evidence; response projection remains C2/C3                                                        |
| `v5.0.0-16.2.1`, `v5.0.0-16.2.5`, `v5.0.0-16.3.1` | Document creation, version creation, access grants, legal-hold changes, and review creation append minimized audit events without document content                                                                      | Implemented event-shape evidence; complete read/download audit awaits C2                                  |
| `v5.0.0-16.4.2`                                   | Immutable-table triggers reject history update/delete; audit events store a nonce and canonical hash fields; unit test detects reason/resource tampering                                                                | Partial integrity evidence; previous-hash chain population and external anchoring remain deployment gates |

## RES-019 through RES-022 secure-processing evidence

No ASVS control is marked fully verified by C2. These named tests are
implementation evidence only.

| Requirement                                       | Current evidence                                                                                                                                                                  | Status / limitation                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `v5.0.0-5.1.1`, `v5.0.0-5.2.1`                    | `multipart-upload.test.ts` proves allowlisted multipart fields and a streaming 15 MB cap; the route also rejects excessive declared request lengths                               | Implemented automated evidence; production edge/proxy limits remain a deployment gate   |
| `v5.0.0-5.2.2`, `v5.0.0-5.3.2`                    | `validation.test.ts` checks MIME/signature agreement, malformed PDF, unsafe OOXML paths/macros, bounded archives, and opaque server-generated keys                                | Implemented automated evidence for PDF/DOCX inputs                                      |
| `v5.0.0-5.4.1`, `v5.0.0-5.4.2`                    | Retrieval uses fixed server filenames, `nosniff`, explicit content types, private no-store responses, and sandbox CSP                                                             | Header implementation evidence; direct response-header integration assertion remains    |
| `v5.0.0-5.4.3`                                    | Live `clamav.integration.test.ts` proves harmless content passes and the standard antivirus test signature fails; processor tests prove scanner outages cannot release quarantine | Implemented automated evidence; operational signature freshness/alerting remains        |
| `v5.0.0-8.2.2`, `v5.0.0-8.3.1`, `v5.0.0-8.4.1`    | DB integration denies cross-case metadata/version access and quarantined content; retrieval reuses the centralized current-state resource policy                                  | Domain/route implementation evidence; professional disclosure browser flow remains C3   |
| `v5.0.0-13.2.4`, `v5.0.0-13.2.5`                  | Worker has no inbound port and uses an internal Compose network; web exports cannot load the native worker renderer                                                               | Partial environment evidence; production egress enforcement needs deployment validation |
| `v5.0.0-14.3.2`                                   | Document list and bytes use private `Cache-Control: no-store`; object storage integration proves anonymous reads fail                                                             | Implemented local evidence; deployed CDN/proxy behavior remains                         |
| `v5.0.0-16.3.1`, `v5.0.0-16.5.1`, `v5.0.0-16.5.3` | Processing and read/download actions append minimized events; hash, parser, scanner, and storage failures remain unavailable and never expose content                             | Implemented automated fail-closed evidence; operational monitoring remains              |
