# Cosmetic Chemistry Review Log

Status: no chemistry content cleared  
Required reviewer: qualified cosmetic chemist/formulator  
Last updated: 2026-07-04

This log governs ingredient taxonomy, product-type definitions, compatibility caveats, PAO assumptions, and product-category claims. Dermatology review and chemistry review are separate controls.

## Required Review Scope

- Product-type taxonomy.
- Ingredient tags and role labels.
- PAO defaults.
- Routine ordering assumptions.
- Compatibility statements.
- Sensitive-skin and pregnancy-adjacent caveats.
- Recommendation type caveats.
- Any product example labels before public launch.

Before production clearance, every inventory row must be `Approved` or
`Deferred`. Approved rows require the named qualified reviewer and ISO review
date. Deferred rows require a named decision owner, ISO date, deferral reason,
and a production gate that keeps the surface hidden. `Blocked` and
`Not cleared` remain unresolved.

## Inventory

| Area                        | Source                                                 | Current behavior                        | Reviewer | Date | Status      | Notes                                                 |
| --------------------------- | ------------------------------------------------------ | --------------------------------------- | -------- | ---- | ----------- | ----------------------------------------------------- |
| Functional tags             | `packages/types/src/index.ts` and intelligence modules | Used by shelf/routine logic             | TBD      | TBD  | Not cleared | Verify naming and category boundaries.                |
| PAO defaults                | `apps/mobile/src/features/intelligence/pao.ts`         | Hidden in production                    | TBD      | TBD  | Not cleared | Review by category and preservative risk assumptions. |
| Recommendation catalog      | `apps/mobile/src/features/recommendations/catalog.ts`  | Medical-adjacent hidden unless reviewed | TBD      | TBD  | Not cleared | Confirm evidence notes and caveats.                   |
| Shoppable stack item labels | `apps/mobile/src/features/commerce/stacks.ts`          | Hidden unless reviewed                  | TBD      | TBD  | Not cleared | Product examples illustrative only.                   |
| Routine sequencing          | `apps/mobile/src/features/routine/*`                   | Core routine behavior                   | TBD      | TBD  | Not cleared | Confirm order labels and conflicts.                   |
| Smart shelf labels          | `apps/mobile/src/features/shelf/*`                     | User-facing taxonomy                    | TBD      | TBD  | Not cleared | Confirm terms are cosmetic, not medical.              |

## Chemistry Approval Template

| Area | Source | Reviewer | Credential | Review date | Approved version/hash | Decision                               | Conditions |
| ---- | ------ | -------- | ---------- | ----------- | --------------------- | -------------------------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD        | TBD         | TBD                   | Approved / changes required / rejected | TBD        |

## Launch Rule

No product-specific claim, stack, PAO default, or ingredient caveat may be marked reviewed in code without a completed row here.
