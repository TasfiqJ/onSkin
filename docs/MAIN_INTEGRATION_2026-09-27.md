# Current-main integration — 2026-09-27

The integration branch is `codex/main-integration`. It merges the verified local work at `1c3e48e60` with main at `3ace2ed93fda0e26bd56a489391c05fdfc22bf4f`. Main had 601 commits absent from the local branch. Both histories and the original checkpoint containing the 75 modified and 14 untracked files are preserved. The original Desktop checkout is unchanged and clean on `ai-integration-v1`.

## Already present on main

- Expo SDK 57 and Layerwell identity, warm shared UI, one-column onboarding, truthful free continuation, existing manual/OCR intake and private Progress.
- Stronger account-generation boundaries, age/health-consent admission, durable account deletion and withdrawal, Apple lifecycle, local persistence, RevenueCat owner/evidence fencing, and staging traffic-freeze controls.
- Literal closed commerce, Trend and sharing capabilities; expanded privacy/payment/source and release-evidence verification.

## Added or ported

- A floating four-tab dock with matching paper/night palette, full labels, native/web icons, hover/focus/press feedback, restrained scroll motion and reduced-motion handling. Screen content reserves clearance; existing scroll behavior is composed with dock reporting.
- Manual-first Shelf and optional label reading; catalog/search/barcode/recovery routes redirect without mounting deferred feature hooks. Ask, community and recommendations stay closed. Custom grant/reoffer routes remain out of the V1 purchase path.
- Compact goals/quiz and normal settings spacing. Apple/email flows stay available; the ordinary Google sign-in button is deferred.
- Ten-feature lean V1 contract and 25-item execution plan, retaining current source discovery, all applicable safety gates, and exact professional-review prerequisites for any future recommendation/share successor. Main's task/evidence snapshots are retained in `docs/hugeToDo/history/main-before-lean-integration-2026-09-27/`.

## Superseded code

Older owner-query, subscription, trend-consent, onboarding and monolithic edge-handler implementations were not copied over main's newer architecture. Their behavior was reconciled through current APIs. Old tests for deleted interfaces were superseded by current coverage. Main's native tab presentation was replaced by the explicitly requested floating dock; privacy, data and payment behavior remain current. The per-file resolution record is `docs/main-integration-resolution.json`.

## Verification

- Root typecheck and lint pass. All 421 mobile test files pass: 4,883 tests; the operator-console workspace tests also pass.
- Launch contract, exact closed-admission checks and the 25-item execution baseline are validated. Recommendation/share source contracts pass after retaining their future review requirements.
- Expo web first-session flows pass at 375 × 667, 390 × 844 and 430 × 932: age/health consent, three-product intake, truthful guidance, Today AM/PM check-off, reload persistence, tab round-trip and age re-verification denial.
- Floating navigation passes at 320, 360, 375, 390, 412 and 430 px widths with pointer hover, wheel scrolling, settle, reduced motion, deferred-route exits and manual-entry redirects. Screenshots and interaction/log summaries are under `test-results/human-e2e/2026-09-27/main-integration/`.
- E2E caught and fixed a parent-navigator redirect loop; see `docs/e2e-bug-reports/2026-09-27-main-integration-shelf-redirect.md`.
- Expected placeholder-Supabase, web-notification and existing SDK pointerEvents deprecation warnings are retained. No unexpected browser errors remain in the accepted runs.

## Remaining evidence limits

Main already records a blocked human-E2E release manifest and nine blocked device/evidence gates. The same broader gates remain blocked here; current web flow evidence is not a replacement for the governed 200% text-pressure release chain, physical iPhone/VoiceOver, StoreKit, live services, signed archives, professional review or store approval. No readiness status was forged or promoted to bypass those gates. This merge is source integration, not a production-launch declaration.
