# Launch Readiness

Date: 2026-07-09

This is the fast source of truth for what exists, what is simulated, and what
still blocks a paid public launch.

Phase 3 local governance scaffolding exists: regulatory/data/consent/store
metadata packets, structured legal/regulatory, clinical, chemistry,
privacy/security, and IP/FTO review logs, policy-link wiring, review packet
generation, and claim/gate tests. This is not legal, clinical, chemistry,
privacy, security, or IP clearance.

Phase 4 catalog scaffolding exists: catalog schema/RLS, source memos, parser and
quality logic, OBF fixture import/QA tooling, catalog lookup/search/report Edge
Functions, and mobile source/quality disclosure. This is not source/legal
clearance and not a real launch catalog.

Fresh verification through 2026-07-09:

- Production release config now fails closed on unresolved Phase 3 review.
  When either `APP_VARIANT` or `EXPO_PUBLIC_APP_ENV` is `production`, Expo
  config, `phase2:check-env`, and the dedicated Phase 3 release checker require
  exact `PHASE3_RELEASE_CLEARANCE=cleared`. Development and staging remain
  available for reviewer QA. The flag cannot bypass the reviewer artifact:
  production config also requires a clean worklist covering all five review
  domains, zero unresolved items, explicit `Approved` or `Deferred`
  dispositions with named owners and valid dates, one current detached JSON
  signoff per release disposition, and byte/SHA-256 matches for every current
  review-log, item source, and signoff file. Each signoff must match the
  recomputed item snapshot, carry a non-placeholder credential/role, decision
  conditions and satisfaction state, and retained approval reference; deferred
  items also require a structured production gate. This clearance stays
  separate from brand clearance and pending until the named reviewers finish
  the packet and `phase3:audit-copy:strict` passes. Runtime production tests
  continue to prove unreviewed conflict rules, routine cadence, and
  medical-adjacent recommendations remain hidden.
- Floating bottom tab-bar active-pill polish now has fresh headless Chrome Expo
  web geometry evidence across 320 x 568 stress width plus 360 x 640,
  375 x 667, 390 x 844, 412 x 915, and 430 x 932 supported-phone viewports.
  The app renders Today, compact visible `Prog.`, Shelf, and You labels through
  the 430 px compact-phone band, keeps the active capsule inset instead of
  filling a whole tab slot, and preserves the full `Progress tab` accessibility
  label. The full geometry pass verifies 66 px pill height, 54 px tab targets,
  exactly one selected tab per routed tab state, direct one-line labels, center
  hit-tests, zero horizontal overflow, and only expected local placeholder
  warnings. A focused 412 x 915 / 200% pressure recheck confirms the route-wide
  synthetic pressure audit leaves tab labels to the dedicated tab-bar harness.
  Evidence:
  `test-results/human-e2e/2026-07-09/navigation-tabbar-supported-polish-postfix2/`
  and
  `test-results/human-e2e/2026-07-09/tabbar-polish-412-pressure-postfix2/`.
- Shelf catalog wrong-match recovery now has fresh headless Chrome Expo web
  evidence before product add. With
  `EXPO_PUBLIC_E2E_CATALOG_SEARCH_RESULT=wrong_match`, catalog search exposes
  distinct 48 px `Use this match` and `Not this product` actions, reports a
  wrong match with product/source-only context, renders inline `Report not
sent` feedback with no dialog when catalog reporting is unavailable, and
  preserves the search query through manual add. A 360 x 640 support-floor spot
  check keeps Back, Search, Use this match, Not this product, and Add by hand
  visible, 48 px+, center-hit-testable, and at zero horizontal overflow.
  Evidence:
  `test-results/human-e2e/2026-07-09/catalog-search-wrong-match-current/`.
- Shelf catalog no-match recovery now has fresh Codex in-app browser Expo web
  evidence for privacy-safe missing-product reporting. At 390 x 844, catalog
  search no-match exposes a 48 px `Report missing product` action, renders
  inline `Report not sent` feedback with no JavaScript dialog or current-route
  warn/error logs, and preserves the missing query through manual add. Direct
  `/shelf/no-match?barcode=012345678905` exposes distinct Search, Scan, Add by
  hand, and Report controls with no overlap, then routes to manual add. 360 x
  640 support-floor spot checks keep visible controls 48 px+, fully visible,
  center-hit-testable, and at zero horizontal overflow. Evidence:
  `test-results/human-e2e/2026-07-09/catalog-missing-product-report-current/`.
