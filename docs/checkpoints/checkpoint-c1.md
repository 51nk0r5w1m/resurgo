# Checkpoint C1 — immutable documents and professional reviews

**Ticket:** RES-018  
**Branch:** `feat/checkpoint-c-documents`

## Functional acceptance

- A case-scoped document owns immutable PDF or DOCX versions with a SHA-256
  content hash, byte size, MIME type, provenance, version number, and exact
  supersession link.
- Classification, confidentiality, retention, legal-hold events, ownership,
  authorized contributors, and explicit document resource grants are modeled
  independently from storage and processing providers.
- The reusable Professional Review Register records its own grantable case
  resource, responsible professional, decision context, review scope,
  deterministic status revisions, findings and conditions, exact document-
  version evidence, supersession, and attorney acknowledgements.
- Review and evidence history remains present when a source version is
  superseded or a professional affiliation is revoked.

## Security acceptance

- All creation and mutation domain functions call the centralized case or
  resource policy. Professional access revalidates case membership,
  organization membership, verified pilot status, MFA, grant, and consent.
- Composite foreign keys bind documents, versions, evidence, contributors, and
  reviews to one case. Cross-case identifiers cannot establish access.
- Database triggers reject update or delete of document versions, processing
  history, legal-hold events, review revisions, statements, evidence, and
  acknowledgements.
- New audit events use a stored nonce and canonical hash over persisted security
  metadata. Audit rows remain append-only.
- No upload, object storage, preview, malware scanning, or automated
  professional conclusion is implemented in C1.

## Automated evidence

- Clean-database migration validation checks all C1 relations and immutable
  triggers.
- Integration coverage creates a financial document, grants explicit consent,
  assigns a mortgage specialist, records an evidence-linked review, supersedes
  the document, and proves the review still references the exact first version.
- The same test proves immutable rows reject mutation and revoked professional
  affiliation prevents a new review revision while history remains intact.
- Audit unit coverage proves reason-code or resource-type tampering changes the
  canonical hash result.

These tests are implementation evidence. They do not verify an entire ASVS
requirement or establish legal or regulatory compliance.
