# Blockers - iOS All-Features Launch Gates

Date: 2026-07-15

Everything here needs a founder decision, account, API key, payment method,
legal/clinical signoff, production service, real-device verification, or beta
proof. The app has substantial implemented surfaces, but it is not
production-ready.

The current release contract is iOS-only and requires every feature ID 1-20
plus every Phase 7/8 surface. Older V1/post-launch and Android release language
is superseded by `docs/hugeToDo/launch-contract.json`. A newly required feature
keeps its honest current readiness label until implementation and evidence
exist; it does not become ready through a scope or flag change.

Read this with:

- `docs/MASTER_PLAN.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/FEATURE_INDEX.md`
- `docs/ROADMAP.md`
- `docs/rebrand-and-core-loop-migration-checklist.md`
- `docs/FOR_TAS_TO_DO.md`
- `docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md`
- `docs/hugeToDo/FOUNDER_ENROLLMENT_AND_EXTERNAL_GATES_PACKET.md`
- `docs/hugeToDo/APPLE_REVIEW_FEATURE_ACCEPTANCE_MATRIX.md`
- `docs/hugeToDo/PAY-01-pricing-and-unit-economics-recommendation-2026-07-13.md`
- `docs/hugeToDo/ACCOUNTS_AND_VENDOR_DECISION_PACKET.md`
- `docs/hugeToDo/DB-01-11-GAP-MATRIX-2026-07-13.md`
- `docs/hugeToDo/IOS-10-EXPORT-COMPLIANCE-GATE.md`
- `docs/hugeToDo/US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE.md`
- `LAUNCH_READINESS.md`
- `docs/brand-decision-memo.md`
- `docs/brand-evidence.md`
- `docs/v1-scope-freeze.md`
- `docs/phase-2-readiness-checklist.md`
- `docs/phase-2-production-infrastructure-runbook.md`
- `docs/phase-2-status.md`
- `docs/store-privacy-inventory.md`
- `docs/seven-figure-readiness.md`
- `docs/phase-3/regulatory-positioning-memo.md`
- `docs/phase-3/legal-regulatory-review-log.md`
- `docs/phase-3/clinical-review-log.md`
- `docs/phase-3/cosmetic-chemistry-review-log.md`
- `docs/phase-3/privacy-security-review-log.md`
- `docs/phase-3/ip-fto-review-log.md`
- `docs/phase-3/quiz-fto-summary.md`
- `docs/phase-3/data-inventory.md`
- `docs/phase-3/consent-matrix.md`
- `docs/phase-3/store-metadata-review.md`
- `docs/phase-3/app-review-notes.md`
- `docs/phase-3/google-play-health-declaration-notes.md`
- `docs/phase-3/launch-claims-vocabulary.md`
- `docs/phase-4/catalog-source-memo-cosing.md`
- `docs/phase-4/catalog-source-memo-open-beauty-facts.md`
- `docs/phase-4/odbl-compliance-memo.md`
- `docs/phase-4/ingredient-tag-taxonomy.md`
- `docs/phase-4/curated-product-curation-sheet.md`
- `docs/phase-4/first-curated-product-batch.md`
- `docs/phase-4/observability-dashboard.md`
- `docs/phase-4/beta-coverage-report.md`
- `docs/phase-4/phase-4-exit-review.md`

## Status Key

- `implemented`: production-shaped code exists, still verify in release QA.
- `stubbed`: code exists around placeholders or local/dev substitutes.
- `simulated`: UX or pure logic exists, but real native/device/data input is not
  implemented.
- `inert`: scaffold exists but is intentionally non-operational.
- `needs-device-verification`: code exists but has not passed physical-device QA.
- `launch-blocked`: must not ship publicly until the blocker clears.

## Current Launch Gates

1. RoutineKind working identity is implemented locally and remains the first
   counsel candidate. The refreshed provisional sequence is `RoutineKind`,
   `Ritunera`, `Ritualoom`; `Rituvia` is suspended after material `Rituva`
   skincare and `Retuvia` beauty-sector findings. Legal clearance, compliant
   remaining grids, reservations, and production identity evidence are open.
2. Supabase project not live.
3. RevenueCat not live.
4. Apple Developer/App Store Connect and Google OAuth for iPhone are not verified.
5. Clinical review not complete.
6. Legal/privacy copy not final.
   The US Wave 1 privacy and consumer-health packet is a conservative planning
   gate, not legal clearance. Its federal, state, consumer-health, biometric,
   minors, subscription, UGC, security, retention, and breach decisions require
   qualified counsel tied to the actual release data flows and binary.
   Production config now fails closed on these Phase 3 blockers unless
   `PHASE3_RELEASE_CLEARANCE=cleared`; the flag still cannot bypass an
   unresolved, dirty, incomplete, or source-stale reviewer worklist. Keep it
   pending until every item is `Approved` or explicitly `Deferred`, named
   owners and dates are recorded, one current detached signoff records the
   credential/role, conditions, and retained approval reference per release
   disposition, current hashes match, and the strict copy audit passes.
7. Real catalog seed not imported and source/license review not complete.
8. Native camera/barcode/photo capture, encrypted keychain/keystore behavior,
   and app-wide/photo-timeline biometric prompt ordering, deep-link coverage,
   background relock, encrypted Progress read-failure recovery, and screen-reader
   focus are implemented or specified but not physical-device verified; required
   native iOS OCR is not implemented.
9. Native notification/device verification incomplete.
10. Performance baseline and scale evidence are not measured on supported
    physical devices or beta telemetry.
11. Closed beta not run.
12. Health-consent withdrawal now has a purpose-scoped, non-account-deleting
    source candidate and local Expo-web/database evidence, but all 15 installed
    copy tuples remain `draft_blocked`; hosted worker/Storage/processor/backup,
    physical-iPhone, and professional privacy/legal approval evidence are absent.
13. Sign in with Apple now has a locally verified source candidate for
    nonce/state and one-use-code capture, encrypted versioned refresh-token
    retention, daily validation, signed server events, native invalidation,
    deletion-vault reuse, and exact-session access denial. Hosted deployment,
    primary-App-ID event delivery, Vault/Cron continuity, recapture/key-rotation
    drills, stale-JWT proof, physical-iPhone/TestFlight evidence, and
    professional approval remain launch-blocking. `TRANSFERRED` remains
    fail-closed pending a formal transfer decision.
14. The exact release privacy report, live policy/support URLs, and
    non-expiring App Review demo access/instructions do not exist.

## Source-Of-Truth Status

The old `B-MISSING-DOCS` blocker is closed. The docs folder now contains
`docs/00-architecture.md` through `docs/14-growth-to-seven-figures.md`, plus
`docs/legal-readiness.md`.

The `04_repo_docs` strategy packet has also been copied into active docs as
`docs/MASTER_PLAN.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/ARCHITECTURE.md`,
`docs/FEATURE_INDEX.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`,
`docs/TESTING_STRATEGY.md`, `docs/CODE_REVIEW.md`,
`docs/MASTER_PLAN_UPDATE_PATCH.md`, and
`docs/CODEX_IMPLEMENTATION_PROMPT.md`. Future strategy, pricing, launch,
privacy, or architecture changes should use the master-plan patch process
instead of silently editing implementation around the plan.
`npm run docs:source-packet-audit:strict` now inventories all 12 files under
`04_repo_docs`, verifies the expected top-level packet files are present,
verifies all 10 packet docs have active `docs/` mirrors, and verifies those
mirrors are byte-identical and listed in the root source-of-truth docs.
`npm run docs:tas-todo-audit:strict` verifies `docs/FOR_TAS_TO_DO.md` still
covers the Phase 2-11 Tas-owned launch evidence gate groups and writes the
machine-extracted key inventory to `docs/generated/tas-todo-audit.{json,md}`.

