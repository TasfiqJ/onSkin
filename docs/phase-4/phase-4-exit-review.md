# Phase 4 Exit Review

Date: 2026-07-17

## Implementation Status

Implemented locally:

- Phase 4 additive catalog schema and RLS.
- Source/license control docs for CosIng, Open Beauty Facts, and ODbL.
- Machine-readable source policy, deliberately pending fixed trust registry,
  release scope, release-build evidence, intentionally invalid approval
  templates, and an audit that keeps OBF/CosIng runtime requests, images, and
  external contribution disabled.
- Explicit fixture allowlisting and non-promotable candidate transforms plus
  production transforms bound to exact artifact bytes/hash, deterministic
  transformed payload, source/date, current policy and transformer tree,
  externally root-signed reviewer registry with replay-resistant epoch/hash
  pins, release identity/scope, projected fields, public attribution surface,
  source-specific legal determinations, operations evidence, and dual legal/
  engineering Ed25519 signatures.
- Exact signed release-build evidence contract covering production EAS
  build/Git/resolved Expo config, inspected IPA/Info.plist identity/hashes, App
  Store Connect app, and observed US availability.
- Ingredient parser, product quality model, OBF mapping, and fixture tests.
- OBF and CosIng fixture/candidate/production import and source-specific QA
  scripts; approved QA revalidates embedded approvals and current release
  evidence rather than checking output shape alone.
- Beta coverage report generator and smoke gate that reject missing,
  placeholder, or threshold-failing closed-beta catalog evidence.
- Product search, barcode lookup, and correction-report Edge Function scaffolds
  plus migration `0056`'s shared fail-closed serving gate for positive source,
  review, quality, eligibility, mapping, and live-correction evidence.
- Mobile shelf source/quality disclosure, search fallback, parser-backed OCR, and report issue flow.
- Explicit exclusion of external contribution from the launch architecture;
  reports remain in the first-party correction operation, and restoring a
  source recipient would require a new privacy/legal/architecture decision.

## Launch Status

Not launch-cleared.

The implementation intentionally keeps production catalog use blocked until:

- final brand/support email/domain/attribution page exist;
- OBF and ODbL obligations are reviewed;
- CosIng reuse posture is reviewed;
- the active reviewer registry, approved US release scope, dual-signed source
  approvals, and signed exact EAS/archive/App Store evidence exist for the same
  release;
- curated launch batch is built from real approved sources;
- beta coverage report exists;
- clinical/legal/cosmetic-chemist review clears product guidance;
- native barcode/OCR camera work is verified on devices.

## Seven-Figure App Check

Phase 4 is necessary because it turns the app from a generic routine coach into a shelf system of record. It is still not sufficient by itself. The catalog must be accurate enough that users trust routine and conflict guidance on products they actually own.

The current build improves the seven-figure path by adding:

- real provenance and source disclosure;
- correction loop;
- quality gating before product-specific recommendations;
- manual fallback that does not break the V1 loop;
- import QA tooling instead of untracked data entry.

The unresolved commercial risk is coverage. A polished catalog architecture does not prove users will pay unless beta users can add real products and receive useful, trustworthy guidance.

## Exit Criteria Still Open

- Source/legal approval attached.
- The audit passes the exact pending/pending/pending baseline, then the
  active/approved/pending build-candidate commit A that EAS builds, then the
  active/approved/verified evidence-only descendant B. Every other mixed state
  fails, and B proves the approved transformer/config payload did not drift.
- Release-mode validation accepts the active external trust registry, approved
  fixed scope, signed build evidence, and exact dual-signed approvals; the
  checked-in pending templates alone cannot authorize import.
- Exact OBF/CosIng candidate hashes, source bytes, approvals, production
  transforms, and zero-warning source-specific QA reports are retained.
- First curated batch imported.
- Import QA report has zero blockers.
- Product recommendations use only eligible products.
- Hosted database evidence through migration `0056` proves barcode, search,
  recommendation, and direct reads fail closed for every held source/product.
- Closed beta coverage meets threshold.
- App copy and attribution approved under final brand.
