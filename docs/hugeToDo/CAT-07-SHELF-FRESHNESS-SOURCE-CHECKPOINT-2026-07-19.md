# CAT-07 Shelf Freshness Source Checkpoint

- Date: 2026-07-19
- Research last reverified: 2026-07-22
- Status: `in_progress` source candidate / launch-blocked
- Release scope: iPhone on iOS 17+, provisional U.S.-only Wave 1; Canadian
  labeling research is forward-looking Wave 2 material and is not Canadian
  launch authorization
- Blocking dependency: `CAT-06`
- External acceptance artifacts: not supplied

## Decision

CAT-07 adopts one evidence-preserving launch contract: physical-package
printed dates, explicit label PAO, reviewed catalog PAO, and unknown are
distinct states. `estimated` / `category_default` remains reserved future
schema vocabulary only; current intake, v1 upgrade, and database admission
coerce every such claim to unknown. Unknown is not an estimate. Only trusted
printed or label/catalog-PAO evidence may drive a
countdown, expired state, Expiring filter, or replenishment prompt; a unit the
user explicitly marked finished remains a separate replenishment trigger.

Shelf `pao_source='label'` is reserved for direct product-label entry. Once
product-specific `label`, `brand_label`, or `catalog` evidence arrives through
the reviewed catalog intake boundary, Shelf persists it as `catalog`; the
catalog retains the finer evidence origin. Historical v1 `label` rows do not
prove who entered them, so copy says only that the PAO was recorded from the
product label and never attributes the entry to the user.

An actionable Shelf printed date must be explicitly recorded or reconfirmed
from the exact physical package in the user's possession. A product catalog
identity is not a lot, batch, or package identity, so even an exact reviewed,
source-bound, region-matched catalog row with `expiry_source='printed'` never
auto-populates Shelf `expiryDate`. Catalog expiry evidence remains available to
catalog review and correction surfaces only. Historical catalog-linked Shelf
dates are actor- and package-origin ambiguous: v1/`0060` preservation moves
them to app `legacyUnverifiedExpiryDate` / database
`legacy_unverified_expiry_date` rather than rewriting them as
trusted or deleting the retained value. They cannot drive a badge, filter,
recommendation, notification, or replacement prompt unless the user separately
reconfirms the date from that physical package.

New catalog and Shelf-v2 writes accept integer PAO values from 1 through 120
months and fail closed above 120. This is an engineering validation ceiling for
bounded date arithmetic and malformed-data rejection. It is not a regulatory
limit, a recommended lifetime, or a claim that any product remains usable for
120 months.

Current `product_categories` fields remain editorial metadata, not Shelf
evidence: they lack a named reviewer, source snapshot, and exact retained
category-evidence identity. Migration `0060` deletes every row from the legacy
`ingredient_pao_defaults` relation, removes its legacy read policy, enables and
forces RLS, revokes all API-role privileges, and validates an always-false check
that prevents repopulation. No mobile, RPC, or operator path may treat that
compatibility relation as freshness evidence.

The current mobile catalog payload can prove a reviewed product-specific PAO
only when exactly one matching-source/region `label`, `brand_label`, or
`catalog` row remains. Zero rows or duplicate rows fail closed even when
duplicate month values agree; a category row does not make one product-specific
winner ambiguous. The exported provenance decoder independently requires a
canonical product UUID and source UUID, reviewed product state, `verified` or
`usable` quality, and a non-null normalized product region before trusting any
freshness row. A category-only payload also fails to `unknown` because the
current projection does not expose enough `product_categories` review authority
for the client to validate it. `estimated` stays unavailable through catalog
intake until an exact bounded server-attested category marker is retained
locally, named cosmetic-chemistry review closes, and a versioned database
admission path replaces the current fail-closed quarantine guard.

Replacement must archive the prior package, create a new UUID, preserve product
identity and PAO provenance, clear the old package's printed date, and require
an explicit opening-state choice. It must never silently assume that a new unit
was opened today.

The local persistence candidate introduces schema v2 without rewriting an
authenticated canonical v1 record merely because it was read. The first
successful authorized atomic mutation writes v2. Failed mutation,
non-canonical input, and future-version input preserve the original bytes; the
latter two fail closed for mutation.

This is a source decision, not CAT-07 completion. It does not prove that the
integrated tree is green, that migration `0060` runs against a fresh or hosted
database, that live catalog rows obey the truth table, that encrypted storage
survives physical-device lifecycle boundaries, or that qualified chemistry and
legal reviewers approve the final rules and copy.

Nothing in this checkpoint predicts or guarantees App Review acceptance, legal
compliance, product-market fit, or revenue.

## Freshness Truth Table

