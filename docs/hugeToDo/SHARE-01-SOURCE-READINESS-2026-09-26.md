# SHARE-01 Source-Readiness Checkpoint — 2026-09-26

Status: **source boundary hardened; launch and native-device acceptance remain blocked**

This checkpoint covers only SHARE-01 source readiness. It does not change the
authoritative tracker and does not claim App Store, legal, clinical, brand,
domain, signed-build, or physical-device acceptance.

## Safe current behavior

- `/share/conflict/[ruleId]` remains literal zero-admission. It does not read
  the route identifier, Shelf, products, profile, photos, rule content,
  receipts, or reviewer data and performs no capture, file, network, analytics,
  link, or native-share side effect.
- `/s/[shareId]` remains a record-blind neutral unavailable state and does not
  imply that any supplied identifier exists.
- `shareConflictCard()` and conflict public-link creation remain closed even
  for receipt-looking, flag-looking, or final-domain-looking input.

## Defects found and fixed

1. The dormant public projection parser previously accepted caller-authored
   brand, eyebrow, review-status label, CTA, watermark, and disclaimer values.
   Shape validation alone could therefore have laundered a false “reviewed” or
   first-party presentation if a future gate were opened incorrectly.
2. Public card strings previously accepted line breaks, zero-width characters,
   bidi overrides, word joiners, and other control/formatting bytes that could
   make the reviewed preview differ materially from what a recipient perceived.
3. No isolated share-card renderer existed behind the closed route, making the
   selected-data boundary harder to audit independently of Shelf UI.
4. No canonical builder demonstrated that a future card projection originates
   only from an admitted reviewed rule and the exact normalized final-domain
   watermark, without taking product or account objects.

## Implemented source readiness

- `shareProjection.ts` now requires exact Layerwell-owned brand, eyebrow,
  review-status, CTA, watermark, and disclaimer copy and rejects invisible or
  direction-changing characters.
- `shareProjectionBuilder.ts` fails closed unless `isReviewedRule()` admits the
  canonical rule and the exact normalized final domain matches the visible
  watermark. Its API accepts no product, Shelf, profile, photo, account, note,
  citation, reviewer, or URL object. Only canonical `shareTitle`, `shareClaim`,
  and severity copy can enter the selected public projection.
- `ConflictShareCard.tsx` renders only the sanitized projection. It includes a
  visible first-party watermark and not-medical-advice disclaimer and has no
  capture, file, network, analytics, public-link, or native-share dependency.
- Regression tests reject private/extra fields, accessor-backed fields,
  caller-authored product copy, deceptive Unicode/control characters,
  candidate rules, and self-asserted review markers.

## Verification

- Focused growth/conflict regression: **69 tests passed in 6 files**.
- Mobile TypeScript check: **passed**.
- Mobile lint: run as part of the shared checkout verification; no SHARE-01
  lint finding was observed; the completed mobile lint exited successfully.
- `docs/USER_FLOW_TREE.md` already contains the current zero-admission direct
  entry and future native-unavailable branches. It was intentionally not
  changed here because another active lane owns that file.
- Human-simulated UI was not rerun: no Expo surface was listening on the
  repository's known local ports, and the new renderer is intentionally
  unreachable while admission is closed. Existing historical web fixture
  screenshots are not promoted to current evidence. Native success/cancel/
  failure evidence remains required on the exact future admitted build.

## Required before SHARE-01 can be complete

The following are real blockers, not work that can be safely simulated:

1. An accepted, independently reviewed publication-receipt issuer and verifier,
   with content-rights, clinical/cosmetic, regulatory-claims, privacy/security,
   and release authority for the exact artifact.
2. A legitimately admitted reviewed conflict corpus. The current detached
   review-signature verifier intentionally admits no rules.
3. Final cleared brand/domain authority and an exact first-party production
   domain; placeholder watermarks cannot ship.
4. An exact-payload preparation and confirmation flow binding the previewed
   image bytes, immutable projection, destination behavior, and redisclosure
   warning to the same native share attempt.
5. Only after items 1–4: capture at 1080 × 1920, bounded temporary-file
   lifecycle, account-change/interruption fencing, native share-sheet success,
   cancel, unavailable, thrown-failure, retry, and cleanup behavior.
6. Human-simulated iOS verification on the exact signed build and supported
   physical iPhones, including VoiceOver, Dynamic Type, long reviewed copy,
   offline/interruption, account change, and proof that no private field enters
   the image, share payload, logs, analytics, URLs, or unapproved processors.

The user-flow tree should gain explicit future native **success**, **cancel**,
**failure/cleanup**, and **account-change/interruption** branches when the
positive authority exists. Adding executable positive fixtures before then
would weaken the literal zero-admission contract and is not acceptable evidence.
