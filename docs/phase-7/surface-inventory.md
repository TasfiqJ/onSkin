# Phase 7 Surface Inventory

Purpose: define what is visible in the closed-beta V1 loop, what is hard-hidden, and what evidence is required before a surface can be enabled.

## Production-visible core loop

| Surface                                          | Launch status                           | Why it belongs in V1                                                  | Evidence required                                                      |
| ------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Onboarding age/account/health consent            | Ship only after final copy              | Required for lawful data collection and support                       | Legal-approved copy, policy URLs, consent ledger QA                    |
| Shelf intake: scan, search, OCR fallback, manual | Ship                                    | This is the user's owned-product graph and the wedge into daily value | Real catalog seed, wrong-match/no-match flow, source/confidence labels |
| Shelf intelligence banner and conflict detail    | Ship only for reviewed rules            | Core differentiated value, but high liability                         | Clinical/legal signoff per rule, source citation, reviewedBy set       |
| Routine plan AM/PM                               | Ship                                    | Turns shelf intelligence into an actionable habit loop                | Local-first persistence, offline retry, timezone QA                    |
| Today check-off                                  | Ship                                    | Activation and retention metric                                       | Idempotent local store, duplicate prevention, append-only QA           |
| Progress photos                                  | Ship                                    | Retention and proof without AI scores                                 | Device-only/no-automatic-upload claims verified, app-lock QA           |
| Reminders                                        | Ship                                    | Habit support                                                         | Device permission QA, quiet hours, timezone/DST behavior               |
| Payments/entitlements                            | Ship only after Phase 6 strict evidence | Monetization                                                          | RevenueCat store QA, restore, webhook, lifecycle states                |
| Privacy controls                                 | Ship                                    | Trust, policy compliance, support deflection                          | Export/delete/withdraw/app-lock QA                                     |
| Recommendations                                  | Ship structural/type-first only         | Helpful without commerce dependency                                   | No commission ranking, goal-active recs hidden unless reviewed         |

## Deferred or hard-hidden by default

| Surface                               | Default flag                                                                                                                  | Current behavior                                                               | Required to enable                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Commerce and shoppable routines       | `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=false`; production also requires a real final brand domain                               | Routes show deferred beta screen; where-to-buy rows return null                | Final brand domain, source-cleared catalog, FTC copy, paid-link rail QA, no commission input |
| Community posting and people-like-you | `EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED=false`; production also requires a real final brand domain                      | Skin Notes stays read-only; posting/aggregate routes show deferred beta screen | Final consent copy, moderation desk, legal review, support process, beta density             |
| Photo trend insights                  | `EXPO_PUBLIC_PHASE7_TREND_ENABLED=false`; production also requires a real final brand domain                                  | Trend routes and entry points hidden/deferred                                  | Device QA, fairness review, final consent copy, no score/diagnosis claims                    |
| Cloud Ask                             | `EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED=false`; production also requires a real final brand domain                              | Ask routes and Today/You entry points hidden/deferred                          | Model/privacy policy review, no sensitive logs, support escalation, observability            |
| Widgets and live activities           | `EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED=false`; production also requires a real final brand domain                                | Widget route shows deferred beta screen; You entry hidden                      | iOS/Android native QA, notification permission QA, check-off idempotency                     |
| Shelf Conflict Card                   | `EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED=false` plus reviewed conflict flag; production also requires a real final brand domain | Share route deferred; conflict sheet hides launcher                            | Final brand domain, reviewed rule, owned-product exact match, 1080x1920 export QA            |
| Goal-active recommendations           | `EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED=false`; production also requires a real final brand domain            | Production catalog gate strips unreviewed medical-adjacent actives             | Clinical review, reviewedBy, source-cleared catalog, claim-safe copy                         |

## Implemented code controls

- `apps/mobile/src/lib/launch/phase7.ts` centralizes Phase 7 flags and share-card eligibility.
- Production Phase 7 surfaces also require a real final brand domain at runtime, and Phase 9 release smoke blocks production public flags unless the matching `PHASE7_*` evidence plus `PHASE7_SIGNED_OFF_BY` is present.
- `apps/mobile/src/components/launch/DeferredSurface.tsx` gives disabled routes a plain beta-unavailable state.
- Route groups gated: `/commerce`, `/trend`, `/ask`.
- Screen-level gates: `/community/ask`, `/community/people-like-you`, `/routine/widgets`, `/share/conflict/[ruleId]`.
- Entry-point gates: Today Ask teaser, Progress trend insight, Progress no-score trend CTA, You tab deferred rows, where-to-buy affordance.
- Share cards require `phase7Flags.shareCard`, exact `ruleId` match, and `conflict.rule.reviewedBy`.

## Seven-figure readiness test

The app can plausibly become a seven-figure product only if the beta proves:

- Activation: users add at least 3 real owned products and complete a Today check-off.
- Retention: users return for routine check-offs and photo timeline without needing speculative AI scores.
- Trust: reviewed guidance and honest no-result states reduce confusion rather than create fear.
- Monetization: users see value before paywall and RevenueCat entitlement QA is clean.
- Support load: export/delete/withdraw/account/payment cases are understandable and operational.

Until those metrics are measured, Phase 7 is a closed-beta candidate, not a public-scale launch.
