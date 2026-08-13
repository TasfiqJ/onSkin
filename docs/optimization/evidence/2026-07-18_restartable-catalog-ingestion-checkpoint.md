# Restartable Catalog Ingestion Checkpoint

Date: 2026-07-18 (America/Toronto)

Parent SHA: `6a2c2a97df165535ff52eb5f6870ca3c6815443a`

Scope: OPT-117 local implementation completeness.

## Outcome

The fixture-only catalog scripts are no longer the production ingestion path.
Open Beauty Facts JSONL now has a service-role-only, bounded-memory importer
that can restart from server truth after a worker, process, or response failure
without exposing a partial catalog.

## Contract

| Boundary | Implemented behavior |
| --- | --- |
| Input | First pass hashes and counts raw bytes/records; second pass normalizes without loading the artifact into memory |
| Memory | Batch cap 500; record cap 1 MiB; RPC response cap 64 KiB |
| Identity and timing | Source revision, artifact SHA-256, importer version, canonical GTIN, per-row payload SHA-256, worker invocation timing, and database lifecycle timestamps |
| Validation | GTIN-8/12/13/14 check digit, required name/category, bounded fields, JSON and oversized-record rejection |
| Restart | Durable server checkpoint plus mode-0600 atomic local checkpoint; server progress is authoritative and content-free reject reasons are reconstructed from the immutable stream on every invocation |
| Retry | Exact batch SHA-256 receipt makes commit-then-response-loss replay idempotent |
| Staging | Import-version-isolated tables protected by RLS and service-role-only functions |
| Deduplication | Latest source line wins a repeated canonical GTIN, including duplicates inside one SQL batch |
| Promotion | Complete/count-reconciled `ready` version and production-approved source required; product updates, retirements, active pointer, and predecessor metadata commit atomically |
| Privacy | Checkpoints and reports contain counts, hashes, versions, and reject reasons only; no product payload or credential is recorded |

The bulk worker does not crawl the public Open Beauty Facts API. Curated rows
are not overwritten when a source barcode conflicts.

## Failure Matrix

The deterministic adapter injects both failure classes that make naive restart
unsafe:

- the first batch commits and then loses its response; the exact receipt returns
  the committed counters without duplicating rows or counts;
- the next batch fails twice before commit, so the first invocation stops at the
  last durable checkpoint;
- the local checkpoint is deleted to emulate another worker, and the resumed
  stream reconstructs reject reasons from the source while sending only records
  after the server checkpoint;
- a recreated staging database starts a new import for the same immutable file
  while the prior local checkpoint remains, and its reject manifest is rebuilt
  exactly once instead of trusting the unrelated local import ID;
- invalid JSON, invalid GTIN, non-skin-care category, oversized name, and a raw
  record over 1 MiB are rejected without entering staged product data;
- a later duplicate GTIN wins, promotion cannot occur before `ready`, and an
  already-active exact rerun is a no-op.

Result: 8 input records, 3 accepted records, 5 rejected records, and 2 canonical
staged products.

## Verification

- `node --check scripts/phase4/catalog-import-core.mjs`: PASS.
- `node --check scripts/phase4/import-obf-production.mjs`: PASS.
- `node --check scripts/phase4/catalog-import-production-smoke.mjs`: PASS.
- `npm.cmd run phase4:import-fixture-smoke`: PASS, including both legacy fixture importers and the production failure matrix.
- `npm.cmd test`: PASS, 334 files / 3,993 tests.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run lint`: PASS with zero warnings.
- `git diff --check`: PASS.

## Remaining Verification

OPT-117 is `implemented`, not `verified`. This workstation has no running local
Postgres/Supabase target, so the migration has not been executed here. A
production-like staging project must still prove migration/RLS/function
behavior, full approved-snapshot duration and storage, client visibility during
promotion, search `EXPLAIN (ANALYZE, BUFFERS)`, and an operator rollback drill.
No hosted result, approval, or full-scale timing is inferred.
