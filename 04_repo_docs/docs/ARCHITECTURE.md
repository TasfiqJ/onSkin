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

- Decision: shelf, completion, profile, cycle/ramp, and photos work locally; photos are device-only in the current build. Native content keys stay in SecureStore, encrypted reads never rotate missing/invalid keys or delete ciphertext, and failed-read snapshots block fallback overwrites. Opt-in app lock fails closed while its encrypted preference is unreadable, and one foreground-scoped photo-timeline unlock gates the Progress tab plus direct capture, review, and detail entries. After that unlock, every data-bearing Progress route must complete a successful encrypted metadata read before route content or photo mutations mount; read failure renders shared non-destructive recovery, never an empty or missing-photo fallback. Account export composes the owner-scoped server bundle with a sanitized snapshot of every registered local private-data record.
- Criteria: privacy, trust, offline bathroom use.
- Risk: multi-device sync and key recovery are delayed; genuine OS key loss makes local-only ciphertext unrecoverable.
- Status: active.

### A-004: Feature Flags For Risky Surfaces

- Decision: cloud Ask, trend insights, commerce, community posting, widgets, and advanced recommendations stay gated until ready.
- Criteria: app review, safety, privacy, trust.
- Risk: full-product ambition appears incomplete externally.
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
- Supabase user ID becomes stable app user identity.
- RevenueCat `appUserID` bound to Supabase user ID.
- Owner-scoped RLS on user tables.

## Deployment Notes

Environments:

- local: placeholders allowed, no production claims
- staging: live Supabase/RevenueCat/Sentry/PostHog, test stores
- production: final brand, final policies, reviewed rules, release candidate evidence

## Open Technical Questions

- [Open Question] Final brand and package identifiers.
- [Open Question] First launch countries and privacy law scope.
- [Open Question] Exact catalog seed source and size.
- [Open Question] Native OCR module choice.
- [Open Question] Whether professional/B2B workflow needs separate tenant model.
