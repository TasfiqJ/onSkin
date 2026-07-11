# Launch Readiness

Date: 2026-07-10

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

Fresh verification through 2026-07-10:

- The required `Canonical multi-active Plan and Today consistency` gate now
  proves one product-level scheduler drives Plan, Today, cycle, and product
  detail. Supported-phone evidence at 360 x 640 and 390 x 844 covers two
  retinoids, AHA, BHA, BP in AM, two explicitly withheld undefined cadences,
  exactly one PM active, reload persistence, and responsive fixes for long
  cycles with zero final overflow, sub-44 controls, tab intersections, or
  browser errors. Evidence:
  `test-results/human-e2e/2026-07-10/multi-active-plan-today-current/`.
  Hydroquinone/copper timing and physical-device accessibility remain blocked
  on named review and native QA.
- The required `Persistent Morning and Evening routine order` gate proves
  independent product-ID AM/PM edits survive save, reopen, reload, Cancel,
  deterministic shelf recompute, Today projection, one failed write, and retry
  without changing safety exclusions or cycle-night authority. Evidence:
  `test-results/human-e2e/2026-07-10/routine-order-persistence-current/`.
- The required `Pregnancy-safety status and routine exclusion consistency`
  gate proves all encrypted status choices, consent/profile retry, legacy
  consent regrant, missing-profile caution, prefer-not reload, and explicit
  clear restoration keep Plan and Today aligned. Evidence:
  `test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/`.
- Account transitions now isolate memory and persisted private data before the
  next identity can render. The root unmounts Offline Sync, app lock, private
  storage, and every route during cleanup; a domain-separated hash detects a
  cold-start owner mismatch or a signed-out restore that retained an owner without
  storing a raw Supabase user ID. Rapid auth events serialize, and session-restore
  failure remains gated and retryable. While gated, new private-record and
  encrypted-photo writes are blocked; private reads/removals and photo marker writes
  also drain. Explicit sign-out removes the encrypted persisted Supabase session,
  and a cleanup-required marker survives partial deletion so retry cannot publish a
  new owner over residual data. Native file, key, notification, and vendor cleanup
  failures stay closed; account deletion reuses this one root boundary. In-memory
  TanStack Query is cancelled and cleared before and after persisted cleanup,
  and the next owner/session is published only after cleanup succeeds. Failure
  remains behind a retryable 56 px gate instead of exposing either account.
  Same-user refreshes and anonymous in-place upgrades preserve data. The
  required `360 x 640 account-transition isolation and cleanup recovery pass`
  populates account A through AM/PM check-offs, forces one cleanup failure,
  retries, and proves signed-out Welcome plus direct Shelf/Today contain none of
  account A's product names with zero overflow or disallowed logs. Evidence:
  `test-results/human-e2e/2026-07-10/onboarding-account-isolation-current/`.
  Live Supabase sign-out, token-expiry, cold-start mismatch, and A-to-B proof
  remain staging/device QA.
- Anonymous account upgrades now preserve the active Supabase user ID instead
  of calling user-switching sign-in at the onboarding value moment. Native
  Apple/Google tokens use explicit identity linking; email uses same-session
  update plus `email_change` OTP or immediate same-user completion when the
  project auto-confirms. Conflicts never fall back to normal sign-in. Focused
  contracts cover ID mismatch, incomplete conversion, stale sessions, existing
  identities/emails, auto-confirm, and returning-user paths. Supported-floor
  Expo web proves invalid-code recovery through AM/PM activation with zero
  captured geometry failures in the
  `360 x 640 account-upgrade error and recovery pass` at
  `test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current/`; live
  provider/email behavior remains `B-VERIFY-AUTH-LINKING`.
- Encrypted Progress read failure is now a blocked privacy state, never a valid
  empty or missing-photo state. After entitlement and any configured biometric
  gates, the Progress tab, capture, review, and detail remain unmounted until
  one encrypted metadata query succeeds. Persistent failure keeps a 56 px real
  reread action and at least 50 px direct-route escape; retry success reveals
  the intended route without replacing ciphertext or exposing raw errors. The
  required `Progress encrypted-storage recovery` E2E gate passes all eight
  route/viewport checks at 360 x 640 and 390 x 844 plus direct-review one-shot
  recovery, with zero false-state leaks, overflow, dialogs, page errors,
  unexpected errors, analytics, or photo-backend requests. Evidence:
  `test-results/human-e2e/2026-07-10/progress-storage-recovery-current/`.
