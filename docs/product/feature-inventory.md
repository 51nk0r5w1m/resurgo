# Working feature inventory

**Updated:** 2026-10-30

This inventory distinguishes usable product from backend foundations. A feature
is marked browser-tested only when Playwright exercises it against local
PostgreSQL, Garage, ClamAV, and the document worker.

## Implemented and browser-tested

- Account registration, email verification, login, logout, and protected routes.
- Private case creation for Fulton and DeKalb Superior Court pilot configurations.
- Case-scoped document library with search, classification filters, and status.
- Multi-file PDF/DOCX upload with per-file progress and validation feedback.
- Private quarantine, malware scan, structural validation, and processing status.
- Authorized PDF.js page rendering, navigation, zoom, download, and highlights.
- Authorized Docxodus DOCX rendering with page controls and tracked-change display.
- Immutable replacement versions and version-specific comments.
- PDF side-by-side version viewing and Docxodus redline comparison for DOCX.
- Negative cross-case document access denial.
- Versioned, adaptive 40-question discovery engine across nine Georgia-focused
  modules with save/resume, backward correction, provenance, non-answer states,
  structured values, document references, and applicable-question progress.
- Deterministic professional recommendations, document requests, review triggers,
  and explainable roadmap items, validated across five distinct synthetic cases.

## Backend only

- Verified-pilot professional invitation, explicit acceptance, granular document
  disclosure/revocation, review assignment, immutable review revisions,
  evidence-linked findings, and attorney acknowledgement are implemented in the
  case workspace. The complete multi-user professional journey still requires a
  dedicated Playwright fixture and is not yet browser-tested.
- Document requests are persisted and actionable, but notification delivery is
  not implemented.

## Not implemented

- Self-service professional organization verification (pilot participants remain
  administratively verified).
- Scheduling and appointments.
- Court filing adapters, Docassemble, billing, electronic signatures, Docxodus
  editing, and OpenContracts intelligence.
- Production key management, production retention operations, and nationwide
  jurisdiction support.
