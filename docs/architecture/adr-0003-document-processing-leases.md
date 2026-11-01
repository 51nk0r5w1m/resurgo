# ADR-0003: Short database leases for document processing

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Document validation, malware scanning, preview generation, and private-object
publication can take longer than a normal database transaction. Holding a
version-row lock while those external operations run consumes a connection and
blocks unrelated status work. Committing a processing marker without renewing
it, however, lets another worker reclaim an attempt that is still active.

## Decision

The worker uses append-only processing events as a renewable lease:

1. A short transaction locks one eligible version and appends `processing`.
2. The transaction commits before object storage, parsing, or ClamAV work.
3. The active worker appends a fresh `processing` heartbeat every minute. A
   lease becomes reclaimable only after five minutes without a heartbeat.
4. A short final transaction locks the version and compares the latest event ID
   with the attempt's last lease event ID. Only the current owner may append
   `available` or `rejected` and its corresponding audit event.
5. Retryable infrastructure failures stop heartbeats and leave the processing
   marker to expire. Deterministic rejection records status before best-effort
   quarantine cleanup.

Processing events remain immutable. No transaction or row lock spans an
external service call.

## Consequences

Slow scanning no longer exhausts database connections or holds long-lived row
locks. A crashed worker is recoverable after the bounded lease interval, while
an active long-running worker keeps ownership. Status finalization fails closed
when ownership changed. The event stream includes heartbeat entries, which is a
deliberate storage cost for preserving append-only operational evidence.
