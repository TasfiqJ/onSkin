# Phase 7 Surface Inventory

Purpose: define what is visible in the closed-beta V1 loop, what is hard-hidden, and what evidence is required before a surface can be enabled.

## Production-visible core loop

| Surface                                          | Launch status                             | Why it belongs in V1                                                  | Evidence required                                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding age/account/health consent            | Ship only after final copy                | Required for lawful data collection and support                       | Legal-approved copy, policy URLs, consent ledger QA                                                                                                 |
| Shelf intake: scan, search, OCR fallback, manual | Ship                                      | This is the user's owned-product graph and the wedge into daily value | Real catalog seed, wrong-match/no-match flow, source/confidence labels                                                                              |
| Shelf intelligence banner and conflict detail    | Ship only for an admitted reviewed corpus | Core differentiated value, but high liability                         | Exact-version corpus receipts from the required reviewers, claim-to-source citations, and runtime admission; a `reviewedBy` string is not authority |
| Routine plan AM/PM                               | Ship                                      | Turns shelf intelligence into an actionable habit loop                | Local-first persistence, offline retry, timezone QA                                                                                                 |
| Today check-off                                  | Ship                                      | Activation and retention metric                                       | Idempotent local store, duplicate prevention, append-only QA                                                                                        |
| Progress photos                                  | Ship                                      | Retention and proof without AI scores                                 | Device-only/no-automatic-upload claims verified, app-lock QA                                                                                        |
| Reminders                                        | Ship                                      | Habit support                                                         | Device permission QA, quiet hours, timezone/DST behavior                                                                                            |
| Payments/entitlements                            | Ship only after Phase 6 strict evidence   | Monetization                                                          | RevenueCat store QA, restore, webhook, lifecycle states                                                                                             |
| Privacy controls                                 | Ship                                      | Trust, policy compliance, support deflection                          | Export/delete/withdraw/app-lock QA                                                                                                                  |
| Recommendations                                  | Ship structural/type-first only           | Helpful without commerce dependency                                   | No commission ranking, goal-active recs hidden unless reviewed                                                                                      |

## Deferred or hard-hidden by default

| Surface                               | Default flag                                                                                                                                                                    | Current behavior                                                                                                                                                                                                                                        | Required to enable                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commerce and shoppable routines       | `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=false`; production also requires a real final brand domain                                                                                 | Routes show deferred beta screen; where-to-buy rows return null                                                                                                                                                                                         | Final brand domain, source-cleared catalog, FTC copy, paid-link rail QA, no commission input                                                                                                                                                                                                                                                                    |
| Community posting and people-like-you | `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED=false`; production also requires a real final brand domain                                                                        | Skin Notes stays read-only; posting/aggregate routes show deferred beta screen                                                                                                                                                                          | Final consent copy, moderation desk, legal review, support process, beta density                                                                                                                                                                                                                                                                                |
| Photo trend insights                  | Literal `phase7Capabilities.trendEngine=false` and `phase7Flags.trend=false`; machine `trendInsightAdmission` records no engine/issuer/calibration/fairness authority or admitted side effect                                                   | PHOTO-05A removes simulated output and Progress/consent entry points. Direct routes show only truthful unavailable recovery. Environment, development, E2E, consent, positive-delta, tone, fixture, legacy-state, domain, and QA inputs cannot override zero admission. Explicit legacy withdrawal cleanup remains available but cannot activate Trend. | A real on-device result issuer; exact measurement/calibration/failure contract; predeclared diverse-condition fairness evidence; reviewed consent, withdrawal, retention, export, backup and claim copy; archive-identical local-only proof; supported-iPhone/accessibility/performance evidence; and named exact-source professional/legal/privacy/release signoffs |
| Cloud Ask                             | `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=false`; production also requires a real final brand domain                                                                                | Ask routes and Today/You entry points hidden/deferred                                                                                                                                                                                                   | Model/privacy policy review, no sensitive logs, support escalation, observability                                                                                                                                                                                                                                                                               |
| Widgets and live activities           | `EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED=false`; hard `phase7Capabilities.nativeWidgets=false`; signed publication/start flags `false`                                               | `/routine/widgets` always shows the unavailable recovery route; ordinary builds omit the extension and Live Activity advertisement                                                                                                                      | Final identity, reviewed macOS compile and disabled signed-archive inspection, controlled enablement, and the supported physical-iPhone IOS-02 matrix; Android is non-launch scope                                                                                                                                                                              |
| Shelf Conflict Card                   | Machine contract: share/public-link admission, receipt issuer, token service, raw/private fields, and analytics all closed; Phase 7/8 flags and final domain cannot override it | CORE-07A returns before projection export, capture, file, link, network, native share, or analytics. The renderer accepts only a constructed sanitized projection, never the private conflict object. Every public identifier is neutrally unavailable. | A separate immutable share-admission receipt bound to exact conflict/copy/citations/market/projection/rights/review/expiry/revocation bytes; exact-payload confirmation; a separately reviewed public-token lifecycle; `REV-02` through `REV-06` decisions and `REV-07` detached signoffs; final domain; hosted/native/accessibility/failure and 1080 x 1920 QA |
| Goal-active recommendations           | `EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED=false`; product-specific recommendation admission is separately closed                                                  | CORE-06A admits no goal-active output or catalog product                                                                                                                                                                                                | Server-minted current goal authority, exact admitted product/market/claim receipts, qualified clinical/chemistry/regulatory review, source-cleared catalog, and claim-safe copy                                                                                                                                                                                 |

