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

## Backend only

- Professional Review Register revisions, evidence links, acknowledgements, and
  supersession are persisted and authorized, but assignment/acknowledgement UI is
  not yet a complete professional workflow.
- Document grants and disclosure consent are enforced by the domain layer, but
  the client sharing-management interface is not complete.
- Document requests are persisted and actionable, but notification delivery is
  not implemented.
- Versioned Atlanta discovery definitions and deterministic rule definitions
  exist, but the current interview UI has not yet migrated to the new engine.

## Not implemented

- Professional invitation and verified-pilot onboarding UI.
- Scheduling and appointments.
- Court filing adapters, Docassemble, billing, electronic signatures, Docxodus
  editing, and OpenContracts intelligence.
- Production key management, production retention operations, and nationwide
  jurisdiction support.