Broader launch-gate verification retained through 2026-07-15: `npm run typecheck`, `npm run lint`,
`npm test`, `npm --workspace apps/mobile run typecheck`,
`npm --workspace apps/mobile run lint`, `npm --workspace apps/mobile run test`,
`npm run phase5:verify`, `npm run phase7:verify`, `npm run brand:audit:strict`,
`npm run phase8:verify`, `npm run phase9:verify`,
`npm run phase10:beta-analytics-audit`, `npm run phase10-11:verify`,
`npm run docs:source-packet-audit:check`,
`npm run docs:tas-todo-audit:check`,
`npm run docs:readiness-status-audit:check`,
`npm run docs:generated-packet-status-audit:check`, and
`npm run e2e:human:manifest:check` pass non-strict code and documentation
freshness gates. The generated-packet status audit now rejects dirty packet
outputs and stale recorded source/file hashes. The Phase 7 core-loop packet has
been refreshed for the current Today and Progress route hashes; the Phase 8
growth/store packet has
been refreshed for the current share-card and conflict-share route hashes; the
Phase 5 native-device packet has been refreshed for the current progress
capture route hash; strict Phase 5, Phase 7, and Phase 8 still require the
founder/reviewer/device evidence listed in `docs/FOR_TAS_TO_DO.md`. The Phase 9
privacy payload audit now accepts the route-owned progress-photo share
confirmation instead of requiring a native alert. The current integrated source checkpoint
on 2026-07-15 passes root typecheck, lint, and 269 mobile test files / 3087 tests.
The human-simulated E2E manifest now
combines the complete 2026-07-09 viewport baseline with the 2026-07-10
`390 x 844 local Progress time-lapse` and reduced-motion pass in
`test-results/human-e2e/2026-07-10/progress-timelapse-current/`, plus the
`Progress quality states and support-floor save recovery` gate in
`test-results/human-e2e/2026-07-10/progress-capture-analysis-current/`, and the
`Device-only Progress photo storage` gate in
`test-results/human-e2e/2026-07-10/progress-device-only-backup-current/`, plus
the `Progress direct-route app-lock coverage` gate in
`test-results/human-e2e/2026-07-10/progress-direct-route-lock-current/`, plus
the `Progress encrypted-storage recovery` gate in
`test-results/human-e2e/2026-07-10/progress-storage-recovery-current/`, plus
the `Account export local-photo scope disclosure` gate in
`test-results/human-e2e/2026-07-10/data-export-local-photo-disclosure-current/`,
and the `Combined account and current-device export` gate in
`test-results/human-e2e/2026-07-10/data-export-combined-device-current/`.
The `Account-generation-bound combined export` gate in
`test-results/human-e2e/2026-07-11/data-export-account-generation-current/`
also proves delayed-export sign-out, cleanup-failure gating, and recovery at
360 x 640 and 390 x 844; focused tests prove exact owner matching, Edge abort,
operation drainage, post-write deletion, and same-generation stability.
The required `Shelf freshness and replacement provenance lifecycle` gate in
`test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/`
proves exact-date and unopened intake, explicit PAO provenance, winning expiry
source, reload, new-UUID replacement history, opt-in replenishment posture, and
the fixed supported-floor scan layout. It does not clear staging deployment of
the two Shelf migrations, owner/second-user RLS, reviewed region-matched catalog
responses, native notification delivery, physical-device relaunch/accessibility,
or named cosmetic-chemistry review; those remain in `docs/FOR_TAS_TO_DO.md`.
The `Required-surface honest direct-entry and recovery pass` in
`test-results/human-e2e/2026-07-12/required-surface-honesty-rerun/` proves the
Widgets, Trend opt-in/fairness, and Community ask/aggregate routes retain exact
direct entries, show no Trend or Community Ask inputs, avoid horizontal
overflow and sub-44 px recovery controls, and recover through the expected
Progress, Skin Notes, or free-fixture entitlement path. It validates truthful
unavailable-beta behavior only; native widget/live-activity targets, validated
Trend processing and consent, and production Community moderation, appeals,
persistence, support, and reviewed aggregate data remain launch blockers under
the iOS all-features contract.
The required `Trend navigator privacy and exact-route recovery` gate in
`test-results/human-e2e/2026-07-13/trend-route-group-gate-current/` catches and
fixes a layout-level `/trend/optin` to `/trend/fairness` canonicalization
regression. The 375 x 667 rerun proves both exact direct URLs survive refresh,
disabled child scenes and the fairness Monk-band hook stay unmounted, no
consent input or switch appears, the complete refusal is visibly captured at
375 x 667, and 55.99 px recovery controls deterministically replace to
`/progress` even with stale Trend history. Unexpected browser warn/error count
is zero. Native iPhone navigation,
VoiceOver, Dynamic Type, and any future validated Trend engine remain external
release gates.
It also includes the `360 x 640 account-upgrade error and recovery pass` in
`test-results/human-e2e/2026-07-10/onboarding-account-upgrade-current/`.
The required `360 x 640 account-transition isolation and cleanup recovery pass`
is in
`test-results/human-e2e/2026-07-10/onboarding-account-isolation-current/` and
proves a forced cleanup failure stays gated before signed-out direct Shelf and
Today expose no account A product names.
The required `Pregnancy-safety status and routine exclusion consistency` gate
is in
`test-results/human-e2e/2026-07-10/pregnancy-safety-status-current/`. The
required `Canonical multi-active Plan and Today consistency` gate is in
`test-results/human-e2e/2026-07-10/multi-active-plan-today-current/` and proves
BP AM placement, every supported cycle family, explicit undefined-cadence
withholding, one-active PM projection, reload persistence, and supported-phone
geometry. The required `Persistent Morning and Evening routine order` gate is
in `test-results/human-e2e/2026-07-10/routine-order-persistence-current/` and
proves independent stable-ID phase edits, reload, Cancel, shelf recompute,
Today projection, failed-write recovery, and safety/cycle authority. The
required `Exact-pair conflict choice and reviewed-schedule consistency` gate
is in
`test-results/human-e2e/2026-07-10/conflict-choice-schedule-current/` and
proves independent same-rule pairs, both persisted choices, exact downstream
suppression/explanations, one-shot write recovery, one-active schedule
authority, and supported-phone keyboard/geometry. The required disruption gate
has manifest title:
`Cycle disruption persistence and deterministic reconciliation`.
Its evidence is in
`test-results/human-e2e/2026-07-10/cycle-disruption-reconciliation-current/`
and proves failed-write recovery, pause/reload/resume, procedure and
irritation recovery, variant persistence, Start Today, pending-interaction
blocking, and supported-phone geometry. The required authored-cycle gate has
manifest title:
`Authored cycle customization and deterministic reconciliation`.
Its evidence is in
`test-results/human-e2e/2026-07-10/cycle-customization-current/` and proves
Custom Save/Cancel, stable product-ID intent, retained cadence excess,
requested/applied cadence disclosure, preset round trip, failed-write retry,
pending browser-Back blocking, closed review-gate behavior, exact recovery
provenance, and Settings/Week/Why Tonight/Plan/Today agreement. None of these
local gates replaces named clinical/cosmetic review, live Supabase proof,
native process-death or timezone/DST proof, or native device accessibility
evidence.
The baseline still anchors to the 360 x 640 launch-floor 200% text-pressure sweep,
which passed 49 direct-entry routes with zero failed routes; the supported-phone
360 x 740, 375 x 812, 390 x 844, 412 x 915, and 430 x 932 200% sweeps also
passed 49 / 49 routes with zero failures. Evidence includes
`test-results/human-e2e/2026-07-09/text-pressure-200-supported-360-640-postfix/`,
`test-results/human-e2e/2026-07-09/text-pressure-200-android-360-740-postfix/`,
`test-results/human-e2e/2026-07-09/text-pressure-200-iphone-375-812-postfix/`,
and
`test-results/human-e2e/2026-07-09/text-pressure-200-android-412-915-postfix2/`.
The 414 x 896 / 200% boundary sweep also passed 49 / 49 routes after the
contextual ProGate, Recommendation Preferences, and entitlement-loading harness
fixes, with evidence in
`test-results/human-e2e/2026-07-09/text-pressure-200-boundary-414-896-postfix3/`.
The native support-floor guard now keeps iOS deployment at 17.0+, Android min
SDK at API 29, and Android compile/target SDK at API 36, so the install floor
and current store target posture cannot drift silently. `docs/DEVICE_SUPPORT_POLICY.md`
now treats 360 x 640 as the launch-blocking web-compatible layout floor and
keeps 320-wide browser evidence as stress/resilience coverage unless real
device, beta, accessibility, or store-review evidence elevates it.
The Settings Privacy Terms-row spacer and contextual Progress
tall-phone compact compliance header have fresh route evidence, including
compact visible Explore-first copy with the full reverse-trial copy retained in
the accessibility label. Phase 9 dependency/SBOM evidence now records 1073
packages and zero npm vulnerabilities; strict release completion still needs
release-owner dependency signoff. The earlier 2026-07-08 Expo web
shortest-phone rerun at 320 x 480 passed 49 direct-entry routes with zero
failed routes, visible clipped controls, sub-44 user-facing controls, blocked
hit-tests, horizontal overflow, or disallowed browser logs. The Shelf manual
category picker also passed 320 x 480 and 320 x 568 Expo web evidence for its
named bottom sheet, scrollable lower category options, 52 px rows, `Other`
selection, `/shelf/opened` continuation, and zero disallowed browser logs.
Additional
320 x 440 / 320 x 430 Shelf intake evidence verifies the ultra-short manual
add, OCR capture-failure/manual-text continuation, and labeled no-match fallback
paths without horizontal overflow, blocked user-facing controls, or
current-origin warn/error logs.
Strict beta/public-launch gates still require the external evidence listed in
`docs/FOR_TAS_TO_DO.md`. Re-run the relevant checks after any
readiness-changing work.

