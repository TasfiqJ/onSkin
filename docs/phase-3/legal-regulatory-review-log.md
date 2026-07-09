# Legal And Regulatory Review Log

Status: no legal or regulatory content cleared  
Required reviewer: qualified attorney with consumer health, subscriptions, privacy, advertising, and app-platform experience  
Last updated: 2026-07-09

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

## Inventory

| Area                              | Source                                                                                                                                                                            | Current production behavior                                      | Reviewer | Date | Status      | Notes                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- | ---- | ----------- | --------------------------------------------------------------------- |
| Regulatory launch classification  | `docs/phase-3/regulatory-positioning-memo.md`, `docs/legal-readiness.md`, `apps/mobile/src/lib/legal/disclaimer.ts`                                                               | Cosmetic routine/support posture; no diagnosis or scoring claims | TBD      | TBD  | Not cleared | Counsel must approve launch classification and forbidden-claim floor. |
| Launch claims vocabulary          | `docs/phase-3/launch-claims-vocabulary.md`, `apps/mobile/src/lib/legal/storeMetadata.ts`                                                                                          | Claim-safety tests exist; public copy remains review-gated       | TBD      | TBD  | Not cleared | Store, ads, screenshots, pushes, paywalls, and review replies.        |
| Store metadata and review notes   | `docs/phase-3/store-metadata-review.md`, `docs/phase-3/app-review-notes.md`, `docs/phase-3/google-play-health-declaration-notes.md`, `apps/mobile/src/lib/legal/storeMetadata.ts` | Draft only until final identity and URLs exist                   | TBD      | TBD  | Blocked     | Requires final brand, support/policy URLs, privacy labels.            |
| Subscription and cancellation     | `apps/mobile/src/features/subscription/*`, `apps/mobile/src/lib/iap/revenuecat.ts`                                                                                                | RevenueCat guarded; live products/restores not verified          | TBD      | TBD  | Not cleared | Auto-renew, restore, cancellation, trial, and win-back copy.          |
| Commerce and paid-link disclosure | `docs/phase-4/odbl-compliance-memo.md`, `apps/mobile/src/features/commerce/*`, `supabase/functions/order-report-poll/index.ts`                                                    | Rail inert unless consent, partner, source, and real links exist | TBD      | TBD  | Blocked     | FTC disclosure, partner data sharing, source rights, order reports.   |
| Ask and AI disclosures            | `docs/13-ask-onskin-assistant.md`, `apps/mobile/src/features/ask/*`                                                                                                               | Deterministic local answers; cloud Ask deferred                  | TBD      | TBD  | Blocked     | Vendor, AI disclosure, safety, privacy, and state-law review needed.  |

## Approval Template

When counsel clears an item, add a row:

| Area | Source | Reviewer | Credential | Review date | Approved version/hash | Decision                               | Conditions |
| ---- | ------ | -------- | ---------- | ----------- | --------------------- | -------------------------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD        | TBD         | TBD                   | Approved / changes required / rejected | TBD        |

## Launch Rule

Any item with status other than approved remains blocked, hidden, placeholder
gated, or non-final. Legal clearance must be tied to the generated Phase 3
review packet for the exact build under review.
