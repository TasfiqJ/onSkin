# Cosmetic Chemistry Review Log

Status: no chemistry content cleared  
Required reviewer: qualified cosmetic chemist/formulator  
Last updated: 2026-07-26

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

| Area                                              | Source                                                                                                                                                                                                             | Current behavior                                                                                   | Reviewer | Date | Status      | Notes                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------- | ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Functional tags                                   | `packages/types/src/index.ts` and intelligence modules                                                                                                                                                             | Used by shelf/routine logic                                                                        | TBD      | TBD  | Not cleared | Verify naming and category boundaries.                                                                                                  |
| Conflict and synergy rules                        | `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts`, `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md`                                                                               | Hidden unless exact rules are independently reviewed                                               | TBD      | TBD  | Not cleared | Review molecule, derivative, concentration, pH, vehicle, delivery-system, packaging, fixed-formulation, stability, and layering limits. |
| PAO defaults                                      | `apps/mobile/src/features/intelligence/pao.ts`                                                                                                                                                                     | Hidden in production                                                                               | TBD      | TBD  | Not cleared | Review by category and preservative risk assumptions.                                                                                   |
| Recommendation catalog                            | `apps/mobile/src/features/recommendations/catalog.ts`                                                                                                                                                              | Medical-adjacent hidden unless reviewed                                                            | TBD      | TBD  | Not cleared | Confirm evidence notes and caveats.                                                                                                     |
| Shoppable stack item labels                       | `apps/mobile/src/features/commerce/stacks.ts`                                                                                                                                                                      | Hidden unless reviewed                                                                             | TBD      | TBD  | Not cleared | Product examples illustrative only.                                                                                                     |
| Routine sequencing                                | `apps/mobile/src/features/routine/sequencing.ts`, `apps/mobile/src/features/routine/generate.ts`, `apps/mobile/src/features/today/routineProjection.ts`, `apps/mobile/src/app/(tabs)/today.tsx`                    | Unreviewed roles, placements, and instructions are withheld from Plan, Today, and cycle projection | TBD      | TBD  | Not cleared | Confirm every role's phase, priority, exact displayed instruction, and partial-review behavior. No manual add-to-AM/PM recovery exists. |
| Active concentration and pregnancy-caution matrix | `apps/mobile/src/features/intelligence/concentration.ts`, `apps/mobile/src/features/intelligence/pregnancySafety.ts`, `apps/mobile/src/features/scheduler/*`, `apps/mobile/src/features/recommendations/engine.ts` | Tag-associated parsing fails closed; safety/cadence production gates remain closed                 | TBD      | TBD  | Not cleared | Validate aliases, thresholds, multi-active ambiguity, low/high/unknown BHA, hydroquinone, and replacement behavior.                     |
| Smart shelf labels                                | `apps/mobile/src/features/shelf/*`                                                                                                                                                                                 | User-facing taxonomy                                                                               | TBD      | TBD  | Not cleared | Confirm terms are cosmetic, not medical.                                                                                                |

## Chemistry Approval Template

When a reviewer reaches a release decision, update the matching Inventory row
and add one JSON record under `docs/phase-3/signoffs/` using
`docs/phase-3/review-signoff.template.json`. The JSON record is the
machine-readable credential and conditions evidence.

| Area | Source | Reviewer | Credential | Review date | Review snapshot SHA-256 | Decision            | Conditions |
| ---- | ------ | -------- | ---------- | ----------- | ----------------------- | ------------------- | ---------- |
| TBD  | TBD    | TBD      | TBD        | TBD         | TBD                     | Approved / Deferred | TBD        |

## Launch Rule

No product-specific claim, stack, PAO default, or ingredient caveat may be
marked reviewed in code without an `Approved` Inventory row and a current
detached signoff. A `Deferred` row must remain excluded from production.
