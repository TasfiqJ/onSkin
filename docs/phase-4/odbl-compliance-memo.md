# Phase 4 ODbL Compliance Memo

Date: 2026-07-17

## Source

Open Data Commons ODbL: https://opendatacommons.org/licenses/odbl/

## Working Compliance Position

This memo is an engineering control document, not legal advice. ODbL obligations must be reviewed by counsel before public launch.

OnSkin should assume that Open Beauty Facts/Open Food Facts data requires:

- clear attribution;
- preservation of source notices;
- share-alike analysis for any public derivative database;
- separation of database contents from image licensing;
- a documented correction workflow and an operational path for any share-alike/source obligations that counsel determines apply. ODbL is not treated here as an automatic requirement to transmit user corrections back to the source.

## Product Rules

Do:

- Store `source_id`, `source_ref`, `source_snapshot_date`, and `source_url`.
- Show source and last updated date on product detail.
- Keep product images disabled until image rights are reviewed.
- Use exports for bulk import.
- Resolve user barcode/search requests only against OnSkin's reviewed catalog. Any OBF-derived data is transformed from a detached, hash-bound offline artifact; no user lookup is disclosed to OBF at runtime.
- Keep the OBF-derived component logically separable and exportable from proprietary/editorial catalog components until counsel records the derivative-versus-collective-database posture.
- Treat the current filtering/normalization transformer conservatively as the
  derivative-database path: it cannot pass production validation without the
  exact entire-derivative-or-alterations machine-readable delivery evidence.
  A collective-component conclusion would require a separately reviewed
  transformer/policy change; it is not an alternate value an operator can type
  into the current approval.

Do not:

- Crawl API search endpoints for bulk import.
- Call OBF/OFF at request time, including exact-barcode lookup.
- Hide attribution behind settings only.
- Publish or promise publication of a user lookup, missing-product report, or
  correction to OBF. External contribution is outside this launch architecture;
  any future source recipient requires a new privacy/legal/architecture decision.
- Mix OBF-derived data into a closed public derivative database without legal review.
- Display OBF product photos before CC BY-SA and personality/image-rights handling is approved.

## Engineering Controls Implemented

- `catalog_sources` stores attribution, license, review, image, and share-alike flags.
- `catalog_import_batches` records snapshot date, artifact URI, hash, parser version, and QA report URI.
- `catalog-source-policy.json` and the import validator require exact artifact
  bytes/hash, snapshot date, approved source host, deterministic transformed
  payload, current policy/trust/scope/transformer, public attribution URL,
  dual-signed legal/engineering decisions, offline-only use, and the separable
  OBF component before a production transform can run.
- The externally root-signed trust registry is separately pinned by current
  epoch and raw-file hash so an older valid registry cannot be replayed.
- `catalog-release-build-evidence.json` binds the resolved production Expo
  config, EAS build/Git metadata, inspected IPA/Info.plist identity/hashes, and
  observed US App Store availability to a current engineering signature.
- Migration `20260718000059_catalog_scan_minimization.sql` purges and force-RLS
  seals the deprecated `obf_contribution_queue`, removes every policy, revokes
  all runtime table and enqueue-RPC authority, and retains the empty relation
  only for migration/account-erasure compatibility. There is no launch
  restoration path; neither the client nor `catalog-report` publishes into it.
- `catalog_corrections` lets users report wrong matches through OnSkin's
  owner-scoped first-party operation without exposing global import queues or
  forwarding reports to OBF.
- Client copy now avoids claiming unmatched products are contributed back.
- Migration `20260717000056_catalog_serving_eligibility_gate.sql` keeps every
  unapproved source and every unreviewed, below-usable, ineligible, or
  operator-held row out of barcode/search/recommendation serving. Migration
  `20260717000057_catalog_import_lifecycle.sql` adds exact batch lineage and
  non-destructive withdrawal without activating any contribution recipient.

## Exit Criteria

- Counsel records the ODbL posture.
- Attribution copy and URL are final-brand approved.
- Dual-signed import approvals, signed EAS/archive/App Store build evidence,
  exact source/transform outputs, and zero-warning QA reports are archived.
- Any public database export/share-alike obligations have an operational owner.

## Current Primary Sources

- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- Open Food Facts/Open Beauty Facts API and data-reuse terms: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Database/content/image license distinctions: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/

The architecture above is a conservative engineering inference from those sources, not a legal conclusion. Counsel must approve the exact database-combination, attribution, offer-of-data, and territorial posture before production promotion.