## Implemented code controls

- `apps/mobile/src/lib/launch/phase7.ts` centralizes Phase 7 flags, but
  `features/growth/shareAdmission.ts` is the independent publication authority;
  the current issuer registry is empty and production admission is literal
  false.
- `features/growth/shareProjection.ts` constructs the only renderer input from
  an explicit field allowlist; `ConflictCard` cannot receive a private
  `DetectedConflict`.
- `features/growth/publicLinkAdmission.ts` is a separately closed token
  authority. No current token service exists, so syntax never implies a record.
- Production Phase 7 surfaces also require a real final brand domain at runtime, and Phase 9 release smoke blocks production public flags unless the matching `PHASE7_*` evidence plus `PHASE7_SIGNED_OFF_BY` is present.
- `apps/mobile/src/components/launch/DeferredSurface.tsx` gives disabled routes a plain beta-unavailable state.
- PHOTO-05A treats the former enabled fixture and deterministic `consistent`
  fallback as historical only. Disabled hooks do not read photo getters,
  consent, profile, Monk tone, Trend storage, or network state; do not evaluate
  deltas/MDC/fairness/narratives; and do not emit Trend content analytics.
  A positive grant refuses before mutation. Data-rights cleanup of legacy
  state remains separate from feature admission.
- Route groups gated: `/commerce`, `/trend`, `/ask`.
- Screen-level gates: `/community/ask`, `/community/people-like-you`, `/routine/widgets`, `/share/conflict/[ruleId]`.
- Entry-point gates: Today Ask teaser, Progress trend insight, Progress no-score trend CTA, You tab deferred rows, where-to-buy affordance.
- Earlier combined flag/review/domain routing is not authority. CORE-07A now
  refuses independently even when those inputs appear enabled, and its source
  contract rejects any path that reaches capture, temporary file, URL/network,
  native share, record-implying public copy, or analytics.
- A future positive share still requires a real immutable issuer and exact
  payload confirmation before the share sheet; a future public link still
  requires a separate reviewed token/retention/revocation/deletion/abuse
  service. No flag or domain may substitute for either gate.

## Seven-figure readiness test

The app can plausibly become a seven-figure product only if the beta proves:

- Activation: users add at least 3 real owned products and complete a Today check-off.
- Retention: users return for routine check-offs and photo timeline without needing speculative AI scores.
- Trust: reviewed guidance and honest no-result states reduce confusion rather than create fear.
- Monetization: users see value before paywall and RevenueCat entitlement QA is clean.
- Support load: export/delete/withdraw/account/payment cases are understandable and operational.

Until those metrics are measured, Phase 7 is a closed-beta candidate, not a public-scale launch.
