# Decisions

## Decision Log Format

Use this format for every significant product, architecture, pricing, privacy, or launch decision:

```markdown
## YYYY-MM-DD - Decision Title

- Decision:
- Type: Product / Architecture / Stack / Pricing / Privacy / Growth / Legal / Launch
- Alternatives:
- Criteria:
- Evidence:
- Risk:
- Status: Proposed / Accepted / Rejected / Superseded
- Owner:
- Review date:
```

## Product Decisions

### 2026-07-06 - Rebrand Before Launch

- Decision: Do not launch publicly as `OnSkin` unless counsel gives strong written clearance.
- Alternatives: keep name, add modifier, acquire/coordinate with incumbent, full rebrand.
- Criteria: customer confusion, App Store search, support, trademark risk, rework cost.
- Evidence: existing public OnSkin app/site in same category with scanner language and claimed 8M users/2M products.
- Risk: rebrand delays launch, but keeping name is higher risk.
- Status: Accepted.

### 2026-07-06 - Position As Shelf And Routine, Not Scanner

- Decision: The primary promise is "Add your skincare shelf. Get a routine that knows what not to mix."
- Alternatives: beauty scanner, AI skin analysis, ingredient safety app, shopping assistant.
- Criteria: differentiation, trust, daily use, subscription retention.
- Evidence: scanner competitors are crowded; repo has stronger shelf/routine/progress loop.
- Risk: users still search for scanner terms, so ASO must include them without leading with them.
- Status: Accepted.

### 2026-07-06 - Keep Full Product, Gate Public Exposure

- Decision: Keep the full feature set in code, but expose/market only reviewed production-real surfaces.
- Alternatives: cut to V1 only, launch everything, freeze advanced surfaces.
- Criteria: founder preference, safety, app review, trust.
- Evidence: existing repo already contains many surfaces and launch gates.
- Risk: feature complexity can dilute focus.
- Status: Accepted.

### 2026-07-09 - Launch Device Support Floor

- Decision: Launch support floor is iOS 17.0+ and Android 10 / API 29+; launch-blocking layout QA starts at 360 x 640 for Expo web-compatible compact-phone coverage, while 320-wide browser viewports and sub-640 browser-only heights remain stress-only unless reproduced on a supported native device or required by app review/accessibility.
- Alternatives: support Expo's lower Android 7+ default, require Android 12+, keep the earlier 320 x 480 browser floor as launch-blocking, or drop compact Android phones entirely.
- Criteria: paid consumer market reach, QA burden, current Expo SDK support, App Store/Play submission requirements, camera/photo reliability, accessibility, and launch speed.
- Evidence: Expo SDK 56 supports iOS 16.4+ and Android compile/target SDK 36; Apple and Google current submission rules require modern build SDK/target API; the repo has passing 360 x 640, 360 x 740, 375 x 667/812, 390 x 844, 412 x 915, and 430 x 932 evidence plus extensive 320-wide stress evidence.
- Risk: Android 9-or-older and iOS 16 users cannot install; users on sub-360 width or sub-640 height browser/device states may still hit polish bugs that are recorded but not launch-blocking unless real device/app-review evidence elevates them.
- Status: Accepted.

### 2026-07-09 - Fail Closed Before Unreviewed Production Builds

- Decision: Production Expo config requires `PHASE3_RELEASE_CLEARANCE=cleared`; development and staging remain available for implementation and reviewer QA.
- Alternatives: rely only on runtime content filters, reuse brand clearance, or allow production builds while Phase 3 copy/review findings remain open.
- Criteria: prevent placeholder consent copy from reaching a store artifact, preserve a practical reviewer workflow, separate brand identity approval from health/privacy/content approval, and keep the release condition auditable.
- Evidence: Phase 3 currently reports unresolved legal, privacy, clinical, chemistry, and IP findings; runtime filters already withhold unreviewed conflict, cadence, and medical-adjacent recommendation content but do not block core draft consent copy.
- Risk: production builds remain blocked until Tas obtains real named signoff against a clean exact-source-hash packet and the strict copy audit passes.
- Status: Accepted.

## Architecture Decisions

### 2026-07-06 - Keep Expo/Supabase/RevenueCat

- Decision: Continue current stack unless beta/device/compliance evidence says otherwise.
- Alternatives: native apps, Flutter, Firebase, custom backend.
- Criteria: speed, current repo fit, camera/IAP support, TypeScript reuse, RLS.
- Evidence: current implementation and docs already use Expo, Supabase, RevenueCat.
- Risk: native camera/OCR and widgets require custom build QA.
- Status: Accepted.

### 2026-07-06 - Deterministic Rules Over AI For Safety

- Decision: Conflict, pregnancy, routine sequencing, PAO, and safety guidance must be deterministic and reviewer-backed.
- Alternatives: GPT-generated guidance, cloud RAG only, broad AI advisor.
- Criteria: liability, explainability, repeatability, testability.
- Evidence: competitor AI claims are crowded; repo already gates rules with `reviewedBy`.
- Risk: slower content expansion.
- Status: Accepted.

## Stack Decisions

### 2026-07-06 - Local-First Photos And Shelf

- Decision: Keep privacy-sensitive data local by default.
- Alternatives: cloud sync first, cloud photo analysis.
- Criteria: privacy differentiation, MHMDA/privacy risk, trust.
- Evidence: repo and positioning already emphasize photos stay on device.
- Risk: multi-device sync and backup deferred.
- Status: Accepted.

## Pricing Decisions

### 2026-07-06 - Annual-First Subscription

- Decision: Test $49.99/year annual Pro with monthly anchor and no weekly plan.
- Alternatives: $29.99/year, $59.99/year, weekly subscription, one-time purchase.
- Criteria: $30k/month target, competitor pricing, retention, subscription norms.
- Evidence: HadaBuddy publicly lists $29.99/year; Think Dirty premium reported at $59.99/year; RevenueCat reports subscription conversion is unforgiving and first-session value matters.
- Risk: premium price must be justified by trust and retention.
- Status: Proposed.

### 2026-07-06 - Reverse Trial

- Decision: Use a no-card reverse trial after value, then downgrade to useful free tier.
- Alternatives: hard paywall, carded trial only, freemium only.
- Criteria: discovery-channel fit, trust, first-session value.
- Evidence: RevenueCat reports hard paywalls convert better but first-session aha is critical; this category benefits from experiencing value.
- Risk: if users do not engage during the trial, value is given away.
- Status: Proposed.
