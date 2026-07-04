# Phase 4 ODbL Compliance Memo

Date: 2026-07-04

## Source

Open Data Commons ODbL: https://opendatacommons.org/licenses/odbl/

## Working Compliance Position

This memo is an engineering control document, not legal advice. ODbL obligations must be reviewed by counsel before public launch.

OnSkin should assume that Open Beauty Facts/Open Food Facts data requires:

- clear attribution;
- preservation of source notices;
- share-alike analysis for any public derivative database;
- separation of database contents from image licensing;
- a documented contribution-back or correction workflow if the launch catalog uses community data.

## Product Rules

Do:

- Store `source_id`, `source_ref`, `source_snapshot_date`, and `source_url`.
- Show source and last updated date on product detail.
- Keep product images disabled until image rights are reviewed.
- Use exports for bulk import.
- Use exact barcode API lookup only for scan-time checks.

Do not:

- Crawl API search endpoints for bulk import.
- Hide attribution behind settings only.
- Promise contribution-back until the queue is live.
- Mix OBF-derived data into a closed public derivative database without legal review.
- Display OBF product photos before CC BY-SA and personality/image-rights handling is approved.

## Engineering Controls Implemented

- `catalog_sources` stores attribution, license, review, image, and share-alike flags.
- `catalog_import_batches` records snapshot date, artifact URI, hash, parser version, and QA report URI.
- `obf_contribution_queue` is service-role only and defaults to held/disabled until approved.
- `catalog_corrections` lets users report wrong matches without exposing global import queues.
- Client copy now avoids claiming unmatched products are contributed back.

## Exit Criteria

- Counsel records the ODbL posture.
- Attribution copy and URL are final-brand approved.
- Import artifacts and generated QA reports are archived.
- Any public database export/share-alike obligations have an operational owner.

