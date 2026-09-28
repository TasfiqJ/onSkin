# Phase 4 Catalog Observability Dashboard

Date: 2026-07-17

## Required Metrics

| Metric                            | Source                                     | Launch threshold                                        |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| Barcode match rate                | `catalog_lookup_events`                    | beta trend improving; category-specific misses reviewed |
| Search success rate               | `catalog_lookup_events`                    | no major product-category dead zone                     |
| Manual fallback rate              | shelf `added_via=manual`                   | acceptable only if users still complete shelf setup     |
| OCR parse confidence              | parser result / `product_ingredient_lists` | low-confidence rows routed to review                    |
| Unknown ingredient token rate     | parser result                              | no silent drops; top unknowns curated                   |
| Wrong-match reports               | bounded CAT-08 correction queue            | triage opens an independent hold; disposition does not release it |
| Missing-product reports           | `catalog_corrections`                      | feed curation priority                                  |
| Recommendation-eligible products  | products quality model                     | visible by category and routine role                    |
| First-party correction backlog    | `catalog_corrections`                      | seven-day triage SLA; no external source publication    |
| Held-row serving probes           | catalog barcode/search RPCs                | zero ineligible rows returned                           |
| Import QA blockers                | `catalog_quality_reports`                  | zero blockers before launch batch                       |
| Stage/review reconciliation       | CAT-02 sealed batch verification           | exact count/hash; zero pending/conflict records         |
| Promotion/rollback reconciliation | CAT-02 immutable revisions/effects/events  | 100% lineage; zero unexplained projection drift         |
| Active product holds              | required migration-owner monitoring job; no schema-v1 operator projection | every active hold suppresses all serving lanes          |
| Queue age by bounded severity      | CAT-08 redacted queue projection           | reviewed operations SLA; no raw report export           |
| Lease conflict/reclaim rate        | required privacy-reviewed server counters; not implemented | investigated; no lost or overwritten decisions          |
| Operator admission denials/rate    | source-defined committed global/per-action DB limiter; hosted privacy-reviewed counters/alerts not deployed | stale/MFA/grant/abuse failures alert without reporter content; threshold/load proof and scheduled idle purge required |
| Hold release reconciliation        | CAT-08 hold events + CAT-02/CAT-03 receipts | exact staged proof; four distinct people; no auto-activation |

## Events

Client/server events should use content-minimal properties:

- `catalog_barcode_lookup`
- `catalog_search`
- `catalog_lookup_no_match`
- `catalog_manual_fallback_started`
- `catalog_manual_fallback_saved`
- `catalog_correction_reported`
- `ingredient_parse_completed`

Do not send full ingredient lists, product photos, user notes, or health profile values to analytics.

## Alerts

- Barcode match rate drops below beta baseline.
- Wrong-match reports exceed 2% of matched scans.
- Parser unknown-token rate exceeds 15% for a launch category.
- Any product with `quality_grade` lower than `usable` is used in a product-specific recommendation.
- OBF import uses API search/bulk calls instead of export artifacts.
- Any source without production/legal approval, or any active independent
  CAT-08 product hold, is returned by barcode/search or
  direct authenticated reads. An untrusted open user report remains
  owner-scoped until operator review and does not become a cross-user denial
  mechanism.
- Reporter withdrawal/account deletion removes an independent product hold, or
  accepting/rejecting/closing a report releases the held product.
- Repair/release lacks the exact current CAT-02 projection and signed staged
  CAT-03 successor proof over the active-hold root, reuses any triage/decision/
  repair/release actor, or causes serving before a fresh post-release CAT-03
  activation/readback.
- Any operator action succeeds with an anonymous, `aal1`, stale/revoked Auth
  session, a missing/mismatched live-session verified TOTP factor, inactive
  grant/capability, expired
  ten-minute work session, wrong/expired five-minute claim, or stale CAS.
- Any queue, log, metric, permanent mutation evidence, or unclaimed detail
  exposes reporter identity, raw free text, arbitrary report JSON, a service
  secret, or an unbounded export. Claimed correction detail is purpose-limited,
  field-allowlisted, and cleared with its lease/session.
- Any exact operation/chunk key is replayed with different request bytes.
- Any promoted row lacks batch/staged-record/source-artifact/transform/QA/
  review lineage, or a rolled-back row remains servable.
- Any first-party report is forwarded to OBF, CosIng, or another source.