- The human-simulated E2E manifest now anchors to the 2026-07-09 Expo web
  support-floor evidence. The 360 x 640 launch-floor 200% text-pressure sweep
  passed 49 / 49 routes with zero failed routes, and the supported-phone
  360 x 740, 375 x 812, 390 x 844, 412 x 915, and 430 x 932 200%
  text-pressure sweeps also passed 49 / 49 routes with zero failed routes.
  Evidence:
  `test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix/`,
  `test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-postfix/`,
  `test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/`,
  `test-results/human-e2e/2026-07-09/text-pressure-200-modern-390-postfix-7/`,
  `test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-postfix2/`,
  and
  `test-results/human-e2e/2026-07-09/text-pressure-200-modern-430-postfix-5/`.
- The 414 x 896 / 200% boundary sweep also passed 49 / 49 routes after the
  contextual ProGate, Recommendation Preferences, and entitlement-loading
  harness fixes. Evidence:
  `test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-postfix3/`.
- Native config now pins the install floor and build target posture separately:
  iOS deployment stays at 17.0+, Android min SDK stays at API 29, and Android
  compile/target SDK are pinned to API 36 by `app.base.json`,
  `appConfig.test.ts`, and `phase5:check-native-config`.
- A retained 320-wide stress Expo web route audit after the native support-floor
  config contract plus direct-entry density guards for Ask, Community,
  Recommendation detail, Settings, and Shelf recovery passed 49 / 49 routes at
  320 x 480 with zero failed routes, zero clipped visible controls, zero blocked
  center hit-tests, and zero unexpected browser logs. Evidence:
  `test-results/human-e2e/2026-07-09/support-floor-480-config-spacing-guard/`.
- A focused 430 x 640 / 200% support-band pass now covers the direct-entry
  onboarding and downgrade paywall routes omitted from the earlier 430-wide
  route sweep. `/onboarding/age`, `/onboarding/goals`,
  `/onboarding/products`, `/onboarding/paywall`, and `/paywall/downgrade`
  report zero failed routes, zero clipped visible controls, zero sub-44 visible
  controls, zero blocked center hit-tests, zero horizontal overflow, and zero
  disallowed browser logs. Evidence:
  `test-results/human-e2e/2026-07-09/text-pressure-200-onboarding-paywall-430-640-current/`.
- Settings Privacy direct entries and contextual Progress paywalls have fresh
  2026-07-09 browser evidence for the Terms-row support-floor spacer, compact
  tall-phone paywall compliance header, and compact visible Explore-first copy
  with the full reverse-trial copy retained in the accessibility label.
  Evidence:
  `test-results/human-e2e/2026-07-09/settings-privacy-terms-support-floor-current/`
  and
  `test-results/human-e2e/2026-07-09/progate-tall-phone-header-current/`.
- Phase 9 dependency/SBOM evidence was refreshed with `npm audit` metadata:
  the generated inventory records 1073 packages and zero npm vulnerabilities.
  Strict release completion still needs the release-owner
  `PHASE9_DEPENDENCY_AUDIT_PASS=true` signoff.

- Codex in-app browser Expo web at 320 x 568 verified the new
  `cycle_night_completed` Today PM instrumentation path through the real UI:
  manual Shelf seed for `Retinol 0.3% Night Serum`, `Glycolic 7% Toner`, and
  `Mineral SPF 50`; generated routine plan with PM skin cycling; direct
  `/today?routine=PM`; and Night 1 `Glycolic 7% Toner` check-off from `0 of 1`
  to `1 of 1` with zero horizontal overflow. Source tests and Phase 7/10 gates
  verify the event only fires after the final active PM cycle-night check-off
  and uses the privacy-safe payload `{ moment: 'pm', source: 'today' }`.
  Evidence:
  `test-results/human-e2e/2026-07-08/today-cycle-completion-analytics-current/`.
- A follow-up 320 x 568 pass rechecked Shelf product detail after the More
  options glyph and lifecycle-dock polish: the control remains an accessible
  48 x 48 `More options` button, the best-before row becomes fully reachable by
  scroll instead of sitting under the action dock, the named `Remove from shelf?`
  dialog keeps lifecycle choices 48 px+, horizontal overflow is zero, and no
  current-origin browser warn/error logs were recorded. Evidence:
  `test-results/human-e2e/2026-07-08/shelf-detail-more-options-glyph-current/`.
