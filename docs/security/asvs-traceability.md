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

| Requirement                               | Current evidence                                                                                             | Status                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `v5.0.0-3.2.1` response context           | CSP denies object content and framing; browser/header tests pass                                             | Partial; document responses do not exist       |
| `v5.0.0-3.4.5` referrer policy            | `strict-origin-when-cross-origin` asserted in central response header configuration                          | Implemented, not independently verified        |
| `v5.0.0-13.3.1` secret management         | ignored random local secret generation, placeholder rejection/redaction test, pinned Gitleaks CI scan        | Partial; production secret manager deferred    |
| `v5.0.0-13.3.2` least privilege           | loopback service exposure, Garage admin port withheld, container `no-new-privileges`                         | Partial; separate PostgreSQL roles deferred    |
| `v5.0.0-15.1.2` component inventory       | exact direct versions/licenses, frozen lockfile, explicit install-script allowlist, moderate-threshold audit | Implemented evidence; SBOM generation deferred |
| `v5.0.0-16.5.1` safe configuration errors | environment error formatter reports field names without rejected secret values                               | Partial; application error boundary deferred   |

## Checkpoint B1 evidence

No requirement is marked verified. Phase B1 adds the following automated,
partial evidence; RES-010 must add request-level deny-by-default tests before any
authorization requirement can be considered for verification.

| Requirement                      | Current evidence                                                                                                      | Status                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `v5.0.0-8.1.1`, `v5.0.0-8.1.2`   | ADR-0002 defines identity, organization, case, consent, grant, classification, operation, and lifecycle inputs        | Documented design; policy implementation absent  |
| `v5.0.0-8.2.2`                   | PostgreSQL tests reject cross-case resource/consent references and prove grants address one case membership           | Partial database evidence; route tests absent    |
| `v5.0.0-8.3.1`                   | Composite foreign keys and constraint triggers enforce case ownership and scoped references below the web layer       | Partial; centralized policy engine absent        |
| `v5.0.0-8.4.1`                   | Tests reject unverified professional participation and prove one organization member does not inherit another's grant | Partial database evidence; query policy absent   |
| `v5.0.0-14.1.1`, `v5.0.0-14.1.2` | Resource classification enum separates shared, legal, financial, personal-support, and health-related envelopes       | Schema evidence; field projection tests absent   |
| `v5.0.0-16.2.1`, `v5.0.0-16.2.5` | Audit schema limits event fields to actor/action/target/outcome/reason/correlation/integrity metadata                 | Schema evidence; emission/redaction tests absent |
| `v5.0.0-16.4.2`                  | Integration test proves the database rejects audit-event update and delete; hash fields are format-checked and unique | Partial; hash-chain verification deferred        |
