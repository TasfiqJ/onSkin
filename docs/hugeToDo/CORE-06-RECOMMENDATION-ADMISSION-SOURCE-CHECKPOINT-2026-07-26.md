# CORE-06 Recommendation Admission Source Checkpoint — 2026-07-26

## Status

`CORE-06A` is `in_progress`. This is a zero-product-admission source
checkpoint. It establishes the boundary that must exist before
product-specific ranking work begins; it does not complete Feature 13.

The current source candidate keeps product-specific recommendation mode
closed, admits no catalog product, and recognizes only `type_first` and
`shelf_context` recommendation provenance. It also makes goal-active output
depend on exact current upstream authority and a positive review clearance
that starts empty. The goal-provenance envelope checks strict shape, current
quiz-contract hashes, and the exact goal set; it is not an unforgeable
authorization receipt. Commerce admission returns
`false` unconditionally and cannot render or fetch where-to-buy content.

This checkpoint does not establish an approved catalog-product corpus,
professional review, an enabled product-specific mode, retailer or affiliate
availability, live/hosted behavior, physical-iPhone behavior, App Privacy
answers, counsel clearance, App Review acceptance, product safety,
product-market fit, or revenue.

## Why This Checkpoint Comes Before Ranking

The earlier recommendation implementation mixed useful structural type
guidance with an aspirational product-ranking design. It also carried a
`reviewedBy` string primitive, static catalog-quality assumptions, a Phase 7
goal flag disconnected from positive recommendation review, and a dormant
database cache that could be mistaken for recommendation authority.

Those conditions are not safe inputs to a product-specific recommender.
`CORE-06A` therefore starts with zero admission and proves that no raw,
forged, stale, or merely high-quality catalog candidate can cross the boundary.
Ranking a product is meaningful only after the application can prove that the
product and every claim-bearing fact are currently authorized for the exact
market, purpose, profile context, and review scope.

## Current Scope

### In scope

- explicit and exhaustive provenance on every recommendation result;
- type-first structural routine-gap guidance;
- existing-Shelf context such as replacement or a link to separately admitted
  interaction detail;
- exact-current health-consent/profile/goal gating for goal-active output;
- literal zero product-specific admission;
- closed-set rejection reasons for the product admission decision;
- a production engine with no caller-supplied recommendation types or copy;
- an unconditional-false commerce guard before where-to-buy rendering or
  network work;
- a full purge of legacy recommendation-cache rows plus revocation of all
  unused runtime table privileges;
- an aggregate structural source contract; and
- honest no-product, review-pending, stale, and unavailable recovery behavior,
  including withholding when profile data is unavailable or private
  preference/dismissal state is unreadable.

### Out of scope

- selecting or ranking a named catalog product;
- showing a catalog product image, price, retailer, availability, paid link, or
  product-level fit score;
- approving recommendation copy, evidence grades, contraindications, cadence,
  or market-specific product classifications;
- ingesting product or retailer data;
- activating commerce or ShopMy;
- enabling goal-active recommendations; and
- treating existing route or historical browser evidence as current acceptance.

## Current Source Authorities

| Boundary                                                   | Current source                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero product admission and provenance discriminants        | [`admission.ts`](../../apps/mobile/src/features/recommendations/admission.ts)                                                                                                                                                                                                                                                                                              |
| Exact quiz/goal provenance                                 | [`goalProvenance.ts`](../../apps/mobile/src/features/recommendations/goalProvenance.ts)                                                                                                                                                                                                                                                                                    |
| Conjunctive goal-active gate and closed review clearance   | [`goalAdmission.ts`](../../apps/mobile/src/features/recommendations/goalAdmission.ts)                                                                                                                                                                                                                                                                                      |
| Structural-only type set and output provenance             | [`catalog.ts`](../../apps/mobile/src/features/recommendations/catalog.ts) and [`engine.ts`](../../apps/mobile/src/features/recommendations/engine.ts)                                                                                                                                                                                                                      |
| Current profile/consent/goal handoff                       | [`profile.ts`](../../apps/mobile/src/features/scheduler/profile.ts) and [`useRecommendations.ts`](../../apps/mobile/src/features/recommendations/useRecommendations.ts)                                                                                                                                                                                                    |
| Commerce provenance guard                                  | [`WhereToBuy.tsx`](../../apps/mobile/src/features/commerce/WhereToBuy.tsx) and [`recommendations/[id].tsx`](../../apps/mobile/src/app/recommendations/[id].tsx)                                                                                                                                                                                                            |
| Exact preference vocabulary and RPC mirror                 | [`preferences.ts`](../../apps/mobile/src/features/recommendations/preferences.ts) and [`store.ts`](../../apps/mobile/src/features/recommendations/store.ts)                                                                                                                                                                                                                |
| Database zero-admission, cache seal, and preference writer | [`20260726000071_recommendation_zero_admission.sql`](../../supabase/migrations/20260726000071_recommendation_zero_admission.sql)                                                                                                                                                                                                                                           |
| Database and forward-upgrade proof                         | [`recommendation_zero_admission.test.sql`](../../supabase/tests/database/recommendation_zero_admission.test.sql), [`recommendation_zero_admission_0071_upgrade.test.sql`](../../supabase/tests/upgrade/recommendation_zero_admission_0071_upgrade.test.sql), and [`recommendation-zero-admission-smoke.mjs`](../../scripts/phase9/recommendation-zero-admission-smoke.mjs) |
| Blocking aggregate source contract                         | [`recommendation-admission-source-contract.test.mjs`](../../scripts/core06/recommendation-admission-source-contract.test.mjs)                                                                                                                                                                                                                                              |

