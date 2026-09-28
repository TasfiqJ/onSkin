# Legal And Regulatory Review Log

Status: no legal or regulatory content cleared  
Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience  
Last updated: 2026-07-26

This log is the source of truth for legal/regulatory launch clearance. Do not
mark store copy, subscription copy, paid-link copy, AI disclosures, policy
links, or launch claims as approved until the relevant row below has reviewer
name, credential, date, exact source hash/version, decision, and conditions.

## Review Rules

- Counsel must review exact app copy, store copy, screenshots, paywall context,
  consent context, and linked policy/support surfaces.
- Approval is source-specific. Any copy or behavior change after approval
  reopens the row.
- Legal approval does not replace dermatology, cosmetic chemistry, privacy,
  security, or IP/FTO review where those are separately required.
- Placeholder URLs, placeholder consent versions, and simulated services cannot
  be submitted as final evidence.

Before production clearance, every inventory row must be `Approved` or
`Deferred`. Approved rows require the named qualified reviewer and ISO review
date. Deferred rows require a named decision owner, ISO date, deferral reason,
and a production gate that keeps the surface hidden. `Blocked` and
`Not cleared` remain unresolved.

## Inventory

| Area                              | Source                                                                                                                                                                                                                                            | Current production behavior                                                       | Reviewer | Date | Status      | Notes                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- | ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Regulatory launch classification  | `docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md`, `docs/phase-3/regulatory-positioning-memo.md`, `docs/legal-readiness.md`, `apps/mobile/src/lib/legal/disclaimer.ts`                                                               | Cosmetic routine/support posture; medical-adjacent functions remain gated         | TBD      | TBD  | Not cleared | Counsel must classify every exact release function and intended-use/claim surface; a disclaimer is not a device-classification safe harbor.  |
| Launch claims vocabulary          | `docs/phase-3/launch-claims-vocabulary.md`, `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md`, `apps/mobile/src/lib/legal/storeMetadata.ts`                                                                                      | Claim-safety tests exist; public copy remains review-gated                        | TBD      | TBD  | Not cleared | Review health/cosmetic/drug claims and jurisdictional handling in addition to store, ads, screenshots, pushes, paywalls, and review replies. |
| Store metadata and review notes   | `docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md`, `docs/phase-3/store-metadata-review.md`, `docs/phase-3/app-review-notes.md`, `docs/phase-3/google-play-health-declaration-notes.md`, `apps/mobile/src/lib/legal/storeMetadata.ts` | Draft only until final identity, archive, services, reviewer path, and URLs exist | TBD      | TBD  | Blocked     | Requires final brand, support/policy URLs, privacy labels, medical-device declaration, IAP, reviewer access, and exact-build evidence.       |
| Subscription and cancellation     | `apps/mobile/src/features/subscription/*`, `apps/mobile/src/lib/iap/revenuecat.ts`                                                                                                                                                                | RevenueCat guarded; live products/restores not verified                           | TBD      | TBD  | Not cleared | Auto-renew, restore, cancellation, trial, and win-back copy.                                                                                 |
| Commerce and paid-link disclosure | `docs/phase-4/odbl-compliance-memo.md`, `apps/mobile/src/features/commerce/*`, `supabase/functions/order-report-poll/index.ts`                                                                                                                    | Rail inert unless consent, partner, source, and real links exist                  | TBD      | TBD  | Blocked     | FTC disclosure, partner data sharing, source rights, order reports.                                                                          |
| Ask and AI disclosures            | `docs/13-ask-layerwell-assistant.md`, `apps/mobile/src/features/ask/*`                                                                                                                                                                               | Local path exists; required cloud path launch-blocked                             | TBD      | TBD  | Blocked     | Vendor, AI disclosure, safety, privacy, and state-law review needed.                                                                         |

## Approval Template

When counsel reaches a release decision, update the matching Inventory row and
add one JSON record under `docs/phase-3/signoffs/` using
`docs/phase-3/review-signoff.template.json`. The JSON record, not a second table
row, is the machine-readable credential and conditions evidence.

| Area | Source | Reviewer | Credential | Review date | Review snapshot SHA-256 | Decision            | Conditions |
| ---- | ------ | -------- | ---------- | ----------- | ----------------------- | ------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD        | TBD         | TBD                     | Approved / Deferred | TBD        |

## Launch Rule

Any item not approved remains blocked, hidden, placeholder-gated, or non-final.
`Deferred` may coexist with release only when its production surface is
excluded and the detached signoff records the reason and owner. Legal clearance
must be tied to the generated Phase 3 review snapshot for the exact source
hashes under review.