- Opt-in app lock now covers every sensitive Progress entry instead of only the
  tab component. The encrypted preference resolves before app-tree mount and
  fails closed as locked; the app-wide prompt finishes before the separate
  photo-timeline prompt; one provider-owned timeline unlock carries across the
  Progress tab, capture, review, and detail only while the app remains active.
  Background/inactive state clears it. The gate remains inside Pro entitlement
  checks, so free direct entries still see the contextual paywall first. The
  required `Progress direct-route app-lock coverage` E2E gate passes all eight
  360 x 640 / 390 x 844 direct-route checks plus one-session navigation and
  background relock, with no sensitive marker leak, overflow, dialogs, page
  errors, unexpected errors, analytics, or photo-backend requests. Evidence:
  `test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/`.
- Encrypted local stores now fail closed instead of deleting or replacing data
  when native key material is temporarily unavailable, missing, malformed, or
  unable to authenticate an envelope. Native key writes remain SecureStore-only;
  Expo web and legacy native-key migration are explicit. Exact failed-read
  snapshots block fallback overwrites, every existing private envelope is
  checked before first-key creation, and concurrent first writes share one key.
  Progress decryption is read-only with respect to key material, requires
  durable prior-key metadata before writes, detects legacy encrypted files, and
  propagates key failures without normalizing notes/photo metadata to empty.
  Focused verification passes 70/70 and the full suite passes 179 files / 1851
  tests. Genuine key loss remains unrecoverable without the intentionally
  unavailable cloud backup/key escrow; physical iOS/Android staging evidence is
  still required.
- Account export now composes both data authorities instead of assuming every
  local-first write reached Supabase. A schema-versioned mobile wrapper requires
  and validates owner-scoped server data when configured, labels backend-free
  device-only output explicitly, and batch-reads every registered encrypted
  local private record. It includes device-authoritative profile, shelf,
  cycle/ramp, completion, preference, and sanitized Progress metadata/note
  records while removing image/thumbnail bytes, device paths, note ciphertext,
  keys, credentials, and temporary cache material. Configured server failures
  abort before a partial file is written. The 360 x 640 and 390 x 844 Expo web
  pass shows the full combined disclosure, 56 px actions, inline raw-error-free
  recovery, and zero dialogs, overflow, unexpected logs, analytics, or Edge
  requests. Manifest gates: `Account export local-photo scope disclosure` and
  `Combined account and current-device export`. Evidence:
  `test-results/human-e2e/2026-07-10/data-export-local-photo-disclosure-current/`
  and `test-results/human-e2e/2026-07-10/data-export-combined-device-current/`.
- Progress photo backup now fails closed at the capability boundary. The prior
  toggle could save consent and mirror coarse metadata but did not upload,
  restore, or remotely delete encrypted photo bytes. Current local photo saves
  perform no automatic Supabase insert, startup removes stale local backup
  enablement, no runtime setter or opt-in analytics emitter remains, and
  Settings plus locked Progress show device-only storage without an actionable
  backup control. `photo_cloud_backup` remains reserved future scaffolding, not
  a shipped feature. Manifest gate: `Device-only Progress photo storage`.
  Evidence:
  `test-results/human-e2e/2026-07-10/progress-device-only-backup-current/`.
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
- The Phase 3 operator workflow now has an item-specific signoff-template CLI.
  It lists exact IDs/digests, prefills only immutable evidence, leaves all human
  assertions as fail-closed placeholders, refuses dirty or stale source,
  rejects contradictory decisions, and permits non-overwriting direct JSON
  output only under `docs/phase-3/signoffs/`. This reduces handoff error without
  claiming any professional decision exists.
