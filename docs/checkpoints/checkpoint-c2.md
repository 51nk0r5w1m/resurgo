# Checkpoint C2 — secure document processing

**Tickets:** RES-019 through RES-022
**Branch:** `feat/checkpoint-c-documents`

## Functional acceptance

- Authenticated case owners can upload synthetic PDF or native DOCX files to a
  private quarantine key and see deterministic processing status in the case
  document library.
- A separate worker claims append-only processing jobs, verifies the immutable
  SHA-256 hash, validates PDF/OOXML structure, streams bytes to ClamAV, creates a
  raster-only PDF preview, and releases the immutable object only after every
  gate succeeds.
- Available versions can be downloaded through an authenticated application
  route. Available PDFs can be previewed through the same policy boundary.
- The web package cannot import the native preview renderer; it is exposed only
  through the worker package entry point.

## Security acceptance

- The upload boundary uses streaming multipart parsing with a 15 MB file cap,
  bounded fields/parts/headers, allowlisted metadata, signature/MIME agreement,
  and opaque server-generated keys.
- Quarantined, processing, rejected, missing, cross-case, and ungranted versions
  return no content. Retrieval checks current case membership, resource grant,
  consent, professional affiliation, and processing state.
- Garage has no anonymous object policy. Response filenames are fixed by the
  server and document responses use `no-store`, `nosniff`, and sandbox CSP.
- The worker has no inbound port, authentication secret, SMTP configuration, or
  browser-facing code. Its root filesystem is read-only and Compose limits CPU,
  memory, PIDs, temporary storage, and network reachability.
- Document bytes, original filenames, credentials, and scanner output are not
  written to application logs or audit metadata.

## Automated evidence

- Unit tests cover bounded multipart parsing, MIME/signature validation,
  malformed PDF, unsafe/macro-enabled OOXML, content-hash mismatch behavior,
  quarantine bypass prevention, and raster-only preview output.
- Live integration tests prove private Garage object access, bounded reads,
  quarantine promotion, ClamAV acceptance/rejection, and end-to-end clean PDF
  release and preview generation.
- Database integration tests deny unrelated users, deny quarantined versions,
  and prove only an available version is retrievable. Worker integration tests
  prove successful publication and fail-closed scanner retry state.
- Playwright covers the authenticated client upload journey and proves preview
  and download controls remain absent while the file is quarantined.

This evidence does not verify an entire ASVS requirement or establish legal,
privacy, mortgage, or financial regulatory compliance.