- Codex in-app browser Expo web at 320 x 390 rechecked the first-run
  `/onboarding/goals` split-short layout after the previous 320 x 480 compact
  pass. Clear skin, Even tone, Hydration, Fine lines, Sensitivity, Barrier
  repair, and Continue are now fully visible, 56-60 px tall, unclipped,
  center-hit-testable, and at zero horizontal overflow; tapping the formerly
  blocked Sensitivity card enables Continue and advances to health-data consent.
  Evidence:
  `test-results/human-e2e/2026-07-08/onboarding-first-session-390-current/`.
- Codex in-app browser Expo web at 320 x 480 rechecked the compact
  photo-progress contextual paywall after a dev-only local reset. `/progress`,
  `/progress/capture`, and `/progress/review` keep Terms, Privacy, Restore,
  Maybe later, Start free trial, and Explore first present, 48 px or larger,
  unclipped, center-hit-testable, and at zero horizontal overflow; tapping
  `/progress/review` `Maybe later` dismisses to `/progress`. Evidence is in
  `test-results/human-e2e/2026-07-08/progress-photo-paywall-header-compliance-current/`.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 172 mobile test files / 1782 tests.
- `npm run launch:verify` is the root non-mutating readiness sweep for source
  changes that should not rebuild packets. It runs the source-packet,
  Tas-owned blocker, readiness-status, strict brand, device-support-policy,
  generated-packet, and human-E2E manifest checks; the Phase 5 native config
  guard; the Phase 7 core-loop and Phase 8 growth/store code gates; Phase 9
  release smoke, Phase 10 beta readiness, the Phase 10 beta analytics audit,
  Phase 11 launch readiness, and launch ring gates; then typecheck, lint, and
  tests.
- `npm run docs:device-support-policy-audit:check` passed as the
  non-mutating guard that keeps the V1 cutoff explicit: iOS 17.0+, Android 10 /
  API 29+, Android compile/target API 36, 360 x 640 as the launch-blocking Expo
  web layout floor, and 320-wide browser evidence as stress/resilience only.
- `npm run docs:performance-readiness-audit:check` passed as the non-mutating
  guard that keeps performance readiness visible without faking benchmark
  evidence. The contract requires app startup time, product add time, barcode
  lookup latency, routine generation time, local photo loading, and memory use
  in photo timeline to be measured on supported physical devices or beta
  telemetry before closed-beta/public-launch signoff.
- `npm run phase5:performance-evidence:template:check` pins the blocked JSON
  schema, while `PHASE5_PERFORMANCE_EVIDENCE_PATH=... npm run
phase5:performance-evidence:strict` rejects unsupported devices, post-hoc
  thresholds, missing/invalid raw samples, hand-entered summaries that differ
  from calculated nearest-rank p50/p95/max, failed p95 targets, photo-timeline
  crashes or OS terminations, and placeholder signoffs. Real evidence is still
  absent.
- `npm run phase5:check-native-config` passed as the non-mutating native config
  guard for the same OS support and Android build-target posture.
- `npm --workspace apps/mobile run typecheck` passed.
- `npm --workspace apps/mobile run lint` passed.
- `npm --workspace apps/mobile run test` passed: 172 test files / 1782 tests.
- `npm run format:check` passed across maintained source, scripts, configs, and
  documentation. Generated evidence packets remain governed by their dedicated
  schema/freshness/hash audits, and generated Supabase database types remain
  governed by regeneration plus typecheck.
- `npm run phase3:verify`, `npm run phase4:verify`,
  `npm run phase5:verify`, `npm run phase6:verify`,
  `npm run phase7:verify`, `npm run phase8:verify`,
  `npm run phase9:verify`, and `npm run phase10-11:verify` passed
  non-strict local code gates. Strict readiness remains blocked by the external
  evidence called out below.
- `npm run phase2:check-env-smoke` passed. `npm run phase2:check-env` and
  `npm run phase2:rls-smoke` still fail without Tas-owned final environment
  values and live Supabase credentials, which is expected until production
  account setup is complete.
- `npm run docs:source-packet-audit:strict` passed and wrote
  `docs/generated/source-packet-audit.{json,md}`. The audit now inventories all
  12 files under `04_repo_docs`, verifies the expected top-level packet files
  are present, verifies all 10 `04_repo_docs/docs/*.md` strategy-packet docs
  have active `docs/` mirrors, verifies all 10 mirrors are byte-identical, and
  verifies all mirrored packet docs are referenced by the root source-of-truth
  lists in `AGENTS.md` or `CLAUDE.md`.
