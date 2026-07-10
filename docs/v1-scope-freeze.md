# V1 Scope Freeze

Date: 2026-07-04

Objective: prove that real users will pay for the core loop before expanding
into commerce, community, cloud Ask, widgets, or AI trend analysis.

## Must Ship

| Surface                         | Why it matters                                                         | Launch condition                                                          |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Onboarding                      | Establishes skin goals, age gate, privacy posture, and activation path | Quiz/legal copy reviewed; age and consent gates work                      |
| Health-data and privacy consent | Required for trust and compliance                                      | Unbundled consents; policy URLs live                                      |
| Manual shelf intake             | Makes the app useful even when scanning misses                         | Users can add real owned products without fake catalog certainty          |
| Conflict detection              | Core paid value: avoid bad product stacking and confusion              | Rules clinically reviewed and production-gated                            |
| Routine builder                 | Turns shelf knowledge into daily behavior                              | Reviewed sequencing, ramp, and suppression logic                          |
| Today check-off                 | Creates habit and retention                                            | Local-first completion loop verified offline/online                       |
| Baseline photo timeline         | Lets users observe their own progress privately                        | Real capture or honest baseline-only scope; local-only claim remains true |
| Local reminders                 | Pulls users back into AM/PM routine                                    | Device delivery and quiet hours verified                                  |
| Paywall and entitlement gates   | Tests willingness to pay                                               | RevenueCat purchase/restore/webhook matrix passes                         |
| Privacy controls                | Needed for trust, store review, and health-data risk                   | Export, delete, consent withdrawal, and app lock verified                 |
| Shareable conflict card         | Organic growth loop tied to a real value moment                        | Final brand/domain, universal link, web fallback, and attribution work    |

## Should Ship If Ready

| Surface                          | Condition                                                                   |
| -------------------------------- | --------------------------------------------------------------------------- |
| Barcode scanning                 | Ship only if native camera and catalog match rate are reliable in beta      |
| OCR ingredient parsing           | Ship only if capture quality and parsing errors are honestly handled        |
| Basic product catalog matching   | Ship only after OBF/CosIng import and attribution obligations are clear     |
| Satisfaction-timed review prompt | Ship only after real value moments are instrumented                         |
| Universal/app link fallback page | Ship after final brand/domain decision                                      |
| Sentry and PostHog dashboards    | Ship after privacy review and deletion/account-linking behavior is verified |

## Explicitly Post-Launch

| Surface                              | Reason                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Live affiliate commerce              | Adds consent, FTC, retailer, and ranking-trust burden                           |
| Creator stacks                       | Needs expert network, review, and stronger catalog                              |
| Peer community posting               | Requires human moderation, report/block/contact/EULA, and legal review          |
| Cloud-grounded Ask assistant         | Requires vendor terms, RAG grounding, safety evals, cost caps, and legal review |
| Advanced on-device CV trend analysis | Requires real CV, fairness validation, device QA, and legal signoff             |
| Native widgets and live activities   | Nice retention feature, but not required to validate paid demand                |
| Referral program                     | Secondary to the conflict-card loop                                             |
| Multi-device sync engine upgrade     | Defer until core retention is proven                                            |

## Do Not Build Yet

| Surface                                            | Reason                                                 |
| -------------------------------------------------- | ------------------------------------------------------ |
| Open UGC feed                                      | High moderation/legal burden before trust exists       |
| Public before/after gallery                        | Privacy and deceptive-results risk                     |
| AI skin score, skin age, or percentage improvement | High legal, trust, and fairness risk                   |
| Paid ranking influenced by commission              | Breaks the trust thesis                                |
| Unreviewed clinical recommendations                | Unsafe and legally exposed                             |
| Cloud photo analysis                               | Not needed for V1 and conflicts with local-first trust |
| Fear-based growth copy                             | Undermines the differentiated calm/trust positioning   |

## V1 Value Loop

1. User adds products they already own.
2. App finds a conflict, sequencing issue, expiry issue, or routine improvement.
3. User follows a simple AM/PM routine.
4. User checks off days and captures a baseline/photo timeline.
5. User understands that the app is the trusted system of record for their
   shelf and routine.
6. User pays because the app reduces waste, irritation risk, confusion, and
   inconsistency.

## Scope Rule

New tasks are rejected unless they directly improve the V1 loop or clear a V1
launch gate in `LAUNCH_READINESS.md`.
