# Clinical Review Log

Status: no clinical content cleared  
Required reviewer: board-certified dermatologist or equivalent qualified clinician  
Last updated: 2026-07-10

This log is the source of truth for marking content as reviewed. Do not set `reviewedBy` or similar fields in code until the row below has reviewer name, credential, date, scope, and status.

## Review Rules

- Reviewers must see exact app copy, context, and screenshots where applicable.
- Reviewers must approve the specific claim, not a broad feature concept.
- Any edit after approval reopens review.
- Reviewer identity and date must be preserved in docs and code.
- Medical, disease, dosage, diagnosis, treatment, or emergency language is out of launch scope.

Before production clearance, every inventory row must be `Approved` or
`Deferred`. Approved rows require the named qualified reviewer and ISO review
date. Deferred rows require a named decision owner, ISO date, deferral reason,
and a production gate that keeps the surface hidden. `Blocked` and
`Not cleared` remain unresolved.

## Content Inventory

| Area                                | Source                                                                                                                                                                                                                                                                          | Current production behavior                                                                                       | Reviewer | Date | Status      | Notes                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingredient interaction rules        | `apps/mobile/src/features/intelligence/rules.ts`                                                                                                                                                                                                                                | Hidden unless reviewed                                                                                            | TBD      | TBD  | Not cleared | All launch rules currently have `reviewedBy: null`.                                                                                                                   |
| Pregnancy safety and active cadence | `apps/mobile/src/features/intelligence/pregnancySafety.ts`, `apps/mobile/src/features/intelligence/concentration.ts`, `apps/mobile/src/features/routine/generate.ts`, `apps/mobile/src/features/scheduler/orchestrate.ts`, `apps/mobile/src/features/recommendations/engine.ts` | Safety exclusions require reviewed rule records; treatment/exfoliant cadence withheld while review gate is closed | TBD      | TBD  | Not cleared | Review statuses, retinoid/hydroquinone/BHA matrix and threshold, unknown-strength handling, cadence, replacement suppression, and every visible explanation together. |
| PAO defaults                        | `apps/mobile/src/features/intelligence/pao.ts`                                                                                                                                                                                                                                  | Hidden in production                                                                                              | TBD      | TBD  | Not cleared | Keep conservative until chemist/derm signoff.                                                                                                                         |
| Recommendation types                | `apps/mobile/src/features/recommendations/catalog.ts`                                                                                                                                                                                                                           | Medical-adjacent types hidden unless reviewed                                                                     | TBD      | TBD  | Not cleared | Structural routine types may remain; medical-adjacent needs signoff.                                                                                                  |
| Shoppable stacks                    | `apps/mobile/src/features/commerce/stacks.ts`                                                                                                                                                                                                                                   | Hidden unless reviewed                                                                                            | TBD      | TBD  | Not cleared | Paid link disclosure does not replace clinical review.                                                                                                                |
| Community notes and posts           | `apps/mobile/src/features/community/*`                                                                                                                                                                                                                                          | Launch-required; hidden until content/moderation review                                                           | TBD      | TBD  | Not cleared | Expert notes, posting, reporting, aggregates, and medical-claim moderation require review.                                                                            |
| Ask OnSkin deterministic answers    | `apps/mobile/src/features/ask/answer.ts` and `apps/mobile/src/features/ask/copy.ts`                                                                                                                                                                                             | Template-bounded, refusal/escalation                                                                              | TBD      | TBD  | Not cleared | Deterministic answers are still regulated user-facing copy.                                                                                                           |
| Trend analysis                      | `apps/mobile/src/features/trend/*`                                                                                                                                                                                                                                              | Required engine absent; opt-in/local-only copy exists                                                             | TBD      | TBD  | Not cleared | Requires real engine, calibration, fairness, privacy, clinical, legal, and device review before launch.                                                               |
| Photo progress copy                 | `apps/mobile/src/features/photos/copy.ts`                                                                                                                                                                                                                                       | No-score local progress                                                                                           | TBD      | TBD  | Not cleared | Lower risk but privacy-sensitive.                                                                                                                                     |
| Onboarding quiz                     | `apps/mobile/src/features/onboarding/quiz.ts`                                                                                                                                                                                                                                   | Placeholder                                                                                                       | TBD      | TBD  | Blocked     | Needs IP/legal plus clinical review.                                                                                                                                  |
| Consent copy                        | `apps/mobile/src/features/onboarding/consentCopy.ts`                                                                                                                                                                                                                            | `draft-v1-2026-07-10`; production clearance blocked                                                               | TBD      | TBD  | Blocked     | Legal-owned copy explicitly names pregnancy, trying to become pregnant, and breastfeeding status; review exact version/hash behavior.                                 |

## Approval Template

When a reviewer reaches a release decision, update the matching Content
Inventory row and add one JSON record under `docs/phase-3/signoffs/` using
`docs/phase-3/review-signoff.template.json`. The JSON record is the
machine-readable credential and conditions evidence.

| Area | Source | Reviewer | Credential | Review date | Review snapshot SHA-256 | Decision            | Conditions |
| ---- | ------ | -------- | ---------- | ----------- | ----------------------- | ------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD        | TBD         | TBD                     | Approved / Deferred | TBD        |

## Launch Rule

Any item not approved remains hidden, blocked, or placeholder-gated. `Deferred`
may coexist with release only when the surface is excluded from production and
the detached signoff records the reason and owner. Seven-figure readiness
depends on trust; do not trade review evidence for speed.