- `npm run docs:source-packet-audit:check` passed as the non-mutating freshness
  gate for the committed source-packet audit.
- `npm run docs:tas-todo-audit:strict` passed and wrote
  `docs/generated/tas-todo-audit.{json,md}`. The audit verifies
  `docs/FOR_TAS_TO_DO.md` still covers the Phase 2-11 Tas-owned launch
  evidence gate groups and records the exact machine-extracted key inventory
  from phase scripts and `.env.example`.
- `npm run docs:tas-todo-audit:check` passed as the non-mutating freshness gate
  for the committed Tas-owned evidence inventory.
- `npm run brand:audit:strict` is now part of `npm run launch:verify`, so the
  root readiness sweep fails if public launch-risk or review-needed legacy brand
  references return.
- `npm run phase10:beta-analytics-audit` is now part of
  `npm run launch:verify`, so the root readiness sweep fails if the beta event
  schema, analytics allowlist, runtime `track(...)` calls, or privacy-safe
  property registry drift away from the closed-beta metrics contract.
- `npm run phase7:check-core-loop` and
  `npm run phase8:check-growth-store` are now part of
  `npm run launch:verify`, so the root readiness sweep fails if core-loop
  analytics, deferred surface gates, public link handling, review prompts,
  share-card telemetry, store-support copy, or growth/store guard rails drift
  away from the launch contracts.
- `npm run docs:generated-packet-status-audit:check` passed as the
  non-mutating guard that committed generated phase packets do not record a
  dirty Git worktree, dirty-packet warning text, or stale recorded source/file
  hash.
- `npm run e2e:human:manifest` passed and wrote
  `docs/e2e/generated/human-e2e-manifest.{json,md}`. The manifest verifies the
  committed local Expo web evidence for the 2026-07-09 360 x 640
  launch-floor 200% text-pressure sweep and records 360 x 740, 375 x 812,
  390 x 844, 412 x 915, and 430 x 932 supported-phone 200% text-pressure sweep
  evidence.
  It does not replace physical iOS/Android
  device QA, native keyboard/text-scale/accessibility checks, RevenueCat,
  StoreKit/Play Billing, or live Supabase release gates. The support contract
  is defined in `docs/DEVICE_SUPPORT_POLICY.md`.
- `npm run e2e:human:manifest:check` passed as the non-mutating local human-E2E
  evidence freshness gate.
- `npm run phase7:verify` passed non-strict core-loop code gates and refreshed
  `docs/phase-7/generated/core-loop-qa-packet.*` for the current Today and
  Progress route hashes. Strict Phase 7 remains blocked by missing final
  identity/policy URLs, live Supabase/RLS, clinical/reviewer, catalog,
  physical-device, RevenueCat, privacy export/delete, beta dashboard, and named
  signoff evidence.
- `npm run phase8:verify` passed non-strict growth/store code gates and
  refreshed `docs/phase-8/generated/growth-store-qa-packet.*` for the current
  share-card and conflict-share route hashes. Strict Phase 8 remains blocked by
  missing final identity/domain, marketing/support/store URLs, DNS,
  Universal/App Links, share-card device QA, attribution privacy, store packet,
  creator/support/dashboard/dry-run, Apple Team ID, Android release
  certificate, and named signoff evidence.
- `npm run phase5:verify` passed non-strict native-build/device-QA code gates
  and refreshed `docs/phase-5/generated/device-qa-packet.*` for the current
  native support-floor and progress capture route hashes. The local native
  config guard keeps iOS at 17.0+, Android min SDK at API 29, and Android
  compile/target SDK at API 36. Strict Phase 5 remains blocked by missing EAS
  iOS/Android build IDs, physical-device matrix evidence, native
  camera/photo/notification/share/RevenueCat/Sentry QA, and named tester
  signoff evidence.
- `npm run brand:audit:strict` passed with 0 public launch-risk and 0
  review-needed hits.
- `npm run phase9:verify` passed non-strict release-engineering code gates
  after the privacy payload audit was aligned to the route-owned
  progress-photo share confirmation. Strict Phase 9 remains blocked by missing
  final identity, live Supabase/Edge/RevenueCat/store/native-build,
  observability, dependency, beta, and named-signoff evidence.
