# IP And FTO Review Log

Status: no IP/FTO content cleared  
Required reviewer: qualified trademark, copyright, and product/FTO counsel  
Last updated: 2026-07-09

This log governs brand identity, quiz flow, competitor differentiation, source
rights, package identifiers, share-card marks, and store/domain posture. Do not
reserve production assets or mark IP/FTO complete until the relevant row below
has reviewer name, credential, date, exact source hash/version, decision, and
conditions.

## Review Rules

- Counsel must review exact naming, identifiers, store/domain/social
  reservations, screenshots, quiz flow, and public claim context.
- Approval is not implied by a web search or local brand audit.
- Source/license review for catalog data and images is separate from product
  quality review.
- Any final identity change reopens app config, Supabase callback, RevenueCat,
  store, policy URL, share-card, and public-copy review.

Before production clearance, every inventory row must be `Approved` or
`Deferred`. Approved rows require the named qualified reviewer and ISO review
date. Deferred rows require a named decision owner, ISO date, deferral reason,
and a production gate that keeps the surface hidden. `Blocked` and
`Not cleared` remain unresolved.

## Inventory

| Area                               | Source                                                                                                                                                                              | Current production behavior                              | Reviewer | Date | Status      | Notes                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------- | ---- | ----------- | ------------------------------------------------------------------------- |
| Brand and trademark clearance      | `docs/brand-decision-memo.md`, `docs/brand-evidence.md`, `apps/mobile/app.base.json`, `apps/mobile/app.config.js`                                                                   | RoutineKind is a working candidate only                  | TBD      | TBD  | Blocked     | Counsel, domain/store/package/social reservation evidence required.       |
| Native identifiers and callbacks   | `apps/mobile/app.base.json`, `apps/mobile/app.config.js`, `supabase/config.toml`                                                                                                    | Local/staging placeholders use RoutineKind defaults      | TBD      | TBD  | Blocked     | Final bundle ID, package ID, URL scheme, and auth callback allow-lists.   |
| Onboarding quiz FTO                | `docs/phase-3/quiz-fto-summary.md`, `apps/mobile/src/features/onboarding/quiz.ts`, `apps/mobile/src/app/onboarding/quiz.tsx`, `apps/mobile/src/app/onboarding/reveal.tsx`           | Placeholder quiz/profile copy remains launch-blocked     | TBD      | TBD  | Blocked     | Compare against SkinSort and competitor onboarding/typing flows.          |
| Public positioning differentiation | `docs/phase-3/regulatory-positioning-memo.md`, `docs/phase-3/store-metadata-review.md`, `docs/14-growth-to-seven-figures.md`                                                        | Draft positioning avoids diagnosis/scoring claims        | TBD      | TBD  | Not cleared | Confirm copy avoids competitor confusion and unsupported superiority.     |
| Catalog source and image rights    | `docs/phase-4/catalog-source-memo-cosing.md`, `docs/phase-4/catalog-source-memo-open-beauty-facts.md`, `docs/phase-4/odbl-compliance-memo.md`, `apps/mobile/src/features/catalog/*` | Fixture imports only; product images disabled            | TBD      | TBD  | Blocked     | ODbL/source/image-rights posture and attribution obligations.             |
| Share-card marks and deep links    | `apps/mobile/src/features/growth/*`, `docs/14-growth-to-seven-figures.md`, `docs/brand-decision-memo.md`                                                                            | Share cards gated by final identity and reviewed content | TBD      | TBD  | Blocked     | Final watermark, domain, Universal Links/App Links, and attribution copy. |

## Approval Template

When IP/FTO counsel clears an item, add a row:

| Area | Source | Reviewer | Credential | Review date | Approved version/hash | Decision                               | Conditions |
| ---- | ------ | -------- | ---------- | ----------- | --------------------- | -------------------------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD        | TBD         | TBD                   | Approved / changes required / rejected | TBD        |

## Launch Rule

Any item with status other than approved remains blocked, hidden, placeholder
gated, or candidate-only. IP/FTO clearance must be tied to the generated Phase 3
review packet for the exact build under review.
