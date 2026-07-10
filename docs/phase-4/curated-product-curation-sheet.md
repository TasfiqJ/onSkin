# Phase 4 Curated Product Curation Sheet

Date: 2026-07-04

## Goal

Build the first launch catalog from real beta shelves and common U.S. products. The target is approximately 2,000 products, but the quality gate matters more than the count.

## Priority Order

1. Products beta users actually own.
2. High-frequency routine categories: cleanser, moisturiser, SPF, retinoid, exfoliant, vitamin C, hydrating serum.
3. Products with complete ingredient lists.
4. Products with barcode coverage.
5. Products with clear label PAO/expiry where relevant.
6. Products that commonly cause conflicts or duplicate actives.

## Required Fields

| Field             | Required                       | Notes                                                                              |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| Brand             | yes                            | Normalized in `brands`.                                                            |
| Product name      | yes                            | Keep variant/strength if label-visible.                                            |
| Barcode           | preferred                      | Required for scan match.                                                           |
| Category          | yes                            | Must map to `product_categories`.                                                  |
| Ingredient text   | yes for recommendable products | Preserve raw text and parser output.                                               |
| Source            | yes                            | `curated`, `open_beauty_facts`, `brand_label`, or mixed with per-field provenance. |
| Snapshot date     | yes                            | Required for imported data.                                                        |
| Quality grade     | yes                            | `verified`, `usable`, `limited`, `unverified`, or `blocked`.                       |
| Review status     | yes                            | Product recs require `reviewed`.                                                   |
| PAO/expiry        | optional                       | Unknown stays unknown. No fake expiry.                                             |
| Correction status | yes                            | Product recs blocked by open/triaged corrections.                                  |

## Product Quality Labels

- `verified`: reviewed source, barcode/product identity confirmed, ingredient parse high confidence, category reviewed, no open corrections.
- `usable`: sourced enough for shelf/routine behavior, but not ideal for public rec ranking.
- `limited`: may be searchable/scannable, not eligible for product-specific recommendations.
- `unverified`: fallback display only.
- `blocked`: do not surface except in internal QA.

## First Batch Policy

The repository contains tooling and fixtures, not a fake 2,000-product seed. A production batch must be created from approved sources and beta shelf evidence, then attached to a QA report.