| Product state and evidence                                                                   | Stored/surfaced source                                       | UI truth                                                   | Countdown, expired, or replacement signal    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------- | --------------------------------------- |
| Unopened with a physical-package date explicitly recorded/reconfirmed by the user            | `expiry_source='printed'`                                    | Show and identify the printed date                         | Eligible near or past that date              |
| Unopened without printed package date                                                        | `expiry_source='unknown'`                                    | Unopened; no app-derived date                              | Not eligible                                 |
| Opened with a winning physical-package date explicitly recorded/reconfirmed by the user      | `expiry_source='printed'`                                    | Show and identify the printed date                         | Eligible near or past that date              |
| Opened with a winning explicit label PAO or reviewed catalog PAO                             | `expiry_source='pao_computed'`; `pao_source='label'          | 'catalog'`                                                 | Explain opened date plus source-specific PAO | Eligible near or past the computed date |
| Reserved future state: externally reviewed, server-attested catalog-linked category fallback | `expiry_source='estimated'`; `pao_source='category_default'` | Unavailable at launch; every current claim becomes unknown | Not eligible                                 |
| No trustworthy candidate                                                                     | `expiry_source='unknown'`                                    | No date or estimate                                        | Not eligible                                 |

When printed and PAO-derived candidates both exist, the earlier actual
candidate wins. An exact tie resolves to `printed`. No sunscreen-specific
numeric fallback exists, and product classification alone never creates a
printed date.

Category estimates are disabled for current mobile intake and v1 upgrade. A
generic `review_status` or category-shaped PAO row is insufficient; enabling
`category_default` requires an exact served category-evidence marker retained
locally, named cosmetic-chemistry review, and a versioned database admission
path replacing the current quarantine guard.

## Regulatory Source Boundary