The previous `docs/design-spec.pdf` reference is obsolete. The available design
handoff source in this workspace is the local `dx*` folders and `.dc.html`
artifacts.

Phase 3 local governance scaffolding exists, but it is not professional
clearance. The repo now has structured Phase 3 legal/regulatory, clinical,
cosmetic chemistry, privacy/security, and IP/FTO review logs,
regulatory/data/consent/store metadata packets, `scripts/phase3/audit-copy.mjs`,
`scripts/phase3/build-review-packet.mjs`,
`scripts/phase3/check-production-release.mjs`, a policy-link registry, store
metadata claim tests, and production gate tests. Production Expo config now
requires exact `PHASE3_RELEASE_CLEARANCE=cleared` when either build or runtime
stage is production, then independently validates the generated worklist's five
domains, release dispositions, named owners/dates, clean generation status, and
current byte/SHA-256 records. It also recomputes each item snapshot and re-reads
the current detached signoff JSON, including credential/role, condition state,
and retained evidence reference. The flag must remain pending, and the strict
Phase 3 audit must remain blocking, until counsel, dermatologist,
cosmetic-chemist, privacy/security, and IP/FTO signoffs are real.

## B-BRAND - RoutineKind candidate clearance and launch identity

Status: `launch-blocked`

There is already a public skincare/cosmetic scanner branded `OnSkin` at
`onskin.com`, with App Store and Google Play presence. This repo no longer uses
the legacy identity for local/native launch defaults: the current working
candidate is `RoutineKind`, with `routinekind://` and `com.routinekind.app`
development/staging defaults. `npm run brand:audit:strict` passes with zero
public launch-risk, zero review-needed, and 23 exact reviewed
`legacy-compatibility` hits. The retained 23 are cryptographic/domain-separation
contracts, historical migration contracts, one live compatibility harness, or
exact PostgreSQL rehearsal fixtures. Their path, literal, expected count,
subtype, and rationale are fail-closed in
`scripts/brand-legacy-compatibility.json`; new or drifted references make the
strict audit fail. Evidence:
`docs/hugeToDo/BRAND-LEGACY-COMPATIBILITY-CHECKPOINT-2026-07-14.md`.

That technical audit result is not legal clearance, trademark clearance,
domain registration, App Store name reservation, or final production identity
evidence. Production native config still fails closed unless
`BRAND_LEGAL_CLEARANCE=cleared` and explicit final identity env values are set.

The dated 2026-07-15 knockout refresh completed current Apple public-store,
CIPO, USPTO, IP Australia, RDAP, indexed common-law, and indexed social screens.
It retains `RoutineKind` first, `Ritunera` backup 1, and lower-confidence
`Ritualoom` backup 2. It suspends `Rituvia`: active `Rituva` differs by one
letter and sells routine-based skincare, `Retuvia` is an active Florida-company
hair-products lead, `RITUVÉ` is a further close storefront lead, and
`rituvia.com` is registered. WIPO/Madrid, UKIPO, EUIPO/TMview if in scope,
direct authenticated handle/company-name checks, and formal counsel searches
remain unverified. No name is cleared, available, reserved, or Apple-approved.

Risk:

- trademark/customer-confusion exposure if the app reverts to `OnSkin` or uses
  a confusingly similar identity
- users downloading or contacting the wrong app if public surfaces are created
  before final reservation
- App Store review confusion if bundle/name records are created
  under an uncleared identity
- paid-search and ASO conflict
- support/domain/policy URL confusion
- rework if Apple, Google OAuth, RevenueCat, Supabase, policy URLs, or beta users are
  created under a candidate that later changes

Next action:

- Give counsel `docs/brand-evidence.md`.
- Ask counsel to clear or reject the exact `RoutineKind`, `Ritunera`, and
  `Ritualoom` sequence and review the rejected `Rituvia` comparators; do not
  revert to `OnSkin` unless counsel explicitly clears it.
- Complete compliant WIPO/Madrid, UKIPO, EUIPO/TMview if in scope, company-name,
  direct-handle, and comprehensive common-law searches for approved countries.
- Run registrar, App Store Connect, social-handle, paid
  search, and common-law checks for the final candidate.
- Use `docs/brand-decision-memo.md` to record the final identity decision.

Exit criteria:

- written counsel recommendation exists;
- founder decision is recorded;
- final app name, domain, bundle ID, scheme, support URL, and
  policy URLs are chosen;
- store-console and domain reservation evidence is attached;
- code/copy/share-card/policy/env references match the final identity and
  typecheck/lint/tests pass.

Default until cleared: do not launch as `OnSkin`, and do not treat
`RoutineKind` as final, do not advance `Rituvia`, and do not freeze any
replacement until counsel and store/domain reservation evidence are attached.

