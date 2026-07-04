# Phase 4 Ingredient Tag Taxonomy

Date: 2026-07-04

## Purpose

Ingredient tags are the bridge from raw INCI text to routine placement, conflicts, and recommendation eligibility. They must be conservative because a wrong tag can change behavior.

## Launch Taxonomy

| Tag | Group | Product use | Launch status |
| --- | --- | --- | --- |
| `retinoid` | active_family | conflict/ramp/recommendation gate | needs dermatologist review |
| `aha` | active_family | exfoliant placement and conflict checks | needs dermatologist review |
| `bha` | active_family | exfoliant placement and pregnancy/dose caution gates | needs dermatologist review |
| `benzoyl_peroxide` | active_family | product-specific conflict checks | needs dermatologist review |
| `vitamin_c` | active_family | AM placement and stability guidance | needs dermatologist review |
| `niacinamide` | active_family | reassurance and fit guidance | needs dermatologist review |
| `copper_peptide` | active_family | stability guidance | needs dermatologist review |
| `hydroquinone` | active_family | high-caution routing | needs dermatologist review |
| `sunscreen` | uv_filter | SPF category, expiry, routine AM role | needs sunscreen regulatory review |
| `physical_spf` | uv_filter | mineral SPF fit | needs sunscreen regulatory review |
| `chemical_spf` | uv_filter | chemical SPF fit | needs sunscreen regulatory review |
| `humectant` | supporting_ingredient | hydration role only | needs cosmetic-chemist review |
| `ceramide` | barrier_support | barrier-support role only | needs cosmetic-chemist review |
| `barrier` | barrier_support | barrier-support role only | needs cosmetic-chemist review |

## Rules

- Unknown tokens are preserved. They are never dropped.
- Tags are assigned from exact/synonym matches first. Fuzzy matches require lower confidence and review.
- Product-level recommendations require product `quality_grade` of `verified` or `usable`, reviewed status, and no unresolved correction reports.
- CosIng presence alone does not create a tag.
- Sunscreen products are handled separately from ordinary cosmetics.

## Implemented Controls

- `ingredient_tag_definitions` stores tag labels, groups, review status, and evidence grade.
- `ingredient_tag_assignments` links reviewed ingredients to tags.
- The mobile parser records matched tags, unknowns, confidence, and parser version.
- `quality.ts` blocks recommendation eligibility when parse confidence or review state is weak.

