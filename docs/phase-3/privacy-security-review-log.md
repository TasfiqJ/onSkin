# Privacy And Security Review Log

Status: no privacy or security content cleared  
Required reviewer: privacy counsel plus technical security owner  
Last updated: 2026-07-09

This log governs consumer health data, consent, photos, analytics,
observability, deletion/export, processors, auth, and incident/breach posture.
Do not mark privacy-sensitive launch gates complete until the row below has a
named reviewer, credential/role, date, exact source hash/version, decision, and
conditions.

## Review Rules

- Review must cover exact user-visible consent copy and the technical path that
  records, withdraws, exports, deletes, or shares the data.
- Privacy approval is separate from legal copy approval when a technical
  processor, storage path, or deletion/export behavior changes.
- Placeholder URLs, local-only fixtures, and non-live Edge Functions cannot be
  treated as final privacy evidence.
- Sensitive telemetry and crash payloads must be reviewed before production
  analytics or source-map upload is enabled.

## Inventory

| Area                                 | Source                                                                                                                                                                                                                                                       | Current production behavior                                  | Reviewer | Date | Status      | Notes                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------- | ---- | ----------- | -------------------------------------------------------------------------- |
| Health-data consent and withdrawal   | `docs/phase-3/consent-matrix.md`, `docs/store-privacy-inventory.md`, `apps/mobile/src/features/onboarding/consentCopy.ts`, `apps/mobile/src/lib/consent/*`, `apps/mobile/src/features/settings/actions.ts`, `supabase/functions/consent-withdrawal/index.ts` | Technical consent/withdrawal scaffolds; final copy blocked   | TBD      | TBD  | Blocked     | Must prove live ledger/RLS and final consumer-health notice.               |
| Photo privacy and local storage      | `docs/06-photo-progress.md`, `apps/mobile/src/features/photos/consent.ts`, `apps/mobile/src/features/photos/encryptedStorage.ts`, `apps/mobile/src/features/photos/store.ts`                                                                                 | Photos stay local by default; native device QA still needed  | TBD      | TBD  | Not cleared | Physical-device encryption/restart/delete and backup-off posture.          |
| Trend and cloud-backup consent       | `apps/mobile/src/features/trend/*`, `apps/mobile/src/features/photos/consent.ts`                                                                                                                                                                             | Opt-in UX exists; public launch blocked                      | TBD      | TBD  | Blocked     | Fairness/legal review and live consent ledger evidence are required.       |
| Ask, commerce, and community consent | `apps/mobile/src/features/ask/consent.ts`, `apps/mobile/src/features/commerce/consent.ts`, `apps/mobile/src/features/community/consent.ts`, `docs/phase-3/consent-matrix.md`                                                                                 | Separate local consent gates; placeholder legal copy remains | TBD      | TBD  | Blocked     | Vendor/partner sharing and withdrawal copy must be reviewed.               |
| Account deletion and data export     | `apps/mobile/src/features/settings/actions.ts`, `apps/mobile/src/lib/legal/policyLinks.ts`, `supabase/functions/account-deletion/index.ts`, `supabase/functions/data-export/index.ts`                                                                        | Edge Function scaffolds exist; live backend not verified     | TBD      | TBD  | Blocked     | Must work against live Supabase with owner-scoped RLS evidence.            |
| Analytics and crash payloads         | `apps/mobile/src/lib/analytics/*`, `apps/mobile/src/lib/observability/*`, `supabase/functions/growth-event/index.ts`                                                                                                                                         | Scrubbers/tests exist; production dashboards not live        | TBD      | TBD  | Not cleared | PostHog/Sentry setup, deletion process, source maps, and payload approval. |
| Auth and processor posture           | `apps/mobile/src/lib/auth/*`, `supabase/functions/_shared/auth.ts`, `docs/phase-3/data-inventory.md`                                                                                                                                                         | Auth/client scaffolds exist; live providers not configured   | TBD      | TBD  | Blocked     | Apple/Google auth, processors, breach posture, and RLS proof needed.       |

## Approval Template

When privacy/security review clears an item, add a row:

| Area | Source | Reviewer | Credential/role | Review date | Approved version/hash | Decision                               | Conditions |
| ---- | ------ | -------- | --------------- | ----------- | --------------------- | -------------------------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD             | TBD         | TBD                   | Approved / changes required / rejected | TBD        |

## Launch Rule

Any item with status other than approved remains blocked, hidden, placeholder
gated, or local-only. Privacy/security clearance must be tied to the generated
Phase 3 review packet for the exact build under review.