- `npm run phase10-11:verify` passed non-strict code gates. Strict closed-beta
  and public-launch readiness remain blocked by missing final identity URLs,
  TestFlight/Play evidence, RevenueCat production evidence, monitoring/support
  proof, beta/launch reports, and named signoffs.
- Expo web `/settings/beta-feedback` evidence at 390 x 844 covers the local
  beta feedback handoff: the You tab row opens the route, fixed category and
  P0-P3 priority selections enable `Open support`, forced external-open failure
  renders inline support-unavailable recovery with no JavaScript dialog, there
  are no free-text inputs, horizontal overflow is zero, visible controls are
  48 px+, current-origin browser warn/error logs are clean, and Back returns to
  `/you`. Evidence:
  `test-results/human-e2e/2026-07-09/settings-beta-feedback-current/`. Live
  support desk category/SLA routing and native iOS/Android external handoff
  remain Phase 10 blockers.
- Expo web `/settings/beta-feedback` compact-height evidence at 390 x 640
  confirms the compact high-text-pressure chrome uses `Category and priority
only`, hides the longer explanatory paragraph, keeps fixed category/severity
  rows at support-floor spacing, category + priority selection still enables
  `Open support`, the unavailable support handoff recovers inline without a
  JavaScript dialog, the compact recovery copy does not push the support CTA
  below the viewport, there are no free-text inputs, horizontal overflow is
  zero, and current-origin warn/error logs are clean. Evidence:
  `test-results/human-e2e/2026-07-09/settings-beta-feedback-compact-floor-current/`.
- Expo web 320 x 480 current-main route rerun passed 49 direct-entry routes
  with zero failed routes, zero visible clipped controls, zero sub-44
  user-facing controls, zero blocked hit-tests, zero horizontal overflow, and
  zero disallowed browser logs. Evidence:
  `test-results/human-e2e/2026-07-08/current-main-short-phone-480-rerun/`.
- Expo web `/progress` contextual ProGate evidence at 320 x 430 passed the
  ultra-short paywall gate: Terms, Privacy, Restore, Maybe later, Start free
  trial, and Explore first are visible and 48 px, with zero clipped controls,
  zero blocked center hit-tests, zero horizontal overflow, and zero unexpected
  warn/error logs. Tapping Explore first unlocks the Progress photo surface
  without store checkout. Evidence:
  `test-results/human-e2e/2026-07-08/progress-progate-short-phone-430-clearance/`.
- Expo web `/progress*` contextual ProGate evidence at 320 x 568 now covers the
  text-pressure/tabbar overlap caught by the 118% audit. Compact Progress photo
  paywalls use header compliance, and `/progress`, `/progress/capture`, and
  `/progress/review` keep Terms, Privacy, Restore, Maybe later, Start free
  trial, and Explore first visible, 48 px+, unclipped, and center-hit-testable
  above the floating tab bar. Evidence:
  `test-results/human-e2e/2026-07-08/text-scale-120-compact-audit/`,
  `test-results/human-e2e/2026-07-08/progress-progate-text-pressure-postfix/`.
  Native iOS/Android Dynamic Type remains part of device QA.
- Expo web personalized recommendations evidence at 320 x 430 passed the
  ultra-short hub/preferences gate: `/recommendations` and
  `/recommendations/preferences` have zero clipped controls, zero sub-44
  controls, zero blocked center hit-tests, zero unexpected warn/error logs, and
  the `Sustainable` chip remains tappable. Evidence:
  `test-results/human-e2e/2026-07-08/recommendations-ultrashort-430-current/`.
- Expo web 320 x 430 final clearance passed the remaining ultra-short routes:
  `/community`, `/settings/subscription`, `/settings/notifications`, and
  `/shelf/opened` now have zero clipped controls, zero sub-44 controls, zero
  blocked center hit-tests, and zero disallowed browser logs. The same run
  verifies user-like taps on the formerly failing Skin Note, Restore purchases,
  Replenishment, and Add product by hand controls. A fresh 49-route 320 x 430
  sweep now reports zero failed routes. Evidence:
  `test-results/human-e2e/2026-07-08/remaining-short-phone-430-clearance/`,
  `test-results/human-e2e/2026-07-08/current-main-short-phone-430-final-clearance-sweep/`.
- The 320 x 430 evidence above is retained as resilience/stress proof. The
  launch-blocking web viewport floor is now 360 x 640; 320-wide evidence remains
  stress proof unless a supported native device or app-review requirement
  reproduces the smaller-width or smaller-height issue.
