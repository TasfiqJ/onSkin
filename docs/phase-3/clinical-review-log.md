# Clinical Review Log

Status: no clinical content cleared  
Required reviewer: board-certified dermatologist or equivalent qualified clinician  
Last updated: 2026-07-04

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

| Area                             | Source                                                                              | Current production behavior                   | Reviewer | Date | Status      | Notes                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- | -------- | ---- | ----------- | -------------------------------------------------------------------- |
| Ingredient interaction rules     | `apps/mobile/src/features/intelligence/rules.ts`                                    | Hidden unless reviewed                        | TBD      | TBD  | Not cleared | All launch rules currently have `reviewedBy: null`.                  |
| PAO defaults                     | `apps/mobile/src/features/intelligence/pao.ts`                                      | Hidden in production                          | TBD      | TBD  | Not cleared | Keep conservative until chemist/derm signoff.                        |
| Recommendation types             | `apps/mobile/src/features/recommendations/catalog.ts`                               | Medical-adjacent types hidden unless reviewed | TBD      | TBD  | Not cleared | Structural routine types may remain; medical-adjacent needs signoff. |
| Shoppable stacks                 | `apps/mobile/src/features/commerce/stacks.ts`                                       | Hidden unless reviewed                        | TBD      | TBD  | Not cleared | Paid link disclosure does not replace clinical review.               |
| Community notes                  | `apps/mobile/src/features/community/notes.ts`                                       | Hidden unless reviewed                        | TBD      | TBD  | Not cleared | Peer/community posting remains deferred.                             |
| Ask OnSkin deterministic answers | `apps/mobile/src/features/ask/answer.ts` and `apps/mobile/src/features/ask/copy.ts` | Template-bounded, refusal/escalation          | TBD      | TBD  | Not cleared | Deterministic answers are still regulated user-facing copy.          |
| Trend analysis                   | `apps/mobile/src/features/trend/*`                                                  | Opt-in and local-only copy exists             | TBD      | TBD  | Not cleared | Requires fairness and legal review before public V1.                 |
| Photo progress copy              | `apps/mobile/src/features/photos/copy.ts`                                           | No-score local progress                       | TBD      | TBD  | Not cleared | Lower risk but privacy-sensitive.                                    |
| Onboarding quiz                  | `apps/mobile/src/features/onboarding/quiz.ts`                                       | Placeholder                                   | TBD      | TBD  | Blocked     | Needs IP/legal plus clinical review.                                 |
| Consent copy                     | `apps/mobile/src/features/onboarding/consentCopy.ts`                                | Placeholder                                   | TBD      | TBD  | Blocked     | Legal-owned copy.                                                    |

## Approval Template

When a reviewer clears an item, add a row:

| Area | Source | Reviewer | Credential | Review date | Approved version/hash | Decision                               | Conditions |
| ---- | ------ | -------- | ---------- | ----------- | --------------------- | -------------------------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD        | TBD         | TBD                   | Approved / changes required / rejected | TBD        |

## Launch Rule

Any item with status other than approved remains hidden, blocked, or placeholder-gated. Seven-figure readiness depends on trust; do not trade review evidence for speed.