- Progress capture no longer displays timer-generated camera readiness or
  quality scores. On a fresh native binary, review analyzes the captured local
  still with ML Kit face detection for framing/pose and a temporary 64 px local
  luminance sample for dark, bright, and uneven-light states. No-face,
  multiple-face, timeout, and unavailable results fail closed; Save remains
  enabled; no image, face bounds, luminance sample, or local path is sent to
  analytics. Expo web uses an explicit non-native adapter instead of importing
  the native module. The 390 x 844 human-E2E pass covers matched, adjust,
  no-face, unavailable, Retake, and Close states with complete 48 px+ controls,
  zero overflow/dialogs/disallowed logs, and no analytics traffic. At 360 x 640,
  web persistence rejection stays on review with inline recovery and reachable
  Retake/Save actions. Capture analytics omit quality verdicts, and current
  local saves make no Supabase photo-metadata attempt. Measured records now
  carry local provenance, so legacy timer scores are not reused as reference
  measurements, detail claims, or mirrored quality metadata. The additive
  database migration also clears old server values and rejects future unproven
  quality/pose fields. Evidence:
  `test-results/human-e2e/2026-07-10/progress-capture-analysis-current/`.
  Manifest gate: `Progress quality states and support-floor save recovery`.
  Native calibration across diverse conditions, network/privacy inspection,
  analyzer latency, encrypted-save failure, and VoiceOver/TalkBack remain
  device blockers. Launch copy must call this post-capture guidance, not
  real-time analysis or auto-capture.
- Photo Progress Timeline now has a real local-only quiet time-lapse instead of
  the obsolete `coming with capture` response. It filters out records without
  usable local bytes, plays oldest to newest, stops on the latest frame, and
  provides 48 px+ close, previous, play/pause/replay, and next controls plus an
  adjustable screen-reader frame. It pauses when the app leaves the foreground
  and suppresses automatic playback when the OS requests reduced motion. A
  production guard keeps the bitmap fixture development-only, and the player
  emits no image, path, date, or photo-ID analytics. The
  `390 x 844 local Progress time-lapse` and reduced-motion pass verifies real bitmap rendering,
  one named modal dialog, stable pause, finite completion, replay, close
  recovery, zero horizontal overflow, and no unexpected browser logs or
  analytics requests. Evidence:
  `test-results/human-e2e/2026-07-10/progress-timelapse-current/`. Physical
  iOS/Android encrypted-photo performance, background transitions, and
  VoiceOver/TalkBack remain device QA.
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
- `npm test` passed: 188 mobile test files / 1968 tests.
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
  evidence. Required physical-device measures include `app startup time`,
  `product add time`, `barcode lookup latency`, `routine generation time`,
  `photo_capture_analysis_ms`, `local photo loading`, and
  `memory use in photo timeline`. All must pass before closed-beta/public-launch
  signoff.
- `npm run phase5:performance-evidence:template:check` pins the blocked JSON
  schema v3, while `PHASE5_PERFORMANCE_EVIDENCE_PATH=... npm run
phase5:performance-evidence:strict` rejects unsupported devices, post-hoc
  thresholds, missing/invalid raw samples, hand-entered summaries that differ
  from calculated nearest-rank p50/p95/max, failed p95 targets, photo-timeline
  crashes or OS terminations, and placeholder signoffs. Real evidence is still
  absent.
- `npm run phase5:check-native-config` passed as the non-mutating native config
  guard for the same OS support and Android build-target posture.
- `npm --workspace apps/mobile run typecheck` passed.
- `npm --workspace apps/mobile run lint` passed.
- `npm --workspace apps/mobile run test` passed: 188 test files / 1968 tests.
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