## P0 Invariants

### 1. Product-specific admission is positively closed

Product-specific mode is a literal closed source capability. Its admitted
catalog-product collection is empty. A caller cannot supply a product and have
it become admitted merely because:

- a route is reachable;
- an environment or Phase 7 flag is true;
- a row has `reviewedBy`, `reviewed`, `verified`, `usable`, or a high quality
  score;
- a correction count is zero;
- a product was previously cached or displayed;
- commerce consent exists; or
- the candidate passes a TypeScript shape check.

Raw, forged, full, stale, fixture, held, withdrawn, wrong-market, and
wrong-product candidates must all receive a bounded closed-set rejection.
Unknown rejection states fail closed.

### 2. Provenance is explicit and exhaustive

The only current provenance variants are:

- `type_first`: a type-level result whose explanation does not identify or
  imply an admitted catalog product; and
- `shelf_context`: a result anchored to a product the user already placed on
  their Shelf, without converting that local fact into global catalog or
  safety authority.

There is no current `catalog_product` producer. A later implementation may add
that variant only through a new versioned admission contract. Every renderer
and action boundary must handle provenance exhaustively; unknown or malformed
provenance renders no recommendation action.

The production `recommend` entry point accepts app-assembled user state only.
It obtains recommendation types and copy from the checked-in launch-gated
source; a caller cannot supply an alternate `recTypes` collection.

### 3. Type-first is a limited mode, not product clearance

Type-first output can explain a structural need such as a missing routine
category. It may not:

- name or depict a catalog candidate;
- imply a specific product is safe, suitable, reviewed, available, or best;
- create a new treatment/cadence recommendation from an unreviewed goal;
- turn a product example into a product recommendation;
- attach product claims that lack exact reviewed evidence; or
- make an unavailable product appear as an empty successful fetch.

Shelf-context output may describe the user's own stored item or route to a
separately admitted conflict/replenishment surface. It does not authorize a
replacement product.

### 4. Goal-active recommendations require all authorities

The goal-active path is admitted only when all of these are current for the
same account generation and health-purpose lifecycle:

1. the Phase 7 goal-active feature flag;
2. current health-data consent with the exact approved copy version and hash;
3. a successfully read current profile;
4. exact current goal provenance rather than a default or stale server value;
5. exact current recommendation-review clearance for the proposed goal/type;
6. all upstream safety, conflict, cadence, and claim gates required by the
   content; and
7. a source-supported output that the review clearance actually covers.

The review-clearance collection starts empty. A flag alone never enables a
goal-active suggestion. Missing, stale, unreadable, unsupported, or ambiguous
state withholds the output without substituting a supposedly safer active.
Exact-shaped current goal provenance is necessary but is not cryptographic or
unforgeable authorization. Before this gate can open, goal authority must be
server-minted and server-verified and bound to the exact account,
health-processing lifecycle, profile completion, goal set, review scope, and
expiry.

### 5. Commerce stays after admission and ranking

Need detection and ranking import no commerce, affiliate, price, retailer,
availability, paid-placement, partnership, commission-rate, click-attribution,
or conversion field.

The current commerce-admission predicate returns `false` unconditionally for
every value, including forged future-shaped provenance. Neither `type_first`
nor `shelf_context` can render where-to-buy UI or start a retailer/affiliate
request even when a commerce flag and consent are both true. Direct URL entry
does not bypass the provenance guard.

