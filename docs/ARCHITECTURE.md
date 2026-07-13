# Architecture

## Selected Architecture

[Decision under uncertainty] Continue with the current Expo React Native monorepo, Supabase/Postgres backend, RevenueCat subscriptions, PostHog analytics, and Sentry crash reporting.

This decision is based on product fit and current repo momentum, not loyalty to a stack. Any future replacement must use the Master Plan Update Patch process.

## Alternatives Considered

| Architecture                       | Strengths                                                                                   | Weaknesses                                                           | Verdict     |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------- |
| Expo RN + Supabase + RevenueCat    | Fast mobile shipping, existing repo fit, strong TypeScript reuse, good subscription tooling | Native camera/OCR/widgets require custom build QA                    | Keep        |
| Native Swift/Kotlin + Postgres API | Best native camera/device control                                                           | Too slow and costly for solo/small team                              | Avoid now   |
| Flutter + Supabase                 | Good cross-platform option                                                                  | Rewrite cost, smaller current repo fit                               | Backup only |
| Firebase + RN                      | Fast auth/storage                                                                           | Weak fit for relational catalog/rules graph, per-operation cost risk | Avoid       |
| Web/PWA first                      | Cheap iteration                                                                             | Poor native camera/IAP/App Store fit                                 | Avoid       |

## Decision Records

### A-001: Keep Mobile-First App

- Decision: mobile app remains primary surface.
- Criteria: camera, photo progress, reminders, subscriptions, store discovery.
- Risk: native QA burden.
- Status: active.

### A-002: Deterministic Safety Logic

- Decision: ingredient/routine/safety rules must be deterministic and reviewed.
- Criteria: liability, trust, explainability.
- Risk: slower rule expansion.
- Status: active.

### A-003: Local-First Sensitive Data

- Decision: shelf, completion, profile, cycle/ramp, and photos work locally; photos are device-only in the current build. Native content keys stay in SecureStore, encrypted reads never rotate missing/invalid keys or delete ciphertext, and failed-read snapshots block fallback overwrites. Private-KV envelope validation excludes only known Supabase auth-storage keys; malformed or unsupported app-owned envelopes block before app content mounts, remain byte-identical, count as orphaned ciphertext, and cannot be replaced after a concurrent snapshot change. Same-key mutations serialize, queued mutations remain inside account-boundary draining, and private read/write/removal APIs reject Supabase auth and content-key namespaces. Opt-in app lock fails closed while its encrypted preference is unreadable; a malformed preference can be removed only through an explicit device-authenticated reset that deletes that setting alone. One foreground-scoped photo-timeline unlock gates the Progress tab plus direct capture, review, and detail entries. After that unlock, every data-bearing Progress route must complete a successful encrypted metadata read before route content or photo mutations mount; read failure renders shared non-destructive recovery, never an empty or missing-photo fallback. Account changes unmount this data-bearing tree, verify a hashed local owner, persist a cleanup-required control across partial deletion, block/drain account-scoped private reads and mutations, clear query memory before and after registered cleanup, and fail closed before publishing the latest target session. Account export composes the owner-scoped server bundle with a sanitized snapshot of every registered local private-data record. One cancellable account-generation lease covers owner capture through temporary plaintext deletion; a real account boundary aborts the Edge request, blocks new exports, drains active export cleanup, and rejects stale writes or shares before the next session can publish.
- Recovery ordering: photo add/delete/clear mutations use an owner-bound two-phase local journal with exact owned paths. Cold startup verifies the persisted owner, replays or retains that journal, and only then scavenges temporary plaintext; route content, app lock, and offline work stay blocked when recovery is unavailable. Ordinary photo/key reads remain side-effect-free. Native process-kill and protected-filesystem proof remains an external verification gate.
- Criteria: privacy, trust, offline bathroom use.
- Risk: multi-device sync and key recovery are delayed; genuine OS key loss makes local-only ciphertext unrecoverable.
- Status: active.

### A-004: Feature Flags For Risky Surfaces

- Decision: cloud Ask, trend insights, commerce, community posting, widgets,
  Live Activities, and advanced recommendations remain fail-closed until ready,
  but each is required in the iOS launch binary and must pass its complete
  enabled-state gate before submission. A flag is an incident control, not a
  substitute for implementation.
- Criteria: app review, safety, privacy, trust.
- Risk: full-product ambition appears incomplete externally.
- Status: active.

### A-006: iOS-Only All-Features Release Contract

- Decision: the release platform is iOS and every feature ID 1-20 plus every
  Phase 7/8 surface in `docs/hugeToDo/launch-contract.json` is required.
  Android code may remain healthy, but Android credentials, builds, device or
  store evidence, payments, links, performance, beta, and release approval are
  not launch gates. Google OAuth remains required for Google Sign-In on iPhone.
- Criteria: founder directive, one auditable scope, no fake Android evidence,
  and no hidden/inert feature counted as complete.
- Risk: the larger launch surface expands native, backend, privacy, review,
  moderation, reliability, and operational dependencies.
- Status: active.

### A-005: One Fail-Closed Pregnancy-Safety Profile Contract

