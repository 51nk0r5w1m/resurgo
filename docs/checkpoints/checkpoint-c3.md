# Checkpoint C3 — document collaboration and professional review

**Scope:** document requests, deterministic review history, and consent-bound
cross-professional review foundations.

## Functional acceptance

- Clients can create classified document requests, track requested/submitted/
  completed state, and link a submission to one exact available document version.
- The case document page presents the client library, request tracker, and the
  reusable Professional Review Register without implying an automated legal or
  mortgage conclusion.
- Reviews retain responsible professional, scope, decision context, exact
  evidence versions, findings, outstanding conditions, clarification requests,
  deterministic revisions, and attorney acknowledgements.
- Creating a newer source-document version appends a `superseded` review revision
  for every affected current review. Prior evidence and review history remain.

Document processing state remains independent from request state and professional
review state:

- processing: `quarantined → processing → available | rejected`
- request: `requested → submitted → completed` or `cancelled`
- review: `assigned → in_progress → clarification_required → completed`, with
  terminal `withdrawn` and `superseded` transitions allowed by policy

## Security acceptance

- Request and review resources use the same deny-by-default current-state policy
  as documents. Case membership alone does not expose either resource.
- Assigning a request or sharing a review with a professional requires active,
  classification- and operation-matched disclosure consent and resource grants.
- Consent, grant, case membership, organization membership, pilot verification,
  and professional MFA are revalidated for every list or mutation.
- Submitted documents must be available, same-case, exact-version evidence in the
  same information domain as the request.
- Request events, review revisions, statements, evidence, and acknowledgements
  are append-only. Lifecycle and disclosure actions create minimized audit events.

## Automated evidence

- Integration tests cover consent-bound request assignment, consent withdrawal,
  cross-user denial, immutable request history, same-domain exact-version
  submission, completion, review clarification, specialist findings, explicit
  attorney disclosure, acknowledgement, and subsequent consent revocation.
- The document-version test proves an evidence change appends a superseded review
  revision while retaining the exact prior evidence.
- Playwright covers client request creation inside the authenticated document
  journey.

No ASVS requirement or regulatory regime is claimed verified by this checkpoint.