| Area                           | Status                     | Production risk                                                                                                                                                                                                                          | Owner                                           | Next action                                                                                                                            | Exit criteria                                                                                                                             |
| ------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Brand and app identity         | launch-blocked             | RoutineKind defaults reduce the legacy `OnSkin` conflict, but the candidate is not counsel-cleared or reserved                                                                                                                           | Founder + trademark counsel                     | Clear or reject `RoutineKind`; reserve final domain/store/package IDs and provide production identity evidence                         | Written clearance, final domain, final bundle/package IDs, and store/domain reservation evidence                                          |
| Architecture and app shell     | implemented                | Dev foundation exists, but release build not verified                                                                                                                                                                                    | Engineering                                     | Keep typecheck/lint/test green                                                                                                         | Release candidate builds on iOS and Android                                                                                               |
| Auth and onboarding foundation | implemented / live-blocked | Same-user upgrade and account-transition isolation logic plus local UI proof exist; provider credentials, manual linking, Turnstile, final quiz/legal copy, live A-to-B isolation, and physical-device proof are not production-verified | Engineering + founder + counsel                 | Complete `B-VERIFY-AUTH-LINKING`, provider setup, live account-boundary matrix, Turnstile, and reviewed copy after brand decision      | Anonymous, email, Apple, Google, conflict, sign-out/A-to-B isolation, deletion, and export flows pass live device QA                      |
| Supabase backend               | stubbed                    | Local migrations, deploy wrapper, and RLS smoke script exist; no live project/RLS adversarial pass                                                                                                                                       | Engineering                                     | Create staging/production Supabase projects, run `phase2:check-env:strict`, deploy staging, then run `phase2:rls-smoke`                | Two-user RLS test, Edge Functions deployed, advisors clean or accepted                                                                    |
| Ingredient conflict engine     | launch-blocked             | Deterministic logic exists; unreviewed guidance could be unsafe or misleading                                                                                                                                                            | Dermatologist + cosmetic chemist + engineering  | Clinical review and reviewed-content gating                                                                                            | Only reviewed rules exposed by production gates                                                                                           |
| Smart Shelf manual flows       | implemented                | Local-first manual/no-match flows are useful; no real catalog match rate yet                                                                                                                                                             | Engineering                                     | Keep manual fallback honest while catalog imports are built                                                                            | Beta users can add real products even when scans miss                                                                                     |
| Barcode/OCR shelf intake       | needs-device-verification  | Live barcode camera path and editable label-capture path exist; native OCR is intentionally disabled until ML Kit/Vision QA                                                                                                              | Engineering                                     | Run barcode device matrix, then add/review on-device OCR if it remains a launch claim                                                  | Barcode match rate tracked; OCR claim hidden unless real OCR passes beta labels                                                           |
| Product catalog                | launch-blocked             | Phase 4 schema/API/parser/source disclosure exists, but no source-cleared launch catalog or beta coverage yet                                                                                                                            | Engineering + founder + counsel                 | Clear OBF/CosIng/ODbL posture, run export-based imports, curate beta-driven launch batch, review QA                                    | Meaningful beta scan match rate, attribution obligations satisfied, only eligible products drive recs                                     |
| Routine builder and scheduler  | implemented                | Local deterministic generation exists; AM/PM product-ID order edits persist through reload/recompute and are cleanup/export registered; V1 uses tap-based controls and does not claim cross-device routine sync                          | Engineering + clinical reviewers                | Review rules; verify native saved-order behavior; keep drag and server sync deferred unless they become launch claims                  | Users can generate, edit, relaunch, follow, adapt, and recover routines without fake claims                                               |
| Today check-off and streaks    | implemented                | Local-first loop exists; Expo web reload persistence evidence exists; device notification and server sync still need QA                                                                                                                  | Engineering                                     | Verify native-device persistence, notification opens, and eventual server sync                                                         | Day-level check-off and streak behavior remain correct across reinstall/upgrade                                                           |
| Guided photo progress          | needs-device-verification  | Front-camera still capture, encrypted local storage, and post-capture face/pose plus luminance checks exist; thresholds are provisional and the preview overlay is static                                                                | Engineering + privacy counsel                   | Build fresh native binaries; calibrate framing/light states; verify no-network/temp deletion, latency, save failure, and accessibility | Physical-device capture and review pass framing, lighting, local-only, failure, latency, and assistive-technology gates                   |
| Reminders                      | needs-device-verification  | Scheduling code exists; physical iOS/Android delivery not verified                                                                                                                                                                       | Engineering                                     | Device QA on iOS latest, older iOS, Android latest, Android 14+                                                                        | Quiet hours, timezone changes, reinstall, and notification copy pass                                                                      |
| Performance readiness          | needs-device-verification  | Local code gates exist, but startup, product-add, barcode, routine-generation, capture-analysis, local-photo-loading, and photo-timeline memory baselines need real-device or beta telemetry                                             | Engineering + founder                           | Measure every schema-v3 metric, including `photo_capture_analysis_ms`, on supported physical iOS and Android devices                   | Named signoff with build IDs, supported devices, raw samples, calculated p50/p95/max, memory summary, and accepted predeclared thresholds |
| Widgets and live activities    | inert                      | In-app previews exist; native WidgetKit/Glance/ActivityKit not built                                                                                                                                                                     | Engineering                                     | Keep post-launch unless native build is funded                                                                                         | Removed from launch claims or implemented and device-verified                                                                             |
| Paywall and entitlement UI     | stubbed                    | Screens/gates and guarded RevenueCat SDK wiring exist; native products/restores are not verified                                                                                                                                         | Engineering + founder                           | Configure RevenueCat after brand/account setup and test in custom dev builds                                                           | Purchase, restore, refund, expiry, renewal, and webhook matrix passes                                                                     |
| Recommendations                | launch-blocked             | Type-first engine exists; real products and goal-active recs need catalog/review                                                                                                                                                         | Clinical reviewers + engineering                | Seed catalog and review goal-active recommendation types                                                                               | Recommendation claims are reviewed and commerce-independent                                                                               |
| Commerce/affiliate             | inert                      | Consent, disclosure, and attribution scaffolds exist; no live rail                                                                                                                                                                       | Founder + counsel + engineering                 | Decide launch vs post-launch; resolve ShopMy or alternative                                                                            | If launch: rail, consent, FTC disclosure, and order reports work; else hidden                                                             |
| Community/Skin Notes           | launch-blocked             | Expert read-mostly scaffold exists; peer posting needs moderation and legal floor                                                                                                                                                        | Founder + clinical reviewers + moderation owner | Recruit experts and define moderation operations                                                                                       | No open UGC until report/block/contact/EULA/human moderation are live                                                                     |
| Trend analysis                 | launch-blocked             | No-score posture and deferred route recovery are correct; real CV/fairness/legal review absent                                                                                                                                           | Engineering + counsel + fairness reviewer       | Keep as post-launch unless validation is funded                                                                                        | No score/age/percentage claims; fairness and legal signoff complete                                                                       |
| Ask assistant                  | launch-blocked             | Deterministic local advisor exists; cloud Ask is deferred                                                                                                                                                                                | Engineering + counsel + clinical reviewers      | Keep deterministic; do not launch cloud RAG until vendor/safety/legal gates pass                                                       | Grounded, bounded answers; no unreviewed medical claims                                                                                   |
| Growth share card              | needs-device-verification  | Card and export path exist; final domain/store fallback/attribution blocked by final identity and device QA                                                                                                                              | Engineering + founder                           | Final identity/domain and universal link                                                                                               | Shared card opens app or web fallback and tracks attribution                                                                              |
| Analytics/crash reporting      | stubbed                    | PostHog/Sentry runtime wiring exists; projects, source maps, dashboards, deletion, and privacy review not live                                                                                                                           | Engineering + founder                           | Configure after brand/account setup                                                                                                    | Production dashboards, deletion, source maps, and crash privacy review pass                                                               |
| Policies/support/deletion      | launch-blocked             | Copy and functions are not final/live                                                                                                                                                                                                    | Counsel + engineering                           | Finalize policy URLs and deploy account deletion/export                                                                                | Store listing URLs work; deletion/export verified against live backend                                                                    |
| Phase 3 signoff packet         | launch-blocked             | Exact-source packets, item snapshot digests, safe signoff-template CLI, detached-signoff schema, and production gates exist; professional signoffs are absent                                                                            | Founder + counsel + clinical reviewers          | Run review packet, verify reviewer credentials, retain original approvals, and add one current detached signoff per released item      | Counsel, dermatologist, cosmetic chemist, privacy, and IP decisions pass the machine gate against exact reviewed source hashes            |
| Closed beta                    | launch-blocked             | No real cohort metrics yet                                                                                                                                                                                                               | Founder + engineering                           | Recruit 50-100 users for V1 loop                                                                                                       | Activation, D7/D14/D30 retention, trial starts, and willingness-to-pay measured                                                           |

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
