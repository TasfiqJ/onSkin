# Clinical Review Log

Status: no clinical content cleared  
Required reviewer: board-certified dermatologist or equivalent qualified clinician  
Last updated: 2026-07-29

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

| Area                                | Source                                                                                                                                                                                                                                                                          | Current production behavior                                                                                       | Reviewer | Date | Status      | Notes                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingredient interaction rules        | `apps/mobile/src/features/intelligence/rules.ts`, `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts`, `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md`                                                                                          | Hidden unless reviewed                                                                                            | TBD      | TBD  | Not cleared | Review all 13 candidate rules, exact runtime admission logic, and audit constraints. Clinical approval must be independent of chemistry and regulatory-counsel review. |
| Routine application ordering        | `apps/mobile/src/features/routine/sequencing.ts`, `apps/mobile/src/features/routine/generate.ts`, `apps/mobile/src/features/today/routineProjection.ts`, `apps/mobile/src/app/(tabs)/today.tsx`                                                                                 | Each unreviewed role, placement, and instruction is withheld from Plan, Today, and cycle projection               | TBD      | TBD  | Not cleared | Review every role's phase, priority, exact full/compact display copy, rule version, and partial-review behavior. No manual add-to-AM/PM recovery exists.               |
| Pregnancy safety and active cadence | `apps/mobile/src/features/intelligence/pregnancySafety.ts`, `apps/mobile/src/features/intelligence/concentration.ts`, `apps/mobile/src/features/routine/generate.ts`, `apps/mobile/src/features/scheduler/orchestrate.ts`, `apps/mobile/src/features/recommendations/engine.ts` | Safety exclusions require reviewed rule records; treatment/exfoliant cadence withheld while review gate is closed | TBD      | TBD  | Not cleared | Review statuses, retinoid/hydroquinone/BHA matrix and threshold, unknown-strength handling, cadence, replacement suppression, and every visible explanation together.  |
| PAO defaults                        | `apps/mobile/src/features/intelligence/pao.ts`                                                                                                                                                                                                                                  | Hidden in production                                                                                              | TBD      | TBD  | Not cleared | Keep conservative until chemist/derm signoff.                                                                                                                          |
| Recommendation types                | `apps/mobile/src/features/recommendations/catalog.ts`                                                                                                                                                                                                                           | Medical-adjacent types hidden unless reviewed                                                                     | TBD      | TBD  | Not cleared | Structural routine types may remain; medical-adjacent needs signoff.                                                                                                   |
| Shoppable stacks                    | `apps/mobile/src/features/commerce/stacks.ts`                                                                                                                                                                                                                                   | Hidden unless reviewed                                                                                            | TBD      | TBD  | Not cleared | Paid link disclosure does not replace clinical review.                                                                                                                 |
| Community notes and posts           | `apps/mobile/src/features/community/*`                                                                                                                                                                                                                                          | Launch-required; hidden until content/moderation review                                                           | TBD      | TBD  | Not cleared | Expert notes, posting, reporting, aggregates, and medical-claim moderation require review.                                                                             |
| Ask OnSkin deterministic answers    | `apps/mobile/src/features/ask/answer.ts` and `apps/mobile/src/features/ask/copy.ts`                                                                                                                                                                                             | Template-bounded, refusal/escalation                                                                              | TBD      | TBD  | Not cleared | Deterministic answers are still regulated user-facing copy.                                                                                                            |
| Trend analysis                      | `apps/mobile/src/features/trend/*`, `docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md`                                                                                                                                                                   | PHOTO-05A literal zero admission; no simulated output or positive opt-in                                           | TBD      | TBD  | Not cleared | Requires a real exact-build engine/issuer, measurement/failure evidence, predeclared diverse-condition fairness, exact claim/copy review, privacy/legal review, and supported-iPhone proof before launch. |
| Photo progress copy                 | `apps/mobile/src/features/photos/copy.ts`                                                                                                                                                                                                                                       | No-score local progress                                                                                           | TBD      | TBD  | Not cleared | Lower risk but privacy-sensitive.                                                                                                                                      |
| Onboarding quiz                     | `apps/mobile/src/features/onboarding/quiz.ts`                                                                                                                                                                                                                                   | Placeholder                                                                                                       | TBD      | TBD  | Blocked     | Needs IP/legal plus clinical review.                                                                                                                                   |
| Consent copy                        | `apps/mobile/src/features/onboarding/consentCopy.ts`                                                                                                                                                                                                                            | `draft-v1-2026-07-10`; production clearance blocked                                                               | TBD      | TBD  | Blocked     | Legal-owned copy explicitly names pregnancy, trying to become pregnant, and breastfeeding status; review exact version/hash behavior.                                  |

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