- Expo web 320 x 390 split-short stress clearance passed the current 49-route
  direct-entry sweep with zero failed routes, zero clipped controls, and zero
  blocked hit-tests after tightening Ask, Shelf, contextual paywall,
  Recommendations, Skin Notes, and notification layouts below 410 px. The
  focused pass also verifies 10 user-like taps across the affected controls.
  Evidence:
  `test-results/human-e2e/2026-07-08/split-short-phone-390-clearance/`,
  `test-results/human-e2e/2026-07-08/current-main-split-short-phone-390-sweep-postfix/`.
- Expo web Shelf manual category picker evidence at 320 x 480 and 320 x 568
  passed the named bottom-sheet, lower-option scroll, 52 px category row,
  `Other` selection, `/shelf/opened` continuation, horizontal-overflow, and
  browser-log checks. Additional 320 x 440 / 320 x 430 Shelf intake evidence
  verifies manual add, fully visible lower category selection, OCR
  capture-failure/manual-text continuation, labeled no-match fallbacks, and
  `/shelf/manual` recovery with zero current-origin warn/error logs. Evidence:
  `test-results/human-e2e/2026-07-08/shelf-manual-category-sheet-current/`,
  `test-results/human-e2e/2026-07-08/shelf-ultrashort-manual-ocr-current/`.
- Expo web clean first-session activation evidence has a current maintained
  2026-07-09 pass at 320 x 430 stress size using the dev-only local reset
  fixture. The run covers onboarding, three-product shelf intake with retinol,
  glycolic, and SPF, the shelf-derived first insight, no-card paywall
  exploration, generated routine plan, `Start today`, Today AM SPF checkoff,
  and Today PM Night 1 glycolic checkoff. This remains below the launch web
  support floor, but it proves the first-session value loop through a real app
  surface. Evidence:
  `test-results/human-e2e/2026-07-09/onboarding-first-session-430-current/`.

Re-run the relevant checks after any production-readiness change.

## Launch Gates

1. RoutineKind is the working local/native identity, but legal clearance,
   domain/store reservation, and production identity evidence are unresolved.
   Existing public `OnSkin` surfaces remain a direct customer-confusion and
   trademark risk if the app reverts to the legacy name.
2. Supabase project is not live, migrations are not applied to production, and
   RLS has not been tested with real users.
3. RevenueCat is not live; purchases, restore, renewal, refunds, and webhook
   entitlement sync are not production-real.
4. Apple Developer and Google Play Console apps are not verified under a
   counsel-cleared brand/package identity.
5. Clinical review is not complete for conflict rules, routine guidance, PAO
   defaults, recommendations, Skin Notes, and Ask copy.
6. Legal/privacy copy is not final for terms, privacy, consumer health data,
   subscription, commerce, photo, community, and AI/Ask consents.
7. Real product and ingredient catalog seed is not imported; source/license
   review, ODbL posture, curated batch, and beta coverage are not complete.
8. Native camera, barcode, guided photo capture, and encrypted local photo file
   storage are implemented in repo but not verified in a custom dev build;
   native OCR remains gated off.
9. Native notification delivery and Android 14+ behavior are not verified on
   physical devices.
10. Performance baseline and scale evidence are not measured on supported
    physical devices or beta telemetry.
11. Closed beta has not proven activation, retention, catalog usefulness, and
    willingness to pay.

## Readiness Table

