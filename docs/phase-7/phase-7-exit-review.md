# Phase 7 Exit Review

## Implemented in this phase

- Added central Phase 7 launch flags in `apps/mobile/src/lib/launch/phase7.ts`.
- Added reusable deferred route screen in `apps/mobile/src/components/launch/DeferredSurface.tsx`.
- Gated commerce, trend, cloud Ask, community posting, widgets/live activity, and share-card routes.
- Added a production runtime guard requiring a real final brand domain before deferred Phase 7 surfaces can open.
- Hid deferred entry points from Today, Progress, and You.
- Hid where-to-buy affordances when commerce is disabled.
- Changed share-card export to require exact rule match, reviewed conflict, final domain, and explicit flags.
- Added Phase 7 environment documentation to `.env.example`.
- Added Phase 7 surface inventory, launch claim matrix, beta dashboard spec, and QA checklist.
- Added Phase 7 verification scripts and generated QA packet output.
- Generated QA packets hash the Phase 7 verifier scripts and shared
  evidence-normalization helper, so packet evidence is tied to the local gates
  that decided its status.
- Strict QA packets now require granular scenario evidence for onboarding,
  shelf intake, reviewed guidance, routine builder, Today check-off, photos,
  reminders, payments, privacy controls, share cards, deferred surfaces, and
  analytics instead of accepting only broad Phase 7 evidence flags.

## Seven-figure readiness assessment

This is a stronger seven-figure candidate after Phase 7 because the app now protects the core paid loop:

- The product wedge is owned-product intelligence plus a daily routine habit, not generic skincare content.
- The paywall can appear after tangible value instead of before trust.
- The highest-liability growth/commerce/AI/community features are prevented from leaking into launch.
- The beta dashboard focuses on activation, D14 retention, payment QA, privacy trust, and support load.

The idea is not validated as a seven-figure business until a closed beta proves enough people add real products, return for check-offs/photos, trust the guidance, and pay after value. Phase 7 makes that test possible; it does not replace the test.

## Remaining blockers

- Final brand/domain legal clearance.
- Final consent and policy copy.
- Supabase production/RLS test evidence.
- Clinical/legal review with `reviewedBy` set for launch rules and any medical-adjacent content.
- Source-cleared beta product/ingredient catalog import.
- Native iOS/Android device QA for camera, reminders, app lock, and storage claims.
- RevenueCat store QA evidence from Phase 6 strict gates.
- Export/delete/withdraw QA evidence.
- Beta evidence dashboard connected to real analytics.
- Granular scenario QA evidence for every Phase 7 core-loop checklist group.

## Do-not-ship rule

Do not ship public production while strict Phase 7 checks fail. Production public flags for commerce, community posting, trend, cloud Ask, widgets, share cards, or goal-active recommendations require a real final brand domain, matching Phase 7 evidence, and `PHASE7_SIGNED_OFF_BY`; closed beta may proceed only when route gates remain closed for unavailable surfaces and the beta cohort understands which surfaces are intentionally unavailable.
