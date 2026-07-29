# Phase 7 Exit Review

## Implemented in this phase

- Added central Phase 7 launch flags in `apps/mobile/src/lib/launch/phase7.ts`.
- Added reusable deferred route screen in `apps/mobile/src/components/launch/DeferredSurface.tsx`.
- Gated commerce, cloud Ask, community posting, widgets/live activity, and
  share-card routes. PHOTO-05A separately closes Trend with literal
  capability, flag, and machine-admission values rather than relying on an
  environment gate.
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
- Generated QA packets also hash the human-simulated E2E rules/tree/manifest,
  the generated Phase 5 native-device packet, and the generated Phase 6
  payments packet, so Phase 7 core-loop signoff cannot drift from the local UI,
  native-device, or payments evidence packets it depends on.
- The human-E2E manifest now requires the authored-cycle customization summary,
  and the Phase 7 packet hashes Custom-cycle Settings, Week, Why Tonight, Plan,
  Today, deterministic projection, persistence, and completion sources. Removing
  the evidence or changing those sources therefore invalidates the local gate
  and downstream packet hashes instead of leaving a stale passing launch check.
- The human-E2E manifest also requires account-generation-bound combined-export
  evidence. One cancellable lease now covers owner capture, local snapshot,
  Edge request, plaintext cache, share, and deletion; sign-out/A-to-B aborts and
  drains stale work before the next session can publish, while exact-owner and
  post-write race tests fail closed.
- Strict QA packets now require granular scenario evidence for onboarding,
  shelf intake, reviewed guidance, routine builder, Today check-off, photos,
  reminders, payments, privacy controls, share cards, deferred surfaces, and
  analytics instead of accepting only broad Phase 7 evidence flags.
- Today completion persistence now returns the exact post-insert day snapshot
  from its serialized encrypted-store mutation. Cycle-night eligibility uses
  that snapshot plus the exact scheduled PM keys, so concurrent final-step
  writes produce one eligible event and repeated same-key taps remain one
  insertion. Phase 7 hashes the persistence, decision helper, route, and tests.
- PHOTO-05A removes the historical simulated-Trend output path. Progress has no
  Trend result or consent entry, direct Trend routes recover truthfully, and
  disabled hooks do not read photo/consent/profile/tone/Trend state, compute
  simulated metrics, persist, call external/native/file services, or emit
  content analytics. Positive consent grant refuses before mutation; explicit
  legacy withdrawal cleanup remains a data-rights path only. The Phase 7 and
  Phase 9 inventories bind the complete current Trend authority set.

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
- A consent-aware durable analytics transport/outbox with delivery evidence;
  the local event-decision fixes do not make the current sanitizer-only
  `track()` path a production analytics pipeline.
- Granular scenario QA evidence for every Phase 7 core-loop checklist group.
- A real PHOTO-05 on-device result issuer, PHOTO-06 predeclared
  diverse-condition calibration/fairness report, PHOTO-07 exact consent and
  data-lifecycle disclosures, archive-identical local-only proof,
  supported-iPhone/accessibility/performance evidence, and independent
  `B-AI-ONDEVICE`, `B-AI-FAIRNESS`, and `B-AI-LEGAL` closure.

## Do-not-ship rule

Do not ship public production while strict Phase 7 checks fail. Production
public flags for commerce, community posting, cloud Ask, widgets, share cards,
or goal-active recommendations require a real final brand domain, matching
Phase 7 evidence, and `PHASE7_SIGNED_OFF_BY`; closed beta may proceed only when
route gates remain closed for unavailable surfaces and the beta cohort
understands which surfaces are intentionally unavailable. Trend cannot be
enabled by a public flag or Phase 7 signoff: the current machine admission is
literal zero. A future positive successor requires a versioned result issuer
and every PHOTO-05/06/07, professional, archive, native, privacy, legal, and
release gate described in the PHOTO-05A checkpoint.