| Area                           | Status                    | Production risk                                                                                                                                                                                                 | Owner                                           | Next action                                                                                                                                        | Exit criteria                                                                                                                              |
| ------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Brand and app identity         | launch-blocked            | RoutineKind defaults reduce the legacy `OnSkin` conflict, but the candidate is not counsel-cleared or reserved                                                                                                  | Founder + trademark counsel                     | Clear or reject `RoutineKind`; reserve final domain/store/package IDs and provide production identity evidence                                     | Written clearance, final domain, final bundle/package IDs, and store/domain reservation evidence                                           |
| Architecture and app shell     | implemented               | Dev foundation exists, but release build not verified                                                                                                                                                           | Engineering                                     | Keep typecheck/lint/test green                                                                                                                     | Release candidate builds on iOS and Android                                                                                                |
| Auth and onboarding foundation | stubbed                   | Account linking, Turnstile, final quiz/legal copy not production-verified                                                                                                                                       | Engineering + counsel                           | Configure live auth providers after brand decision                                                                                                 | Anonymous, Apple, Google, deletion, and export flows pass live QA                                                                          |
| Supabase backend               | stubbed                   | Local migrations, deploy wrapper, and RLS smoke script exist; no live project/RLS adversarial pass                                                                                                              | Engineering                                     | Create staging/production Supabase projects, run `phase2:check-env:strict`, deploy staging, then run `phase2:rls-smoke`                            | Two-user RLS test, Edge Functions deployed, advisors clean or accepted                                                                     |
| Ingredient conflict engine     | launch-blocked            | Deterministic logic exists; unreviewed guidance could be unsafe or misleading                                                                                                                                   | Dermatologist + cosmetic chemist + engineering  | Clinical review and reviewed-content gating                                                                                                        | Only reviewed rules exposed by production gates                                                                                            |
| Smart Shelf manual flows       | implemented               | Local-first manual/no-match flows are useful; no real catalog match rate yet                                                                                                                                    | Engineering                                     | Keep manual fallback honest while catalog imports are built                                                                                        | Beta users can add real products even when scans miss                                                                                      |
| Barcode/OCR shelf intake       | needs-device-verification | Live barcode camera path and editable label-capture path exist; native OCR is intentionally disabled until ML Kit/Vision QA                                                                                     | Engineering                                     | Run barcode device matrix, then add/review on-device OCR if it remains a launch claim                                                              | Barcode match rate tracked; OCR claim hidden unless real OCR passes beta labels                                                            |
| Product catalog                | launch-blocked            | Phase 4 schema/API/parser/source disclosure exists, but no source-cleared launch catalog or beta coverage yet                                                                                                   | Engineering + founder + counsel                 | Clear OBF/CosIng/ODbL posture, run export-based imports, curate beta-driven launch batch, review QA                                                | Meaningful beta scan match rate, attribution obligations satisfied, only eligible products drive recs                                      |
| Routine builder and scheduler  | implemented               | Local deterministic generation exists; Expo web first-session shelf -> visible insight -> routine -> check-off evidence exists; V1 uses tap-based reorder controls and does not claim cross-device routine sync | Engineering + clinical reviewers                | Review rules; verify native-device routine loop; keep true drag gestures and server persistence deferred unless they become launch claims          | Users can generate, follow, adapt, and recover routines without fake claims                                                                |
| Today check-off and streaks    | implemented               | Local-first loop exists; Expo web reload persistence evidence exists; device notification and server sync still need QA                                                                                         | Engineering                                     | Verify native-device persistence, notification opens, and eventual server sync                                                                     | Day-level check-off and streak behavior remain correct across reinstall/upgrade                                                            |
| Guided photo progress          | needs-device-verification | Front-camera still capture and encrypted local file storage exist; face/pose signals are coarse preview estimates                                                                                               | Engineering + privacy counsel                   | Run physical-device capture/encryption/restart/delete QA; add reviewed face/pose module before precise framing claims                              | Physical-device capture passes lighting/framing/local-only tests                                                                           |
| Reminders                      | needs-device-verification | Scheduling code exists; physical iOS/Android delivery not verified                                                                                                                                              | Engineering                                     | Device QA on iOS latest, older iOS, Android latest, Android 14+                                                                                    | Quiet hours, timezone changes, reinstall, and notification copy pass                                                                       |
| Performance readiness          | needs-device-verification | Local code gates exist, but startup, product-add, barcode, routine-generation, local-photo-loading, and photo-timeline memory baselines need real-device or beta telemetry                                      | Engineering + founder                           | Measure app startup time, product add time, barcode lookup latency, routine generation time, local photo loading, and memory use in photo timeline | Named performance signoff with build IDs, supported devices, p50/p95 or equivalent timing summary, memory summary, and accepted thresholds |
| Widgets and live activities    | inert                     | In-app previews exist; native WidgetKit/Glance/ActivityKit not built                                                                                                                                            | Engineering                                     | Keep post-launch unless native build is funded                                                                                                     | Removed from launch claims or implemented and device-verified                                                                              |
| Paywall and entitlement UI     | stubbed                   | Screens/gates and guarded RevenueCat SDK wiring exist; native products/restores are not verified                                                                                                                | Engineering + founder                           | Configure RevenueCat after brand/account setup and test in custom dev builds                                                                       | Purchase, restore, refund, expiry, renewal, and webhook matrix passes                                                                      |
| Recommendations                | launch-blocked            | Type-first engine exists; real products and goal-active recs need catalog/review                                                                                                                                | Clinical reviewers + engineering                | Seed catalog and review goal-active recommendation types                                                                                           | Recommendation claims are reviewed and commerce-independent                                                                                |
| Commerce/affiliate             | inert                     | Consent, disclosure, and attribution scaffolds exist; no live rail                                                                                                                                              | Founder + counsel + engineering                 | Decide launch vs post-launch; resolve ShopMy or alternative                                                                                        | If launch: rail, consent, FTC disclosure, and order reports work; else hidden                                                              |
| Community/Skin Notes           | launch-blocked            | Expert read-mostly scaffold exists; peer posting needs moderation and legal floor                                                                                                                               | Founder + clinical reviewers + moderation owner | Recruit experts and define moderation operations                                                                                                   | No open UGC until report/block/contact/EULA/human moderation are live                                                                      |
| Trend analysis                 | launch-blocked            | No-score posture and deferred route recovery are correct; real CV/fairness/legal review absent                                                                                                                  | Engineering + counsel + fairness reviewer       | Keep as post-launch unless validation is funded                                                                                                    | No score/age/percentage claims; fairness and legal signoff complete                                                                        |
| Ask assistant                  | launch-blocked            | Deterministic local advisor exists; cloud Ask is deferred                                                                                                                                                       | Engineering + counsel + clinical reviewers      | Keep deterministic; do not launch cloud RAG until vendor/safety/legal gates pass                                                                   | Grounded, bounded answers; no unreviewed medical claims                                                                                    |
| Growth share card              | needs-device-verification | Card and export path exist; final domain/store fallback/attribution blocked by final identity and device QA                                                                                                     | Engineering + founder                           | Final identity/domain and universal link                                                                                                           | Shared card opens app or web fallback and tracks attribution                                                                               |
| Analytics/crash reporting      | stubbed                   | PostHog/Sentry runtime wiring exists; projects, source maps, dashboards, deletion, and privacy review not live                                                                                                  | Engineering + founder                           | Configure after brand/account setup                                                                                                                | Production dashboards, deletion, source maps, and crash privacy review pass                                                                |
| Policies/support/deletion      | launch-blocked            | Copy and functions are not final/live                                                                                                                                                                           | Counsel + engineering                           | Finalize policy URLs and deploy account deletion/export                                                                                            | Store listing URLs work; deletion/export verified against live backend                                                                     |
| Phase 3 signoff packet         | launch-blocked            | Exact-source packets, item snapshot digests, detached-signoff schema, and production gates exist; professional signoffs are absent                                                                              | Founder + counsel + clinical reviewers          | Run review packet, verify reviewer credentials, retain original approvals, and add one current detached signoff per released item                  | Counsel, dermatologist, cosmetic chemist, privacy, and IP decisions pass the machine gate against exact reviewed source hashes             |
| Closed beta                    | launch-blocked            | No real cohort metrics yet                                                                                                                                                                                      | Founder + engineering                           | Recruit 50-100 users for V1 loop                                                                                                                   | Activation, D7/D14/D30 retention, trial starts, and willingness-to-pay measured                                                            |