## B-SUPABASE - Live backend

Status: `source-hardened / live-blocked`

The repo contains 54 migrations through `20260715000055`, targeted hand-maintained
RPC types with DB-08 still open, 16 deploy-by-default Edge Functions, a staging
deploy wrapper, and an exhaustive live-project RLS harness. The current local
gate passes two clean migration-plus-seed resets, exact 54-migration history,
the full structural pgTAP suite plus 114/114 Apple lifecycle assertions,
error-level schema lint, an empty migration-shadow drift check, and temporary
type generation. The migration-derived inventory is 80 RLS tables and 57
private tables: 40 directly queryable plus 17 sealed.
PostgreSQL 15/17 rehearsals pass for the durable deletion/publication system and
the separate RevenueCat/app-grant entitlement authorities.

Migrations `0048`-`0052` provide the durable deletion operation, provider-step,
barrier, guarded-writer, identity-tombstone, exact-session publication-lease,
drain, settling, and repeated-absence contracts. Mobile now places every
Supabase request and RevenueCat identity/operation behind one purpose-scoped,
exact-session remote-admission controller; controlled refresh validates and
persists only the exact subject. Migration `0053` keeps RevenueCat authority in
`entitlements`, the no-card grant in `reverse_trial_grants`, and exposes both
through an owner-derived RPC. Bounded authenticated reconciliation uses only a
fresh provider `request_date`. Focused deletion, reconciliation, grant, webhook,
auth, RLS, policy, and data-rights source gates pass.

Migration `0054` adds the non-destructive health-consent lifecycle, append-only
copy review history, processing epochs, dependent-consent operations, a
retry-bounded worker lane, and fail-closed mobile admission/cleanup gates. Its
local database, Deno, mobile, and Expo-web evidence passes; all installed copy
remains `draft_blocked`, and no hosted worker/Storage/Cron/Vault or legal
approval is claimed.

Migration `0055` adds the Sign in with Apple lifecycle authority: owner/subject/
client-bound encrypted refresh-token vaulting, nonce/state and one-use-code
capture, daily validation, signed terminal-event reconciliation, native
invalidation, deletion-vault reuse, and exact-session denial across RLS, photo
Storage, authenticated Edge Functions, writes, and direct authenticated helper
RPCs. The focused Apple Edge suite passes 20/20 and the complete Apple auth work
lane passes 47 tests. This is local disposable evidence, not hosted or device
proof.

This is not a hosted deployment or provider proof. Full generated-type parity,
hosted RLS/Cron/Vault/concurrency, old/tampered-client containment,
cross-owner community-handle cleanup, Sign in with Apple deployment and
provider-event proof, and staging/production provider evidence remain open.

Next action:

- create staging and production projects after the brand decision;
- fill `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`;
- run `npm run phase2:check-env:strict`;
- apply all 54 reviewed migrations through `0055` with
  `scripts/phase2/deploy-supabase-staging.ps1`;
- regenerate `packages/types/src/database.types.ts`;
- deploy the exact 16-function manifest, including `apple-auth-lifecycle`,
  `apple-account-events`, `apple-auth-worker`, `health-consent-worker`, and
  `subscription-reconciliation`;
- run Security Advisor and Performance Advisor;
- configure anonymous Auth and Turnstile, then run
  `npm run phase9:live-supabase-adversarial:strict` in staging and production;
- retain clean-revision, redacted artifacts covering both permanent users, the
  signed-anonymous user, the no-session client, all 57 private tables, exact
  database/Storage outcomes, publication/deletion concurrency, provider
  interruption/recreation, and zero cleanup residue;
- obtain an approved old/tampered-client control and prove the source-complete
  SIWA authorization-code/token/server-event lifecycle against hosted Apple
  and Supabase services before production.

Exit criteria:

- current user can only read/write their own data and signed-anonymous accounts
  cannot upload or replace cloud photo bytes;
- account deletion and data export work against live backend;
- Edge Functions return correct status and logs;
- generated DB types match live schema;
- staging and production adversarial artifacts contain no synthetic residue or
  raw provider/database/user identifiers.

## B-APPLE - Apple Developer and App Store Connect

Status: `source-hardened / external-blocked`

Apple account and App Store records should be created only under the
counsel-cleared final identity. Do not use legacy `OnSkin` identifiers.

Next action:

- create App ID under cleared bundle ID;
- configure Sign in with Apple;
- configure the final server-side token exchange/revocation credentials and
  versioned vault secrets, deploy the reviewed Apple lifecycle functions,
  provision the one-minute Vault/Cron lane, and register the signed event
  endpoint for the primary App ID;
- verify exact automatic revocation plus the manual iPhone Settings fallback,
  including durable notice recovery, on a signed physical-iPhone build;
- create App Store Connect app;
- prepare privacy nutrition labels and required support/policy URLs.
- produce the exact release privacy report and a non-expiring ordinary App
  Review demo account with complete feature/deletion/Restore instructions.

Exit criteria:

- TestFlight build installs and auth/deletion flows pass;
- subscription metadata and policy links are accurate;
- app identity matches brand memo.

## B-SIWA-SERVER-LIFECYCLE - Sign in with Apple token and event proof

Status: `launch-blocked`

The source now implements the complete candidate lifecycle. Native sign-in uses
a 32-byte CSPRNG nonce/state, sends only the SHA-256 nonce to Apple, captures the
single-use authorization code, and defers session publication until the trusted
server verifies and seals the result. Migration `0055` and the Apple Edge
functions provide owner/subject/client-bound versioned encrypted refresh-token
retention, daily validation, signed terminal-event ingestion and reconciliation,
native invalidation, deletion-vault reuse, and exact-session denial across RLS,
photo Storage, authenticated Edge Functions, writes, and direct authenticated
helper RPCs. `TRANSFERRED` remains fail-closed as `credential_transferred`.

The local gate passes two clean resets, exact 54-migration history through
`0055`, the full structural suite plus 114/114 Apple pgTAP assertions, schema
lint, empty shadow diff, temporary type generation, 20/20 focused Apple Edge
tests, and the 47-test Apple auth work lane. These results close the source
implementation gap only. Before launch, reviewed staging/production and the
exact signed iOS build must prove primary-App-ID event delivery, one-minute
Vault/Cron continuity, existing-account recapture and mandatory-version cutover,
key rotation/rollback with zero-row or reauthentication evidence, stale JWT and
multi-device drain denial, provider interruption/recreation, deletion, backup/
restore, and physical-iPhone/TestFlight behavior. Product/counsel must approve
either a formal no-transfer policy or a tested app/team-transfer migration
before changing the fail-closed behavior.

Exit criteria:

- fresh-code exchange, encrypted refresh-token retention/rotation, account
  deletion revocation, invalid/expired/replayed code handling, and exact
  `200`/no-body revoke proof pass in staging and on a supported physical iPhone;
- native credential-state notification and server-to-server `consent-revoked`,
  `account-deleted`, `email-enabled`, and `email-disabled` events applicable to
  the release are
  signature/issuer/audience/time checked, deduplicated, and owner-bound;
- missing automatic proof leaves truthful durable manual recovery and never
  blocks deletion or claims revocation success; and
- privacy/security counsel approves token retention, operator access,
  rotation, incident, and deletion behavior.

## B-GOOGLE - Google Sign-In For iPhone

Status: `stubbed`

Google OAuth records should be created only under the counsel-cleared final
identity. Google Play release work is not part of this contract.

Next action:

- create/configure the Google Cloud OAuth project and iOS client ID;
- configure the reversed client ID and authorized Supabase callback values;
- verify Google sign-in, account linking, deletion, and restore behavior.

Exit criteria:

- signed iPhone build installs;
- Google sign-in works on the supported physical-iPhone matrix;
- account deletion/revocation behavior is verified.

## B-VERIFY-AUTH-LINKING - Live Same-User Account Upgrade Proof

Status: `launch-blocked`

The client now upgrades active anonymous sessions in place: Apple/Google native
tokens use Supabase `linkIdentity`, email uses `updateUser` plus an
`email_change` OTP, and every successful path asserts the original user ID.
Focused local tests prove routing, same-user invariants, and no unsafe fallback,
plus hashed local ownership, encrypted raw-session restore, exact-subject
controlled refresh, query-cache eviction, write and child-request draining,
purpose/URL/body/response binding, deadline/quarantine handling, cleanup failure
recovery, and signed-out route isolation. Every production Supabase request
uses the central remote-admission fetch. No hosted Supabase project, live
provider identity, email inbox, second real account, or physical release build
proves the external configuration.

Next action:

- enable anonymous sign-in and manual identity linking in staging and production;
- configure and review email-change OTP delivery/templates, expiry, and rate limits;
- after final brand clearance, configure Apple and Google provider credentials;
- on supported physical iPhones, capture the anonymous `auth.users.id`
  before and after Apple, Google, and email upgrades;
- exercise an identity already owned by another account and confirm the app
  stays on the anonymous user without deleting local private data;
- populate account A with distinctive Shelf/routine/completion/Progress data,
  then verify sign-out, a signed-out cold start with retained owner metadata,
  cold-start owner mismatch, token expiry, and account A to account B switching on
  the supported iOS build;
- after every destructive account boundary, open direct Shelf, Today, Progress,
  and You routes and verify no account A query or metadata is visible to account B.
- start a combined export for account A, delay the `data-export` response, then
  sign out and repeat an A-to-B switch; verify the request is aborted or its
  result is rejected, no account A plaintext is written/shared after the
  boundary, and account B cannot publish until export cleanup settles. Repeat
  once with the boundary immediately after cache write and once with a
  same-user token refresh that must not cancel the current export.
- force a partial cleanup after the owner hash is removed and a remote sign-out
  failure; verify the cleanup-required control survives, persisted local auth is
  removed, and account B remains gated until every native store succeeds on retry.
- exercise background/foreground, refresh expiry, delayed response bodies,
  aborted callers, transport ambiguity, and fire-and-forget child requests;
  prove no remote request or RevenueCat result survives closure, owner switch,
  deletion intake, or a mismatched session generation.

Exit criteria:

- all three successful upgrades retain the exact same Supabase user ID and
  return `is_anonymous=false`;
- pre-upgrade profile, shelf, routine, completion, consent, and Progress metadata
  remain intact and owner-readable after relaunch;
- RevenueCat remains bound to that same user ID;
- identity-conflict, invalid/expired code, cancellation, offline, and rate-limit
  recovery paths preserve the anonymous session and local data;
- sign-out and A-to-B transitions never publish the next account before local
  cleanup succeeds, and no account A profile, shelf, routine, completion,
  entitlement, or Progress metadata is visible afterward;
- evidence records project/build version, provider, device/OS, before/after user
  IDs (redacted consistently), screenshots/logs, and named tester signoff.

## B-REVENUECAT - Live purchases and entitlements

Status: `source-hardened / live-blocked`

Paywall and entitlement surfaces exist. Store authority is isolated in
`entitlements`; the no-card app grant is isolated in `reverse_trial_grants`.
The owner-derived read RPC returns both lanes, `legacy_unknown` fails closed,
and the authenticated reconciliation function accepts no caller owner/time.
Every configure/log-in/offering/purchase/Restore/customer-info request requires
exact publication authority. A durable write-ahead journal prevents a second
charge after an unconfirmed native result. iOS copy names the App Store and
deletion copy discloses up to 29 days for provider verification. None of this is
live RevenueCat, StoreKit, counsel, physical-iPhone, or App Review evidence.

Next action:

- create RevenueCat project after final app identity;
- configure monthly/annual products, offerings, and entitlements;
- bind RevenueCat `appUserID` to Supabase user ID;
- fetch localized prices from RevenueCat;
- verify purchase, Restore, intro eligibility, cancellation/manage links and
  the unconfirmed/payment-pending journal on a physical iPhone;
- deploy migration `0053`, `subscription-reconciliation`, webhook, grants, and
  the compatible mobile reader in the reviewed order; prove no installed old
  direct-table reader remains or enforce a mandatory-version fence;
- deploy and verify webhook reconciliation;
- configure and verify provider deletion/recreation, alias/transfer, late
  webhook, fresh v1 reconciliation, and the v2 full-family absence contract
  against disposable sandbox data;
- obtain counsel/App Review approval for the transaction-journal retention and
  29-day deletion disclosure.

Exit criteria:

- no local stub can grant paid access in production;
- purchase/restore/renewal/refund/expiry/grace/upgrade/downgrade matrix passes;
- entitlement state is correct offline and reconciles online;
- account deletion handles active subscribers correctly.

## B-POSTHOG - Analytics

Status: `stubbed`

PostHog runtime wiring exists with JSON-safe event properties and session replay
disabled. The account-deletion source uses the EU project bulk-delete endpoint,
accepts only a typed `202`, treats zero matches as already absent, and blocks
local/Auth deletion when a nonzero deletion is merely queued. The production
project, consent/privacy review, dashboards, durable queue-status polling, and
live deletion behavior are still absent.

Exit criteria:

- PostHog project exists under cleared brand;
- event taxonomy matches V1 loop;
- person/event/recording deletion reaches a durable terminal state during
  account deletion, including interruption and retry;
- no health/photo content is sent without explicit consent.

## B-SENTRY - Crash reporting

Status: `stubbed`

Sentry runtime wiring exists with privacy-conservative defaults, but the
production project, source-map upload, release health, and crash privacy review
are not live.

Exit criteria:

- Sentry project exists under cleared brand;
- source maps upload for release builds;
- crash/log privacy review confirms no sensitive health/photo content leaks.

## B-TURNSTILE - Abuse prevention

Status: `stubbed`

Turnstile account and keys are not configured.

Exit criteria:

- site key and secret are configured where needed;
- flows pass without locking out legitimate users.

## B-QUIZ-COPY - Onboarding quiz and scoring copy

Status: `launch-blocked`

Quiz questions, scoring, and skin-profile labels need legal review, especially
to avoid copying or implying proprietary skin typing frameworks.

Current implementation note:

- `apps/mobile/src/features/onboarding/quiz.ts` is still explicitly
  placeholder-gated.
- `docs/phase-3/quiz-fto-summary.md` is the review packet entry point.

Exit criteria:

- final quiz copy is counsel-reviewed;
- age gate/minors policy is clear;
- copy avoids diagnosis and unsupported claims;
- reviewed copy version is recorded.

## B-PRIVACY-COPY - Policies and consent copy

Status: `launch-blocked`

Required final URLs:

- Terms
- Privacy Policy
- Consumer Health Data Privacy Policy
- Support
- Account deletion instructions
- Data export instructions

Current implementation note:

- The app now has a central policy URL registry at
  `apps/mobile/src/lib/legal/policyLinks.ts`.
- The You tab exposes the required privacy, consumer health privacy, support,
  deletion, export, and terms links.