- [EU Regulation (EC) No 1223/2009](https://eur-lex.europa.eu/eli/reg/2009/1223/oj), Article 19(1)(c), governs minimum durability and PAO. For relevant products whose minimum durability exceeds 30 months, PAO applies unless durability after opening is not relevant. The open-jar symbol is Annex VII point 2; Annex VII point 3 is the minimum-durability symbol.
- The [FDA says ordinary cosmetics have no U.S. shelf-life or expiration-date labeling requirement](https://www.fda.gov/cosmetics/cosmetics-labeling/shelf-life-and-expiration-dating-cosmetics), and separately confirms that [cosmetic expiration dates are generally not required](https://www.fda.gov/industry/fda-basics-industry/do-i-need-label-my-cosmetics-products-expiration-dates).
- U.S. sunscreens are OTC drugs. The [FDA says sunscreen without a printed expiration date should be considered expired three years after purchase](https://www.fda.gov/drugs/understanding-over-counter-medicines/sunscreen-how-help-protect-your-skin-sun). Layerwell neither captures nor verifies purchase date, so it has no evidence basis for that calculation and leaves the unit unknown unless the user records exact package evidence. There is no universal printed-sunscreen-date assumption.
- [Health Canada classifies sunscreens as non-prescription drugs or natural health products according to active ingredients](https://www.canada.ca/en/health-canada/services/sun-safety/sunscreens.html). [Food and Drug Regulations C.01.004](https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.%2C_c._870/section-C.01.004.html) governs drug-label expiration dates, while [Health Canada's NHP labeling guidance](https://www.canada.ca/en/health-canada/services/drugs-health-products/natural-non-prescription/legislation-guidelines/guidance-documents/labelling.html) governs that classification. [General cosmetic labeling requirements](https://www.canada.ca/en/health-canada/services/consumer-product-safety/cosmetics/labelling.html) do not establish a universal cosmetic expiry/PAO field.
- [Apple App Review Guideline 1.4.1](https://developer.apple.com/app-store/review/guidelines/) says medical apps that could provide inaccurate information or be used to diagnose or treat patients may receive greater scrutiny. Layerwell therefore keeps CAT-07 as freshness-evidence reporting: it does not diagnose, treat, measure health, or claim that an elapsed date proves efficacy, contamination, infection, or safety. That product boundary reduces unsupported claims; it does not guarantee how Apple will classify or review the app.
- The same [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) require privacy-policy disclosure, consent, minimization, withdrawal, retention/deletion clarity under 5.1.1 and permission plus purpose/recipient limits under 5.1.2. Guideline 2.5.18 prohibits targeted or behavioral advertising based on sensitive health/medical data. Whether user-initiated affiliate navigation for the selected Shelf item is contextual shopping or advertising targeted from sensitive Shelf data remains an unresolved App Review/privacy classification gate. Consent is necessary for the planned sharing path but does not by itself clear 2.5.18 or 5.1.2; no route ships until qualified review binds the exact data flow, copy, metadata, recipients, and SDK behavior.
- The [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance) treats advertising broadly and requires objective health-benefit or safety claims to be truthful, non-misleading, and adequately substantiated, generally with competent and reliable scientific evidence. CAT-07 therefore must not turn dates or replenishment commerce into unsubstantiated potency, contamination, infection, safety, protection, or urgency claims. A disclaimer cannot cure contradictory express or implied copy. Qualified advertising/regulatory review of the exact net impression remains required.

These primary sources support the product's conservative provenance boundary;
qualified counsel must still approve territorial interpretation and final copy.
The app does not infer potency loss, contamination, infection, or a special
eye/SPF safety rule from elapsed time alone.

## Source Candidate Boundary

The current candidate spans:

- `apps/mobile/src/features/shelf/freshness.ts` and focused contracts for the
  launch printed, PAO-computed, and unknown states plus fail-closed reserved
  category vocabulary;
- `apps/mobile/src/features/shelf/store.ts` and focused contracts for explicit
  replacement opening state, archived/new-unit provenance, and authenticated
  byte-preserving local v1→v2 handling;
- Shelf list, detail, opened-state, and replenishment routes for source-specific
  copy and action eligibility; and
- `supabase/migrations/20260718000060_cat07_truthful_freshness.sql`, the pgTAP
  contract `supabase/tests/database/cat07_truthful_freshness.test.sql`, the
  isolated PostgreSQL rehearsal
  `scripts/phase9/cat07-truthful-freshness-postgres-rehearsal.sql`, and the
  static binder `scripts/phase2/local-supabase-contract.mjs` for the exact
  61-migration source history through `0062`, legacy-table purge/sealing,
  category-default quarantine, physical-package-date quarantine, and catalog
  PAO source backfill. Forward migration `0061` keeps authenticated PAO reads
  product-specific and bounded to `label`, `brand_label`, or `catalog` sources
  with 1-120 months; `category_default` and `unknown` remain excluded. Migration
  `0062` adds three covered CAT-03 authority indexes, staged-digest pushdown,
  and the bounded statement-level curation guard; it does not authorize
  category estimates.

The migration is a candidate, not hosted evidence. No migration result, source
test result, or local fixture can establish the truth of a live catalog row or
replace qualified review.

## Historical Evidence Boundary

The 2026-07-11 deterministic Expo-web packet at
`test-results/human-e2e/2026-07-11/shelf-freshness-provenance-current/` remains
useful historical UI evidence. It predates the explicit replacement opening
choice, the complete category-default quarantine, the separate unknown
state, and the byte-preserving local v1→v2 contract. It is stale for CAT-07
acceptance. It also cannot prove native encrypted persistence/relaunch,
physical-device accessibility, notifications, hosted migration/RLS/catalog
truth, or professional review.

## Verification Boundary

A later accepted source checkpoint must record a clean integrated run of the
relevant repository/mobile typecheck, lint, focused Shelf tests, complete mobile
tests, migration/static-policy contracts, launch contract, and docs audits.
Passing those commands would establish only source/static-contract behavior.
It would not establish native-device behavior, hosted data truth, reviewer
approval, legal compliance, or App Review acceptance.

## Current Open Gates

1. Finish integration, resolve every source/static-policy failure, and bind a
   green source checkpoint to an exact commit.
2. For any future category-estimate proposal, add an exact served marker that
   is retained locally, obtain named qualified cosmetic-chemistry review, and
   version the database admission path. Until all three exist, keep every
   `category_default` claim disabled and normalized to unknown.
3. Obtain qualified legal review of the EU, U.S., and Canadian interpretation,
   final user copy, notifications, commerce boundary, policies, and App Store
   metadata. Resolve whether item-specific replenishment is contextual commerce
   or prohibited sensitive-data-targeted advertising under Apple 2.5.18 and
   5.1.2; consent alone is not acceptance evidence.
4. Apply the exact migration to fresh local and approved hosted targets; attach
   migration history, RLS/adversarial results, live catalog truth-table
   readback, rollback evidence, and source lineage.
5. Exercise the exact signed build on supported physical iPhones across
   encrypted-storage v1 read, successful and failed v2 migration, relaunch,
   interruption, account switch/withdrawal/deletion, replacement choices,
   VoiceOver, Dynamic Type, Reduce Motion, and notification opt-in.
6. Re-run the governed Shelf human-simulated E2E matrix against the accepted
   CAT-07 source and bind screenshots/logs to that exact build. Web evidence
   remains `nativeDeviceProof=false`.
7. Reconcile final observed storage/network behavior and user-facing copy with
   privacy disclosures, consumer-health notices, support, incident response,
   and release review.

## Release Rule

CAT-07 remains `in_progress` and launch-blocked. Do not mark it complete until
the exact integrated source is green and the professional, hosted/live, signed-
build, physical-device, accessibility, lifecycle, and release evidence above
is reviewed and accepted.