## Practical V1

The V1 that can plausibly earn paid subscribers is narrow:

- onboarding with age gate and health/privacy consent
- shelf intake with manual fallback
- conflict detection for real owned products
- routine builder and Today check-off
- baseline photo timeline
- local reminders
- paywall and privacy controls
- shareable conflict card after final brand/domain

Everything else should serve this loop or remain post-launch.

## Owner Map

| Blocker                  | Owner                                      |
| ------------------------ | ------------------------------------------ |
| Final identity clearance | Founder + trademark counsel                |
| Supabase                 | Engineering                                |
| RevenueCat               | Engineering + founder account owner        |
| Apple/Google accounts    | Founder                                    |
| Clinical review          | Founder + dermatologist + cosmetic chemist |
| Legal/privacy copy       | Founder + privacy/app counsel              |
| Catalog seed             | Engineering                                |
| Native camera/OCR/photos | Engineering                                |
| Device notification QA   | Engineering                                |
| Commerce rail            | Founder + counsel + engineering            |
| Community moderation     | Founder + moderation owner                 |
| Store listing and ASO    | Founder + design/marketing                 |
| Closed beta              | Founder + engineering                      |

## Completion Rule

Do not call the app complete because screens exist. It is complete only when real
users can safely complete the V1 loop with real products, real payments, real
privacy controls, reviewed guidance, and measured retention.