- `.env.example` and `phase2:check-env` include the required URL contract.
- Production Expo config rejects missing or pending
  `PHASE3_RELEASE_CLEARANCE`, and rejects a cleared flag while the reviewer
  worklist is unresolved, source-stale, or missing a valid detached signoff.
  This is a release boundary, not evidence that the current draft copy is
  approved or that a claimed credential is authentic.
- The copy and URLs are still placeholders until counsel supplies final text and
  the final brand/domain.
- No exact release privacy report or non-expiring ordinary App Review demo
  account/instructions have been reconciled to the observed binary and network
  behavior.

Exit criteria:

- counsel-reviewed policies are live at final brand/domain URLs;
- health data, photo, cloud backup, commerce, community, Ask, analytics, and
  subscription consents are unbundled where required;
- account deletion and export copy matches live behavior.

## B-PRIVACY - Health data, photos, commerce, and AI privacy review

Status: `launch-blocked`

The app touches sensitive wellness/skin, face/photo, subscription, and possible
commerce data. Washington MHMDA, FTC health-app guidance, GDPR/UK/EU if
applicable, Apple/Google data policies, and affiliate disclosure rules need
review before launch.

The current `Withdraw health-data consent` behavior is not accepted as the
launch design. Withdrawal must stop future processing and revoke the applicable
purpose without silently converting into account deletion, destroying
unrelated account/store data, or retaining derived health state without a
documented basis. The exact local/server/cache/analytics/recommendation effects,
re-consent behavior, pending/offline work, export treatment, and legally
required retention need one reviewed non-destructive contract and live proof.

Exit criteria:

- DPIA or equivalent review complete for health data and photos;
- "photos never leave your device" is literally true unless explicit cloud
  backup consent is implemented;
- data-sharing consent is separate from collection consent where required;
- commerce disclosure language is counsel-approved;
- Ask/cloud transmission consent is final if cloud Ask ever launches.

## B-HEALTH-CONSENT-WITHDRAWAL - Non-destructive purpose withdrawal

Status: `launch-blocked`

Design and implement one source-of-truth state machine that distinguishes
withdrawal of health-data processing from account deletion. It must freeze new
health-dependent work before acknowledgement, cancel or reject stale in-flight
work, remove or quarantine data and derived state only according to the approved
purpose/retention matrix, preserve unrelated account and billing records, and
offer a truthful re-consent path without resurrecting data that was required to
be erased.

Exit criteria:

- counsel-approved consent/data-retention matrix names every local, Supabase,
  analytics, notification, recommendation, Ask, photo, export, backup, and
  processor effect;
- online, offline, interrupted, A-to-B, retry, re-consent, export, and account
  deletion interactions pass automated and human E2E tests;
- staging proves processor withdrawal/deletion and no stale health-derived
  result is published after withdrawal; and
- the exact Settings copy, privacy policy, App Privacy answers, and App Review
  instructions match observed behavior.

## B-LEGAL - Store, subscription, claims, and commerce legal review

Status: `launch-blocked`

Current implementation note:

- `docs/phase-3/store-metadata-review.md`,
  `docs/phase-3/app-review-notes.md`, and
  `docs/phase-3/google-play-health-declaration-notes.md` are draft review
  packets, not submission-ready artifacts.
- `apps/mobile/src/lib/legal/storeMetadata.ts` centralizes conservative draft
  store metadata, and tests scan it for Phase 3 claim risks.

Exit criteria:

- auto-renewal and cancellation copy reviewed;
- App Store / Play listing claims reviewed;
- affiliate disclosures reviewed;
- no unbuilt, simulated, or unreviewed feature is marketed as live;
- UGC/community/legal floor is approved before any peer posting launches.

## B-APP-REVIEW-PRIVACY - Exact privacy report, URLs, and reviewer access

Status: `launch-blocked`

Source manifests and draft policy packets do not establish what the frozen
release binary actually sends or stores, and placeholder links or a
short-lived/privileged account cannot support App Review.

Exit criteria:

- inspect the exact archived iOS build and reconcile its privacy manifest,
  required-reason APIs, SDK signatures, observed network/storage behavior, data
  inventory, retention, tracking/linkage, and App Privacy answers;
- publish final HTTPS Terms, Privacy, Consumer Health Data Privacy, Support,
  account-deletion, data-export, and privacy-choices URLs under the cleared
  identity, with uptime and device handoff verified;
- create a non-expiring ordinary production-like reviewer account and complete
  instructions/sample data for all 20 features, purchase/Restore, deletion,
  moderation, Ask, commerce, widgets, and links without exposing staff/admin or
  real-user data; and
- counsel approves the final report/answers and the exact review build passes
  reviewer-account and policy-link human E2E before submission.

## B-DERM-REVIEW - Clinical and cosmetic chemistry review

Status: `launch-blocked`

Review required for:

- conflict rules;
- pregnancy-related suppression/cautions;
- sequencing rules;
- retinoid ramp and active frequency caps;
- skin-cycling recovery logic;
- PAO category defaults;
- recommendation catalog;
- expert/derm stacks and Skin Notes;
- deterministic Ask answer corpus.

Current implementation note:

- `docs/phase-3/clinical-review-log.md` and
  `docs/phase-3/cosmetic-chemistry-review-log.md` are ready for reviewer
  signoff entries.
- Production gates are tested so unreviewed rules, PAO defaults, stacks, and
  Skin Notes stay hidden until reviewer metadata is recorded.

Exit criteria:

- reviewed rows/content have reviewer metadata or an equivalent record;
- production gates expose only reviewed rules/content;
- unsafe or uncertain guidance escalates to clinician language.

## B-PHASE3-SIGNOFF - Legal, clinical, chemistry, privacy, and IP signoff packet

Status: `launch-blocked`

Phase 3 implementation scaffolding is present, but no final signoff has been
obtained. This blocker exists to prevent a false "Phase 3 complete" label after
only local code/docs work.

Exit criteria:

- counsel signs the regulatory positioning, privacy/data inventory, policies,
  store metadata, subscription copy, commerce disclosure, and AI/Ask posture;
- dermatologist signs the rule/recommendation/Ask/Skin Notes corpus or records
  required changes;
- cosmetic chemist signs PAO defaults, ingredient taxonomy, product type
  caveats, and routine compatibility assumptions;
- privacy counsel and the technical security owner sign the data inventory,
  consent, processor, auth, deletion/export, analytics, and breach posture;
- IP counsel signs the onboarding quiz/FTO review;
- every released worklist item has one detached JSON signoff tied to its exact
  `reviewSnapshotSha256`, with a verified attestor credential or decision-owner
  role, explicit conditions and satisfaction state, and a retained original
  approval reference; deferred items also record an enforced production gate;
- Tas uses `npm run phase3:review-signoff-template -- --list` and item mode to
  prepare exact-digest drafts, then replaces every rejected placeholder with
  real externally verified evidence;
- `npm run phase3:audit-copy:strict` passes because placeholders and blocker
  markers have been removed or formally closed;
- generated review packet hashes and detached signoff records are archived with
  the original professional evidence.

## B-CATALOG-SEED - Product and ingredient catalog

Status: `launch-blocked`

The shelf and recommendation system needs real product data to become useful.

Current implementation note:

- Phase 4 catalog schema, source metadata, import batches, barcode tables,
  ingredient-list parse tables, quality grades, correction reports,
  contribution queue, and lookup observability tables exist locally.
- Mobile shelf rows now carry catalog source/quality/parse metadata, product
  detail shows source and quality, catalog search is wired through an Edge
  Function, and users can report catalog issues.
