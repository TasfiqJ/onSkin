# Phase 7 Launch Claim Matrix

Purpose: every public or in-app launch claim must map to product evidence. Claims without evidence stay out of production copy.

| Claim                          | Launch wording allowed                                             | Evidence                                                                     | Status                                               |
| ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Local-first routine check-offs | "Check off your routine, even offline."                            | `completionsStore`, duplicate/idempotency QA, Today tests                    | Code present, device QA still required               |
| Owned-product shelf            | "Build a shelf from products you own."                             | Manual/search/scan/OCR intake, source/confidence metadata                    | Code present, catalog beta import still required     |
| Ingredient conflict guidance   | "Reviewed shelf checks can spot pairings to separate."             | `reviewedBy` on every surfaced rule, source citation, legal review           | Blocked: starter rules are not reviewed              |
| No AI skin score               | "No scores, grades, or age guesses."                               | Progress photo copy and claim-safety tests                                   | Code present                                         |
| Device-only photo storage      | "Photos stay encrypted on this device unless you share one."       | Local file store, no automatic upload path or backup control, app-lock flow  | Code present, native QA still required               |
| Encrypted cloud backup         | No launch wording allowed                                          | Encrypted upload/retry, restore, remote deletion, consent, policy, device QA | Future only; unavailable in current V1               |
| Payments                       | "Pro unlocks protected photo timeline and advanced routine tools." | RevenueCat offerings, restore, webhook, entitlement lifecycle                | Code present, strict store QA still required         |
| Privacy controls               | "Export, delete, or withdraw consent from settings."               | Settings actions, Edge Functions, support URLs                               | Code present, external QA still required             |
| Commerce independence          | "Recommendations are not ranked by commission."                    | No commerce fields in recommendation engine, visible disclosure when enabled | Code present, commerce hidden                        |
| Community                      | "Read expert Skin Notes."                                          | Reviewed notes only in production                                            | Read-only can ship after note review; posting hidden |
| Share cards                    | "Share a claim-safe shelf card."                                   | Final domain, reviewed rule, exact owned conflict, export QA                 | Blocked by default                                   |

## Forbidden launch claims

- Do not claim diagnosis, treatment, cure, prevention, clinical outcome, age estimate, percent improvement, severity score, or disease detection.
- Do not claim "AI dermatologist", "medical advice", "doctor-reviewed" without named review evidence.
- Do not imply cloud backup exists in current V1. Explicit user-initiated photo sharing is the only current off-device photo path.
- Do not imply commerce is live while shoppable routes are gated.
- Do not imply community posting or peer matching is live while moderation/legal gates are open.
- Do not imply widgets/live activities are available until native builds pass device QA.

## Required production substitutions

- If no reviewed conflict exists: "No reviewed shelf check is available yet."
- If goal-active recommendations are gated: "Your essentials are covered. New active suggestions are still under review."
- If commerce is gated: hide buy links and partner-sharing consent rows.
- While PHOTO-05A Trend admission is zero: keep the private photo timeline and
  no-score explainer; render no opt-in, result card, change narrative,
  fairness-result claim, metric, or Trend content analytics. Do not describe a
  deterministic fallback or historical fixture as an engine.