A later commerce-enabled implementation must prove metamorphically that
changing every commercial input leaves detection, inclusion, exclusion,
ordering, fit, explanation, and product identity unchanged.

### 6. The legacy cache is never recommendation authority

Migration `0071` purges every legacy row from `public.recommendations`; none has
a server authority receipt suitable for preservation. The relation is a dormant
empty cache, not a reviewed or server-owned admission source. All unused runtime
table privileges are revoked. The retained owner/export-motivated reads and
service read do not confer authority, and no runtime API role may insert,
update, delete, or truncate. A user cannot write their own product
recommendation, evidence grade, review claim, or `catalog_product_id`.

Any later cache requires a narrow owner-derived server writer that recomputes
from admitted inputs, preserves exact provenance and admission receipt
identity, rejects stale generations, is covered by export/withdrawal/deletion
policy, and cannot be used to resurrect a withdrawn product or review.

### 7. No-result and failure states are product behavior

The following are distinct, truthful states:

- no structural need: the routine is complete for the limited evaluated scope;
- structural type guidance exists but no product-specific mode is admitted;
- product-specific review/catalog authority is unavailable or incomplete;
- goal-active review is pending;
- a direct recommendation identifier is stale;
- the profile is unavailable;
- private recommendation preferences or dismissals are unreadable;
- a later product or commerce service timed out, returned malformed data, or
  failed its exact identity/market/receipt checks; and
- a product was held, withdrawn, superseded, or corrected after a prior result.

None may be collapsed into a named product, an invented compatibility/safety
claim, an empty success, or a retailer fallback.

### 8. Analytics cannot become a health or commerce side channel

Recommendation telemetry is not an admission source. Vendor analytics must not
receive the user's goal, profile/safety setting, Shelf product, recommendation
type, candidate product, rejection reason, review state, retailer, price, or
affiliate identifier. Adding measurement for the later product-specific mode
requires a CAT-09 privacy/analytics review and archive-identical traffic proof.

## Required Product-Specific Successor Contract

Opening product-specific mode requires a later versioned checkpoint that binds
at least:

1. one exact served CAT-03 SKU, exact launch market, and current
   campaign/readback authority;
2. exact source, batch, field, ingredient, regulatory, barcode, and child-row
   lineage for every client-readable fact;
3. no active serving hold, correction block, source withdrawal, review expiry,
   batch retirement, product successor, or root drift;
4. exact market and storefront scope;
5. claim classification and an allowlisted claim/caveat mapping;
6. dermatologist, cosmetic-chemist, and regulatory-counsel receipts where the
   exact proposed output requires them;
7. current health/profile/goal authority plus server-minted, server-verified
   goal receipts bound to the exact account, health-processing lifecycle,
   profile completion, goal set, review scope, and expiry;
8. recommendation provenance and a bounded admission receipt bound to that
   exact SKU and market;
9. hard preference facts rather than static placeholder scores;
10. ranking independence from every commerce field and service;
11. cache, data-access, export, retention, withdrawal, correction, and account
    deletion behavior; and
12. native, hosted, accessibility, performance, network, privacy, security, and
    incident/rollback evidence against the exact release candidate.

An environment flag, mutable row, self-review, generic professional signoff,
fixture packet, or source test cannot satisfy this contract.

## External Gates

### Professional and catalog gates

- qualified dermatologist review of the exact need, exclusion, escalation,
  caveat, goal-active, pregnancy/breastfeeding, and cadence claims;
- qualified cosmetic-chemist review of exact product/formulation facts,
  concentrations, vehicles, use conditions, compatibility, and limitations;
- qualified regulatory counsel review by each launch market of the app copy,
  product classification, implied claims, privacy/consumer-health scope,
  affiliate disclosure, and store metadata;
- current CAT-01 source rights and exact CAT-02 lineage;
- a current CAT-03 release, activation, signed readback, and correction/hold
  recovery path; and
- a source-approved product and retailer corpus. Open Beauty Facts fixtures and
  unreviewed volunteer entries are not sufficient.

### Live, device, and release gates

- clean hosted database migration, ACL, RLS, export, withdrawal, deletion, and
  two-session adversarial evidence;
- live catalog and retailer timeouts, malformed responses, drift, withdrawal,
  hold, and recovery;
- supported physical-iPhone navigation, offline/relaunch/process-death,
  Dynamic Type, VoiceOver, Reduce Motion, poor-network, safe-area, and outbound
  link behavior;