- `scripts/phase4/*` can run a fixture import and generated QA report. The
  fixture is not a production catalog.
- Open Beauty Facts contribution-back is intentionally not promised in the UI
  until the source workflow is legally and operationally approved.

Next action:

- verify CosIng access/licensing route;
- import Open Beauty Facts dumps with ODbL attribution/share-alike obligations;
- ingest barcode, brand, product name, category, INCI list, ingredient tags,
  PAO/expiry where available, and commerce links if commerce ships;
- hand-curate top products for launch quality;
- add match-rate observability.

Exit criteria:

- beta users get meaningful barcode/OCR/manual match outcomes;
- catalog miss/wrong-match reports are tracked;
- recommendations can reference real products where appropriate;
- OBF contribution-back obligations are handled or not promised.

## B-CATALOG-SOURCE-REVIEW - Catalog source, attribution, and API identity

Status: `launch-blocked`

Exit criteria:

- final app name, version, support email, domain, and attribution URL exist;
- `npm run phase4:check-source-env:strict` passes;
- CosIng source memo is reviewed;
- Open Beauty Facts source memo is reviewed;
- source attribution copy is approved under final brand.

## B-ODBL-REVIEW - Open Beauty Facts / ODbL posture

Status: `launch-blocked`

Exit criteria:

- counsel signs the ODbL/database-contents/image-license posture;
- any public derivative database/share-alike obligations have an owner;
- product images remain disabled unless image-rights handling is approved;
- bulk imports use exports, not API crawling;
- attribution is visible in product detail and policy/source pages.

## B-CURATED-CATALOG - First reviewed launch batch

Status: `launch-blocked`

Exit criteria:

- first curated batch is built from approved sources and beta shelves;
- product rows have source/ref/snapshot/provenance;
- recommendable rows are `verified` or `usable`, reviewed, and correction-free;
- sunscreen/OTC-adjacent products have separate review and expiry handling;
- import QA has zero blockers.

## B-CATALOG-COVERAGE - Beta catalog usefulness

Status: `launch-blocked`

Exit criteria:

- closed beta captures barcode/search/OCR/manual add paths;
- match rate, miss rate, wrong-match rate, parser unknown-token rate, and support
  tickets are reviewed;
- priority gaps are fed back into curation;
- users can complete the shelf-to-routine loop even when catalog matching fails.

## B-SHELF-CONTRIB - Unmatched product contribution-back

Status: `launch-blocked`

Exit criteria:

- unmatched product workflow is legally and operationally defined;
- user-facing copy does not promise contribution unless the pipeline exists;
- OBF obligations are satisfied if using OBF-derived data.

## B-PERFORMANCE - Performance baseline and scale evidence

Status: `needs-device-verification`

Local code gates and route E2E checks prove that supported layouts render and
that core flows are functionally reachable. They do not prove launch-grade
performance on real devices, live catalog/backend latency, or realistic local
photo volume.

Risk:

- slow app startup weakens first-session activation;
- slow product add time makes the shelf loop feel like work;
- high barcode lookup latency or unreliable camera acquisition weakens the scan
  magic moment;
- slow routine generation makes the first useful insight feel generic or
  broken;
- slow post-capture analysis makes a private progress-photo habit feel stalled,
  while analyzer timeouts can hide device-specific incompatibility;
- slow local photo loading or high memory use in photo timeline weakens the
  progress moat and can cause native crashes under real photo volume.

Next action:

- measure app startup time on supported iOS and Android physical devices;
- measure product add time for manual, search, barcode, and OCR/manual fallback
  paths;
- measure barcode lookup latency separately from camera acquisition and
  no-match recovery;
- measure routine generation time with 3, 5, and 10 product shelves;
- measure Progress photo capture-analysis latency
  (`photo_capture_analysis_ms`) from shutter confirmation until both review
  quality labels reach terminal measured or unavailable states;
- measure local photo loading and memory use in photo timeline with realistic
  encrypted local photo volume;
- set explicit beta pass/fail thresholds before recruiting testers;
- generate `docs/phase-5/performance-evidence.template.json`, define thresholds
  before the first run, record every raw observation, collect the complete
  supported-device artifact, run `phase5:performance-evidence:summarize`, and
  then run `PHASE5_PERFORMANCE_EVIDENCE_PATH=... npm run
phase5:performance-evidence:strict`;
- keep `npm run docs:performance-readiness-audit:check` passing after any
  performance-readiness doc or launch-gate change.

Exit criteria:

- a completed schema-v3 artifact passes
  `npm run phase5:performance-evidence:strict`;
- the artifact includes build IDs, device model/OS, at least five raw samples
  for every platform/metric pair, validator-calculated p50/p95/max, accepted
  predeclared thresholds, known caveats, and a real named signoff.

## B-CAMERA - Native camera, barcode, OCR, and guided photos

Status: `needs-device-verification`

Barcode and still-photo capture use native camera paths. Progress review now
uses on-device post-capture ML Kit face framing/pose analysis plus a temporary
local luminance/balance sample; synthetic readiness and quality scores have
been removed. Native OCR remains disabled, real-time preview analysis is not
implemented, and none of these paths is device-certified yet.

Exit criteria:

- custom dev build exists;
- camera permission, barcode, OCR, and progress photo capture work on supported
  physical iPhones;
- post-capture one/no/multiple-face, pose/alignment, luminance, uneven-light,
  timeout, and unavailable states pass a calibrated physical-device matrix;
- launch copy describes the current post-capture check, not real-time guidance
  or auto-capture;
- photo files are encrypted/local by default;
- no faceprint/template is stored;
- the release exposes no cloud-backup control or automatic photo-metadata/image upload;
- optional cloud backup remains excluded unless encrypted upload, retry,
  cross-device restore, object/metadata deletion, unbundled reviewed consent,
  network inspection, and physical-device QA ship together.

## B-NOTIF-VERIFY - Physical notification verification

Status: `needs-device-verification`

Scheduling code exists, but physical-device behavior is not verified.

Exit criteria:

- iOS latest and an oldest-supported iOS 17-class device pass per
  `docs/DEVICE_SUPPORT_POLICY.md`;
- timezone changes, quiet hours, reinstall, and lock-screen privacy pass;
- notification config plugin assets are included in native build.

## B-WIDGETS - Native widgets and live activities

Status: `launch-blocked`

In-app previews exist. Required WidgetKit and ActivityKit targets do not.

Exit criteria:

- implement WidgetKit and ActivityKit targets, App Group data sharing,
  timelines/lifecycle, privacy redaction, deep links, and failure behavior;
- pass the supported physical-iPhone matrix.

## B-ROUTINE-PERSIST - Server routine/cycle persistence

Status: `stubbed`

Local-first routine generation exists. Server authority and multi-device sync are
not required unless the product claims cross-device persistence; this does not
remove durable current-device behavior from the all-features release.

Current implementation note:

- Release routine, cycle, ramp, and completion surfaces are intentionally
  local-first. Morning/evening application-order overrides now persist in the
  encrypted current-owner store by stable shelf-product ID, survive relaunch and
  deterministic recompute, participate in account cleanup/export, and remain
  subordinate to phase, safety, cadence, and cycle-night authority. Active
  launch copy must keep that posture and must not promise cross-device routine
  sync until Supabase routine authority and cross-device product identity are
  implemented and tested.