- Decision: the encrypted local skin profile is the V1 authority for pregnancy/breastfeeding status, and it can be read or changed only with a granted consent record whose version and SHA-256 text hash match the current health-data copy. Malformed or unreadable local profile/consent records are preserved and fail closed; they never trigger a server fallback. When no local profile exists, the newest server profile may supply non-safety axes/goals, but its pregnancy status is always treated as unknown because a local V1 edit may be newer. Shelf, Plan, scheduler, Today, recommendations, and conflict explanations consume the shared `ProfileBits` reader. Only a successfully read explicit local `none` clears caution; affirmative, prefer-not, unknown, missing, and unavailable states remain cautious without an inferred pregnancy claim. Exclusions are derived from the launch-gated docs/02 safety rules, not a parallel table: production accepts only rules carrying recorded review metadata, while development/staging can exercise starter rules for review. Eligible reviewed rules remove retinoids and hydroquinone and remove BHA unless every threshold-bearing active percentage is unambiguously tag-associated and confirmed low, before sequence, cadence, cycle, ramp, replacement recommendations, or Today. If the separate cadence review gate is closed, all treatment/exfoliant placement is withheld instead of becoming an unassigned daily step. Writes persist locally first, disable competing selection input while pending, and invalidate every dependent query.
- Criteria: no contradictory Plan/Today output, no fail-open default, no inferred health status, offline determinism, and one explainable exclusion path.
- Risk: V1 does not yet define a clinically reviewed status-refresh interval or transactional server mirror; multi-device status reconciliation remains deferred. No production release may mark the starter exclusion/cadence data reviewed without the detached Phase 3 signoff process.
- Status: active.

## System Architecture

```text
apps/mobile
  UI routes and feature modules
  local-first stores
  deterministic client mirrors

Supabase
  Auth
  Postgres
  RLS
  Edge Functions
  catalog/rules/routine data

RevenueCat
  IAP purchases
  offerings
  entitlements
  webhook -> Supabase Edge Function

External data
  Open Beauty Facts exports/API
  CosIng ingredient data

Observability
  PostHog events, consented/scrubbed
  Sentry crash reports, scrubbed
```

## Database Model

Core tables:

- `profiles`
- `skin_profiles`
- `consents`
- `user_products`
- `products`
- `ingredients`
- `product_ingredients`
- `conflict_rules`
- `routine_conflicts`
- `routines`
- `routine_steps`
- `routine_completions`
- `photos`
- `notification_preferences`
- `entitlements`
- `subscription_events`
- `catalog_reports`

## API Structure

Supabase Edge Functions:

- catalog lookup/search/report
- account deletion
- data export
- consent withdrawal
- RevenueCat webhook
- subscription grants
- public waitlist/support/share routes

Client APIs:

- feature modules call local stores first where privacy/offline matters
- Supabase queries only when configured and consented
- Pro gates read RevenueCat/Supabase entitlement mirror

## Auth Model

- Anonymous-first onboarding.
- Apple/Google native ID tokens link to an active anonymous session with
  `linkIdentity`; email attaches with `updateUser` and completes with an
  `email_change` OTP. If a development project auto-confirms that same-user
  email update, the route completes immediately instead of asking for a code
  that was never sent.
- Provider and email account upgrades assert that the Supabase user ID remains
  unchanged and that the resulting identity is permanent.
- A linking conflict fails closed. The app never falls back to a normal sign-in
  while preserving anonymous-session data because that fallback can switch the
  user ID and trigger local-private-data cleanup.
- Normal Apple/Google/email sign-in remains available when there is no active
  anonymous session to preserve.
- Sign-out, a changed user ID, a signed-out restore with retained owner metadata,
  or a cold-start owner mismatch cannot render account data until prior queries,
  registered local records, vendor
  identities, and in-flight private-record/photo writes are isolated and
  cleared. Explicit sign-out also removes persisted auth; account deletion delegates
  to this root boundary once. Rapid auth events serialize, a durable cleanup-required
  control forces retry after partial deletion, and session-restore or cleanup failure
  remains behind a retry gate. A domain-separated owner hash is stored locally
  instead of the raw Supabase user ID.
- Supabase user ID becomes stable app user identity.
- RevenueCat `appUserID` bound to Supabase user ID.
- Owner-scoped RLS on user tables.

## Deployment Notes

Environments:

- local: placeholders allowed, no production claims
- staging: live Supabase/RevenueCat/Sentry/PostHog, test stores
- production: final brand, final policies, reviewed rules, release candidate evidence

Release validators and packet builders must read
`docs/hugeToDo/launch-contract.json`. Platform-specific evidence is required
only for a platform listed in that contract; every cross-platform service used
by the iOS app remains fully in scope.

## Open Technical Questions

- [Open Question] Final brand and package identifiers.
- [Open Question] First launch countries and privacy law scope.
- [Open Question] Exact catalog seed source and size.
- [Open Question] Which production iOS OCR module best satisfies the required
  accuracy, privacy, binary, and device-performance gates.
- [Open Question] Whether professional/B2B workflow needs separate tenant model.