- exact-release network/analytics capture showing no pre-admission retailer or
  sensitive analytics payload;
- final privacy policy, consumer-health notice, consent copy, retention/
  deletion statement, support path, incident plan, App Review notes, and App
  Privacy answers;
- archive inspection of installed SDKs, privacy manifests, traffic, entitlements,
  and declared data practices; and
- named release-owner and professional signoffs bound to the exact source,
  build, evidence, and market.

## Official Source Ledger

Accessed 2026-07-29. These primary sources identify review questions and
engineering constraints; they are not legal opinions and do not establish that
Layerwell is compliant.

| Authority                                                                                                                                                                                                                                                                                                                                                                          | Current engineering implication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)                                                                                                                                                                                                                                                                                            | Guidelines 1.4.1, 2.3, 5.1.1, and 5.1.2 keep potentially health-affecting guidance, truthful feature/metadata claims, privacy-policy accuracy, purpose limitation, consent/withdrawal, minimization, retention/deletion, and sensitive-data handling in the release gate. Guideline 2.5.18 separately bars targeted or behavioral advertising based on sensitive data such as health/medical data. Consent does not by itself resolve whether a personalized commerce surface is prohibited advertising. Apple decides acceptance on the submitted build. |
| [Apple App privacy details](https://developer.apple.com/app-store/app-privacy-details/) and [App Store Connect privacy management](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)                                                                                                                                                  | User-provided health/medical data is an App Privacy `Health` data type; linked-to-user and tracking classifications depend on the exact first- and third-party data flows. Off-device data retained beyond real-time request servicing generally counts as collected. Final answers must be derived from the archive, configured processors, and observed production behavior.                                                                                                                                                                            |
| [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)                                                                                                                                                                                                                                                     | Express and implied objective health or safety claims require adequate prior substantiation; health-related benefit/safety claims generally require competent and reliable scientific evidence. A disclosure must be difficult to miss and understandable, cannot contradict the claim, and cannot repair a misleading net impression.                                                                                                                                                                                                                    |
| [FTC Endorsement Guides FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)                                                                                                                                                                                                                                                       | An affiliate relationship must be disclosed clearly and conspicuously close to the recommendation. `Affiliate link`, `buy now`, and `commissionable link` may be inadequate; the FTC FAQ identifies `Paid link` placed immediately next to the link as an example likely to communicate the relationship. Disclosure does not substantiate a product claim or prove commission-independent ranking.                                                                                                                                                       |
| [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)                                                                                                                                                                                                                                   | The July 2024 amendments expressly encompass covered health apps and similar products. Counsel must determine whether the exact multi-source record and processor architecture makes Layerwell a PHR vendor, PHR-related entity, or service provider, and must map incident handling to unauthorized acquisition of unsecured PHR-identifiable health information; unauthorized access creates a rebuttable presumption of acquisition.                                                                                                                      |
| [Washington My Health My Data Act, RCW 19.373.030](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.030)                                                                                                                                                                                                                                                                        | Counsel must map recommendation/profile/Shelf processing and any third-party commerce disclosure to the required notices, separate collection/sharing consent, processors, withdrawal, deletion, and sale-authorization rules.                                                                                                                                                                                                                                                                                                                            |
| [California Attorney General CCPA overview](https://oag.ca.gov/privacy/ccpa) and [health-app advisory](https://www.oag.ca.gov/news/press-releases/attorney-general-bonta-emphasizes-health-apps-legal-obligation-protect)                                                                                                                                                          | Health information and inferences can be sensitive personal information. Applicability, notices, rights, consent, sharing, service-provider terms, and sensitive-data limits require exact counsel review; a generic HIPAA statement is not enough.                                                                                                                                                                                                                                                                                                       |
| [Office of the Privacy Commissioner of Canada meaningful-consent guidance](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/)                                                                                                                                                                                       | Key collection, use, disclosure, risk, withdrawal, and third-party consequences must be understandable at the decision point; sensitive and non-integral uses need appropriately express, unbundled choices.                                                                                                                                                                                                                                                                                                                                              |
| [Québec Commission d'accès à l'information — Loi 25 changes](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25)                                                                                                                                                                                            | Sensitive information, profiling/automated decisions, each specific purpose, cross-border assessments, privacy impact assessments, transparency, and withdrawal need Québec-specific review.                                                                                                                                                                                                                                                                                                                                                              |
| [Ontario IPC PHIPA guide](https://www.ipc.on.ca/sites/default/files/legacy/Resources/hguide-e.pdf)                                                                                                                                                                                                                                                                                 | Counsel must determine whether Layerwell or a partner is a health information custodian/agent and then map PHIPA duties; the checkpoint does not assume PHIPA or HIPAA applies or does not apply.                                                                                                                                                                                                                                                                                                                                                            |
| [FDA cosmetics labeling claims](https://www.fda.gov/cosmetics/cosmetics-labeling/cosmetics-labeling-claims)                                                                                                                                                                                                                                                                        | FDA does not maintain a pre-approved list of cosmetic claims. Cosmetic labeling must be truthful and not misleading; claims that a product treats/prevents disease or affects body structure/function, including skin, make it a drug claim under the cited framework even when appearance is also affected. Layerwell must not infer a lawful claim from a product's cosmetic category or marketplace listing, and exact app/product wording still needs market-specific regulatory review.                                                                 |
| [Health Canada cosmetic advertising](https://www.canada.ca/en/health-canada/services/cosmetics/cosmetic-advertising-labelling-ingredients.html) and [cosmetic-drug interface guidance](https://www.canada.ca/en/health-canada/services/consumer-product-safety/reports-publications/industry-professionals/guidance-document-classification-products-cosmetic-drug-interface.html) | Canadian classification depends on representation and composition. Therapeutic claims are not allowed for ordinary cosmetics; exact products and claims need market-specific regulatory review.                                                                                                                                                                                                                                                                                                                                                           |
| [ShopMy Terms of Service](https://shopmy.us/legal/terms-of-service) and [Privacy Policy](https://shopmy.us/legal/privacy-policy)                                                                                                                                                                                                                                                   | Terms, allowed integration, data roles, commission mechanics, deletion/retention, and privacy language were current only on the access date. Contractual approval, DPA/data-flow review, and re-check at integration and release remain mandatory.                                                                                                                                                                                                                                                                                                        |

## Verification Boundary

The structural contract is
[`scripts/core06/recommendation-admission-source-contract.test.mjs`](../../scripts/core06/recommendation-admission-source-contract.test.mjs).
It is intended to bind the literal zero-product mode, exhaustive current
provenance, goal-active positive gate, commerce guard, database cache seal,
source documentation, and mandatory verification wiring. Passing it proves
only the tested source structure.

Focused mobile tests and the database/forward-upgrade contracts must prove the
executable boundary. Human-simulated E2E must cover the exact-current branches
in [`docs/USER_FLOW_TREE.md`](../USER_FLOW_TREE.md), including empty/one/full
Shelf states, direct entries, goal-gate failures, no-product states, commerce
flag plus consent, retailer-request absence, failure recovery, three supported
iPhone viewports, text pressure, accessibility, reload, and poor network.

Historical recommendation screenshots predate this checkpoint. They may
support layout regression analysis but do not prove the positive admission
boundary or current launch readiness.

### 2026-07-28 source verification record

This record is limited to commands rerun against the current adversarially
hardened source. It records the source-contract, script syntax, local Markdown
links, and diff-whitespace checks only. It does not claim database execution,
mobile test, browser/E2E, hosted, native, archive, professional, legal, or App
Store results.

- `node --check
scripts/core06/recommendation-admission-source-contract.test.mjs`: passed.
- `node --test
scripts/core06/recommendation-admission-source-contract.test.mjs`: 13/13
  tests passed, including the blocking zero-product detail-copy and exact
  fragrance-claim assertions.
- The six CORE-06A recommendation Markdown sources passed the local relative-link
  check.
- `git diff --check`: passed.

### 2026-07-29 exact local database record

`npm run phase2:db-local-verify` exited 0 against the complete 70-migration
chain through `20260726000071`. All four sequential forward cutovers, two clean
resets, exact history, the focused current-head lane, 15 structural pgTAP files
/ 1,199 assertions, error-level lint, empty migration-shadow drift, temporary
type generation, CAT-08 10/10, and teardown passed. Repository types were
deliberately not replaced. This is disposable local PostgreSQL 15 source
evidence only; it does not prove hosted, native, archive, professional,
legal/privacy, or App Store acceptance.

## Remaining Work

1. Complete exact-current human-simulated E2E and retain governed evidence.
2. Obtain the catalog, professional, legal/privacy, affiliate, hosted, native,
   archive, and App Store evidence above.
3. Define and review the versioned product-specific successor contract before
   implementing product ranking.

No source or external artifact currently guarantees Apple approval, legal
compliance, product safety, seven-figure revenue, or any revenue.