- Exact-pair conflict choices are also encrypted and local-authoritative. Their
  owner-RLS `routine_conflicts` row is a checked best-effort mirror, not a retry
  queue or cross-device authority. Live migration, RLS, failure recovery, and
  reconciliation proof remain open before any sync claim.
- Cycle disruption configuration is encrypted local authority. Same-key
  mutations commit atomically and reconcile pause, recovery, skip, and local-day
  rollover before projection. Cross-device history, server reconciliation, and
  any continuity claim across devices remain deferred.

Exit criteria:

- either release copy clearly states local-first behavior, or server persistence is
  implemented and tested.

## B-DRAG-DND - Full routine drag/drop

Status: `inert`

Full drag/drop is not a V1 launch claim. The routine reorder route now uses
tap-to-select plus `Earlier` / `Later` controls over the generated plan, with
the docs/03 non-blocking sequencing nudge. It no longer needs a drag gesture to
be honest or usable.

Current implementation note:

- Keep public, paywall, store, and in-app copy from promising full
  drag-and-drop routine editing.
- If true drag gestures become a future claim, reopen this blocker for native
  gesture implementation, accessibility review, and device QA.

Exit criteria:

- V1: keep the tap-based reorder surface and no drag/drop public claim.
- Future true drag/drop: implement, test, and device-verify before marketing it.

## B-COMMERCE-RAIL - ShopMy or alternative commerce rail

Status: `inert`

Commerce is launch-required but must remain subordinate to the trust/core loop
and must never influence rankings.

The credential-free Order Report handler now follows ShopMy's documented
endpoint, Bearer authentication, registered-domain, zero-indexed pagination,
500-row limit, display-key wire response, bounded-read, and fail-closed
truncation contracts. However, the public Order Report documents no click-token
or click-ID field that can be safely joined to an OnSkin outbound click. The
adapter therefore persists `click_token = null` instead of guessing. ShopMy
remains blocked for attribution viability until the provider documents an
approved correlation field for the selected account/rail or a reviewed
alternative is chosen and proven live.

Exit criteria:

- rail selected and working;
- data-sharing consent finalized;
- FTC "paid link" style disclosure reviewed;
- attribution/order-report pipeline works;
- ranking remains independent from commission;
- live link validation, broken-link monitoring, order reconciliation, support,
  opt-out, and physical-iPhone handoff evidence pass.

## B-COMMUNITY-MOD - Human moderation and store floor

Status: `launch-blocked`

Peer posting must not launch without moderation operations.

Exit criteria:

- report, block, contact, EULA, content filter, human pre-moderation, and
  response SLA are staffed and tested;
- Apple UGC requirements are satisfied;
- health/medical claim moderation is reviewed.

## B-EXPERT-NETWORK - Reviewed expert content

Status: `launch-blocked`

Exit criteria:

- paid expert network recruited;
- expert notes and stacks reviewed;
- reviewer metadata recorded;
- stale or unreviewed content is gated out.

## B-AI-ONDEVICE - Real trend analysis engine

Status: `launch-blocked`

The safe current posture is no score, no age, no disease, no percentage
improvement. Do not market trend analysis as AI skin scoring.

Exit criteria:

- real on-device CV exists;
- MDC calibration and fairness validation pass;
- FDA/FTC/EU/app-store counsel review is complete;
- copy remains descriptive and no-score.

## B-AI-ASSISTANT - Cloud Ask vendor, safety, and legal gates

Status: `launch-blocked`

The deterministic local advisor can remain bounded. Cloud-grounded Ask must not
launch until vendor, RAG, safety, abuse/cost, and legal gates clear.

Exit criteria:

- zero-retention/no-training vendor contract;
- grounded RAG source corpus;
- layered safety guard;
- red-team eval thresholds;
- server-side cost caps;
- legal/privacy consent review;
- medical escalation behavior verified.

## B-GROWTH-LINK - Share-card domain and attribution

Status: `needs-device-verification`

The Shelf Conflict Card is a strong organic loop, but final brand/domain and
app/web fallback are blocked by `B-BRAND`.

Exit criteria:

- final domain and universal/app links work;
- non-users reach a useful web fallback and store path;
- UTM/channel attribution works;
- card export works in a native build;
- card copy remains claim-safe.

## B-CLOSED-BETA - Real demand proof

Status: `launch-blocked`

The seven-figure thesis is conditional until real users prove the core loop and
the complete iOS feature set.

Exit criteria:

- 50-100 real users complete beta;
- onboarding completion, product add rate, first useful insight, routine
  generation, Today check-off, baseline photo, reminders, payments, cloud Ask,
  commerce, community/moderation, trends, widgets/Live Activities, links,
  sharing, trial-to-paid, cancel/refund reasons, catalog miss rate, and support
  tickets are measured;
- no launch-blocking privacy, clinical, legal, payment, catalog, or trust issue
  remains.

## B-NATIVE-DEVICE-QA - Physical iPhone verification

Status: `needs-device-verification`

Phase 5 native code exists in repo, but no public or paid beta claim can rely on
it until an installable iOS build passes the physical-device matrix.

Exit criteria:

- EAS development and staging iOS builds have recorded build IDs;
- supported physical iPhones install and run the app across the declared iOS
  floor/current-device matrix;
- barcode, label capture, progress photo, encrypted save/restart/delete,
  notifications, share sheet, RevenueCat native smoke, Sentry native smoke, and
  Supabase catalog calls pass;
- generated `docs/phase-5/generated/device-qa-packet.md` has no blockers and
  is signed by a named tester.

## B-NATIVE-OCR - On-device text recognition

Status: `launch-blocked`

The current label path captures a real image and requires editable user text.
It does not claim native OCR while `EXPO_PUBLIC_NATIVE_OCR_ENABLED=false`.

Exit criteria:

- reviewed ML Kit or Apple Vision text-recognition module is selected;
- the iOS native build includes the module without missing-native-module errors;
- clear, curved, tiny, multilingual, and glare-heavy INCI labels pass beta QA;
- low-confidence words and user corrections remain visible;
- launch copy is updated only after device QA passes.

## B-FACE-POSE-SIGNALS - Reviewed guided-photo signal detector

Status: `needs-device-verification`

Progress photo capture uses real front-camera stills and encrypted storage.
Review performs transient on-device static-photo face framing/pose detection
and local luminance/balance analysis, while the camera preview overlay remains
static. Thresholds are provisional, so do not market calibrated precision,
real-time guidance, or auto-capture until privacy, performance, and device QA
pass for the implemented behavior.

Exit criteria:

- selected detector processes transient face bbox/pose/lighting only;
- no faceprint, embedding, identity vector, tracking ID, or raw frame stream is
  persisted;
- one/no/multiple-face, pose, dark/bright/uneven-light, timeout, and unavailable
  states pass the diverse-condition physical-device matrix without route
  crashes or repeatable false-positive quality labels;
- temporary lighting samples are deleted and network/observability inspection
  confirms image and analyzer data remain local;
- staging has deployed the photo-quality provenance migration and rejects
  quality/pose metadata without `post_capture_measurement` source;
- legal/privacy review approves any persisted coarse quality metadata.

## Practical Release Rule

Build and launch every feature in `docs/FEATURE_INDEX.md` and every required
surface in `docs/hugeToDo/launch-contract.json`. Prioritize the core value loop
and dependency chain, but do not hide, defer, simulate, or relabel an incomplete
required feature to satisfy launch. Keep it launch-blocked, complete the next
safe task, and retain the exact external dependency where a real person,
professional, vendor, physical iPhone, beta cohort, or Apple controls the gate.
