# Clinical Conflict-Rule Evidence Audit — 2026-07-26

Status: candidate evidence packet; **not clinically, chemically, legally, or
regulatorily approved**

Audit date: 2026-07-26

Scope: the 13 version-1 candidate interaction rules identified by UUID below,
as represented in the legacy `rules.ts` corpus and its
`conflictRuleCorpus.v1.ts` migration candidate. This document is evidence and
review guidance only. It is not production copy, a prescription, a diagnosis,
or a substitute for the detached phase-3 signoff process.

## Launch-blocking approval contract

No rule in this document is cleared for user exposure. Before any rule can be
admitted to production, OnSkin must bind all approvals to the exact canonical
rule bytes, source-corpus bytes, rule version, and SHA-256 hashes used by the
release:

1. A board-certified dermatologist, or a clinician with equivalent relevant
   scope and documented jurisdiction, must approve the clinical accuracy,
   severity, resolution, pregnancy/lactation treatment, and user-facing copy.
2. A qualified cosmetic chemist or pharmacist must independently approve the
   molecule, concentration, pH, vehicle, delivery system, packaging, stability,
   fixed-combination, and layering claims.
3. Regulatory counsel must separately clear the intended jurisdictions,
   product-versus-drug boundary, claims, referral language, disclaimers, and
   store/listing implications.

Reviewer identity, credential, jurisdiction, date, expiry or re-review date,
conditions, exact approved text, evidence reference, and detached signoff must
be retained. A changed rule, source, mechanism, severity, resolution, qualifier,
or user-facing string invalidates the prior approval. A non-empty `reviewedBy`
string is not evidence of identity, qualification, independent review, or
approval and must never be sufficient for admission.

The three authorities must use three distinct validated Ed25519 public-key
fingerprints; three role labels backed by one key are not independent review.
Distinct signing keys prove distinct keys, not substantive independence. Each
reviewer must sign employer, sponsor, financial-interest, material-connection,
and conflict disclosures, and regulatory counsel must clear any public
`independent review` claim.
Every receipt must also bind the exact profile-context contract: the current
stored value `pregnant` means the combined UI answer `Pregnant or trying`, not
a separately proven pregnancy fact. Reviewers must approve that combined
semantic or require a versioned profile split. Any variable severity branch
must bind its exact applicability and canonical presentation bytes. Missing
branch facts keep the outcome unsupported rather than falling back to a
different visible severity.

## Audit method and disposition vocabulary

The audit prioritized original studies, current FDA labels and guidance, and
authoritative clinical guidance. It is not a completed systematic review and
does not establish safety for an individual. Absence of a located interaction
study is not evidence that an interaction cannot occur.

- **Supported with limits**: the direction of the candidate rule has direct or
  authoritative support, but only within the stated molecule, formulation,
  dose, vehicle, population, and copy constraints.
- **Revise**: part of the rule is defensible, but the current mechanism,
  severity, resolution, evidence label, or scope overstates the evidence.
- **Hold**: the evidence found does not support a user-facing rule at the
  current level of generality. Keep it unavailable until the named evidence and
  approvals exist.

The proposed constraints below are reviewer inputs, not approved replacement
copy.

## Cross-cutting corrections required before review

- “Retinoid,” “vitamin C,” “BHA,” and “copper peptide” are not
  molecule-specific. Retinol, retinal, retinyl esters, tretinoin, adapalene,
  tazarotene, L-ascorbic acid, ascorbyl derivatives, salicylic acid, other
  hydroxy acids, free copper, and GHK-Cu cannot inherit one another’s evidence
  without a documented bridge.
- Exposure is not concentration alone. Amount applied, surface area, frequency,
  duration, rinse-off versus leave-on use, occlusion, vehicle, pH, delivery
  system, damaged skin, and direct infant contact can materially change the
  conclusion.
- “Encapsulated,” “low dose,” “high dose,” “sensitive,” and “resistant” require
  defined, testable criteria. Generic `coUseIf: resistant` logic is not an
  evidence-based override.
- A validated fixed-combination or finished formulation may not be treated as
  equivalent to arbitrary layering of its named ingredients. An exemption must
  identify the exact product or formulation and must not erase a separate
  irritation warning.
- Unknown concentration or formulation data must not silently bypass a
  pregnancy or safety warning. Unknown exposure requires a cautious,
  non-diagnostic branch and professional referral where the reviewer requires
  it.
- Multiple applicable interactions must be preserved. A first-pair-only match
  cannot safely suppress a second safety, irritation, or stability rule.
- “Alternate nights,” “AM/PM separation,” and “one acid per session” are
  conservative options, not universal chemical laws. Copy must explain when
  they are warranted and allow an exact reviewed fixed-formulation exemption.
- Evidence labels must describe the proposition actually supported. For
  example, “retinoids and acids cancel each other” may be contested while
  additive irritation remains plausible; those are different propositions.
  `Plausible`, `contested`, `established`, or `refuted` alone are vague
  consumer qualifiers and cannot be the only disclosure of material limits.

## Rule-by-rule evidence record

### 1. Retinoid × AHA

Candidate ID: `00000000-0000-4000-8000-000000000001`

Current candidate: irritation; mild; grade C; `contested`; alternate nights.

Disposition: **Revise — conditional support for additive irritation, not a
universal incompatibility.**

Evidence assessment: the current Differin label warns that products containing
alpha hydroxy or glycolic acids may worsen irritation during adapalene use. FDA
also recognizes irritation and sun-sensitivity concerns for cosmetic AHAs. This
supports an irritation warning for relevant leave-on exposures, especially
during initiation or on an impaired barrier. It does not establish that every
retinoid and every AHA “over-exfoliate,” cancel each other, or must always be
used on different nights.

Mechanism constraint: say only that both products can independently cause
dryness, erythema, burning, or peeling and that concurrent use may increase
irritation. Do not use “both speed surface turnover” as a universal mechanistic
explanation.

Copy/resolution constraint: alternate nights or reduced frequency may be
offered as a conservative tolerance strategy. It must not be framed as a
mandatory chemistry separation. Qualify by exact retinoid molecule, AHA
identity, concentration, final pH, leave-on/rinse-off status, frequency,
surface area, vehicle, skin condition, and exact fixed formulation.

Pregnancy/lactation: this pair rule must not imply reproductive safety. Apply
the molecule-specific rule 11 independently.

Sources:

- FDA, [Differin (adapalene) label, 2024](https://www.accessdata.fda.gov/drugsatfda_docs/label/2024/020380Orig1s021lbl.pdf).
- FDA, [Guidance for Industry: Labeling for Cosmetics Containing Alpha Hydroxy Acids](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-labeling-cosmetics-containing-alpha-hydroxy-acids).

### 2. Retinoid × BHA

Candidate ID: `00000000-0000-4000-8000-000000000002`

Current candidate: irritation; mild; grade C; `contested`; alternate nights.

Disposition: **Revise — conditional, molecule-specific support.**

Evidence assessment: a current tretinoin microsphere label warns that topical
products containing salicylic acid may increase irritation. FDA’s BHA consumer
information also describes irritation as a relevant adverse effect. This is
support for a tretinoin/salicylic-acid tolerance warning, not proof for every
retinoid, every BHA, or every concentration.

Mechanism constraint: limit the statement to potentially additive irritation
and barrier symptoms. Do not infer a stability interaction.

Copy/resolution constraint: alternate nights, lower frequency, or stopping the
newest irritant can be reviewer-approved options for relevant leave-on
exposures. Do not permit a generic “resistant skin” bypass. Qualify exact
molecule, concentration, final pH, vehicle, leave-on/rinse-off status,
frequency, surface area, existing irritation, and reviewed fixed formulation.

Pregnancy/lactation: evaluate topical retinoid and salicylic acid separately
under rules 11 and 12; this pair rule cannot clear either exposure.

Sources:

- DailyMed/FDA label, [tretinoin gel microsphere](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=57558405-42fa-40bb-a61c-48e030d976de&type=display).
- FDA, [Beta Hydroxy Acids](https://www.fda.gov/cosmetics/cosmetic-ingredients/beta-hydroxy-acids).

### 3. Benzoyl peroxide × retinoid

Candidate ID: `00000000-0000-4000-8000-000000000003`

Current candidate: stability; moderate; grade C; `established`; separate AM/PM;
adapalene and any “encapsulated” retinoid exempted.

Disposition: **Revise — established only for specified molecules and
formulations.**

Evidence assessment: an original stability study found rapid light-exposed
degradation of tretinoin 0.025% gel mixed with benzoyl peroxide 10% lotion.
Separate work found no degradation over seven hours for an optimized aqueous
tretinoin 0.05% gel with benzoyl peroxide. FDA-approved adapalene/benzoyl
peroxide and separately microencapsulated tretinoin/benzoyl peroxide products
also demonstrate that formulation can change the conclusion. These data do not
support “simple retinol/tretinoin” as one class or an exemption for anything
marketed as encapsulated.

Mechanism constraint: identify oxidative/photolytic instability only for the
tested tretinoin/formulation context. Do not extrapolate the degradation rate
to retinol, retinal, retinyl esters, adapalene, tazarotene, or an untested
vehicle.

Copy/resolution constraint: AM/PM separation is a conservative option when an
unvalidated tretinoin/benzoyl-peroxide layering combination is otherwise
appropriate. `no_change` requires the exact validated fixed product or
formulation, not a subflag. A stability exemption must not suppress additive
irritation or the relevant drug label.

Pregnancy/lactation: the exact retinoid still requires the independent rule 11
assessment.

Sources:

- Martin et al., [Chemical stability of adapalene and tretinoin when combined with benzoyl peroxide](https://onlinelibrary.wiley.com/doi/full/10.1046/j.1365-2133.1998.1390s2008.x),
  _Br J Dermatol_ (1998), DOI
  `10.1046/j.1365-2133.1998.1390s2008.x`.
- Del Rosso, [Stability of tretinoin in a novel tretinoin gel formulation when combined with benzoyl peroxide](https://pubmed.ncbi.nlm.nih.gov/20967192/),
  PMID `20967192`.
- FDA, [Epiduo Forte label](https://www.accessdata.fda.gov/drugsatfda_docs/label/2022/207917Orig1s004s008lbl.pdf).
- FDA, [Twyneo label](https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/214902s000lbl.pdf).

### 4. Niacinamide × vitamin C

Candidate ID: `00000000-0000-4000-8000-000000000004`

Current candidate: myth; none; `refuted`; reassure.

Disposition: **Revise — retain only a narrow no-required-separation
reassurance.**

Evidence assessment: the cited 1963 experiment studied nicotinamide
(niacinamide) with ascorbic acid; it did not establish a routine-use
incompatibility. The historical-study explanation must not say that it used
niacin. At the same time, absence of a required separation does not prove
synergy, improved outcomes, or compatibility of every derivative and
formulation.

Mechanism constraint: do not claim neutralization or conversion to niacin in
ordinary use. State only that the located evidence does not require routine
separation, subject to the finished formulation.

Copy/resolution constraint: “No evidence requires routine separation” is a
candidate boundary. Do not say the ingredients “work better together.”
Qualify L-ascorbic acid versus derivatives, niacinamide concentration, final pH,
vehicle, storage, packaging, and finished-formulation stability/tolerance.

Pregnancy/lactation: no pair-specific conclusion; formulation and intended-use
review still apply.

Sources:

- Guttman and Brooke, [Nicotinamide and ascorbic acid interaction study](https://pubmed.ncbi.nlm.nih.gov/14076500/),
  PMID `14076500`.
- [Effect of pH on topical niacinamide delivery](https://pubmed.ncbi.nlm.nih.gov/41872243/),
  PMID `41872243`.
- Cosmetic Ingredient Review,
  [Safety Assessment of Niacinamide and Niacin](https://cir-reports.cir-safety.org/view-attachment/?id=39cd1a17-8e74-ec11-8943-0022482f06a6),
  DOI `10.1080/10915810500434183`.

### 5. Vitamin C × AHA

Candidate ID: `00000000-0000-4000-8000-000000000005`

Current candidate: irritation; mild; grade C; `contested`; separate AM/PM.

Disposition: **Revise — plausible cumulative irritation; mandatory separation
not established.**

Evidence assessment: L-ascorbic acid penetration is pH- and
concentration-dependent in the tested vehicle, while FDA’s AHA guidance uses a
consumer-product envelope that includes final pH and concentration. A clinical
study of a 20% glycolic-acid and 10% L-ascorbic-acid regimen reported minimal
irritation in its specific use context. The evidence therefore does not support
the blanket statement that all vitamin C products and AHAs are chemically
compatible because both “favor low pH,” nor that all must be split AM/PM.

Mechanism constraint: limit to possible cumulative stinging, dryness, or
irritation. Separate L-ascorbic acid from ascorbyl derivatives; do not infer
behavior from ingredient names alone.

Copy/resolution constraint: separation, reduced frequency, or introduction one
at a time may be offered when potency, low pH, leave-on exposure, an impaired
barrier, or observed irritation warrants it. Qualify exact molecule,
concentration, final pH, vehicle, surface area, frequency, and fixed
formulation.

Pregnancy/lactation: no pair-specific conclusion.

Sources:

- Pinnell et al., [Topical L-ascorbic acid: percutaneous absorption studies](https://pubmed.ncbi.nlm.nih.gov/11207686/),
  PMID `11207686`.
- Ash et al.,
  [A randomized controlled trial of glycolic acid plus L-ascorbic acid for striae alba](https://pubmed.ncbi.nlm.nih.gov/9723049/),
  PMID `9723049`.
- FDA, [Guidance for Industry: Labeling for Cosmetics Containing Alpha Hydroxy Acids](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-labeling-cosmetics-containing-alpha-hydroxy-acids).

### 6. Copper peptide × vitamin C

Candidate ID: `00000000-0000-4000-8000-000000000006`

Current candidate: stability; mild; grade C; `plausible`; separate AM/PM.

Disposition: **Hold user-facing output.**

Evidence assessment: primary solution-chemistry studies support copper-catalyzed
ascorbic-acid oxidation under specified aqueous conditions. They do not
establish clinically meaningful loss of topical vitamin C when a chelated
cosmetic copper peptide such as GHK-Cu is layered on skin. A GHK-Cu
preformulation study is formulation-specific and cannot bridge that gap.

Mechanism constraint: do not equate free copper ions with every copper-peptide
complex or in-solution kinetics with on-skin layered use.

Copy/resolution constraint: remove automatic AM/PM separation and severity
until direct evidence or qualified formulation data address the exact copper
complex, vitamin-C molecule, concentrations, final pH, vehicle, packaging,
order, dry-down, and contact conditions.

Pregnancy/lactation: no pair-specific conclusion; absence of an interaction
rule is not reproductive-safety clearance.

Sources:

- [Kinetics of copper-mediated ascorbic-acid oxidation](https://pubmed.ncbi.nlm.nih.gov/38081796/),
  PMID `38081796`.
- [Copper/ascorbate generation of reactive oxygen species](https://pubmed.ncbi.nlm.nih.gov/19071607/),
  PMID `19071607`.
- [Preformulation stability of GHK-Cu](https://pubmed.ncbi.nlm.nih.gov/25384620/),
  PMID `25384620`.

### 7. Copper peptide × AHA

Candidate ID: `00000000-0000-4000-8000-000000000007`

Current candidate: stability; mild; grade C; `plausible`; separate AM/PM.

Disposition: **Hold and remove from user-facing output.**

Evidence assessment: no primary clinical or finished-cosmetic study was located
that supports the blanket claim that low-pH AHAs destabilize topical copper
peptides when layered. The located GHK-Cu preformulation study found condition-
and stressor-specific stability; it does not prove either universal
compatibility or universal incompatibility.

Mechanism constraint: do not say “acids destabilize peptides” as a class
effect. Do not extend an AHA hypothesis to salicylic acid or all “acids.”

Copy/resolution constraint: no automatic separation until evidence and
chemistry review cover exact peptide/copper complex, AHA, concentrations, final
pH, vehicle, packaging, temperature, exposure time, order, and finished
formulation.

Pregnancy/lactation: no pair-specific conclusion.

Sources:

- [Preformulation stability of GHK-Cu](https://pubmed.ncbi.nlm.nih.gov/25384620/),
  PMID `25384620`.
- FDA, [Guidance for Industry: Labeling for Cosmetics Containing Alpha Hydroxy Acids](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-labeling-cosmetics-containing-alpha-hydroxy-acids)
  (regulatory AHA context, not evidence of a copper-peptide interaction).

### 8. AHA × BHA

Candidate ID: `00000000-0000-4000-8000-000000000008`

Current candidate: irritation; moderate; grade C; `plausible`; lower frequency
and use one acid per session.

Disposition: **Revise — conditional support for cumulative irritation.**

Evidence assessment: FDA materials recognize irritation as relevant to both AHA
and BHA products. That supports a cautious cumulative-irritation rule for
potent leave-on stacking, but not a universal moderate-severity conflict or
“one acid per session” rule for low-strength, rinse-off, or deliberately
formulated combination products.

Mechanism constraint: say that multiple keratolytic/exfoliating products may
increase irritation depending on exposure. Avoid the undefined diagnosis
“over-exfoliation.”

Copy/resolution constraint: use one acid, lower frequency, or alternate use only
when exact strength, final pH, leave-on exposure, frequency, area, barrier
condition, or symptoms warrant it. Exempt only an exact reviewed finished
formulation; do not infer safety from the presence of both ingredients alone.

Pregnancy/lactation: salicylic-acid reproductive guidance is independent; apply
rule 12 when applicable.

Sources:

- FDA, [Guidance for Industry: Labeling for Cosmetics Containing Alpha Hydroxy Acids](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/guidance-industry-labeling-cosmetics-containing-alpha-hydroxy-acids).
- FDA, [Beta Hydroxy Acids](https://www.fda.gov/cosmetics/cosmetic-ingredients/beta-hydroxy-acids).

### 9. Vitamin C × sunscreen

Candidate ID: `00000000-0000-4000-8000-000000000009`

Current candidate: synergy; none; grade C; `plausible`; no change.

Disposition: **Supported with limits as adjunctive antioxidant evidence, not an
SPF claim.**

Evidence assessment: a human study found that a specific stable formulation of
15% L-ascorbic acid, 1% alpha-tocopherol, and 0.5% ferulic acid reduced measured
UV-associated skin responses. It did not test every vitamin-C derivative,
arbitrary layering, or an increase to a sunscreen’s labeled SPF.

Mechanism constraint: attribute the evidence to the tested antioxidant
formulation. Do not generalize the result to any product tagged `vitamin_c`.

Copy/resolution constraint: any approved copy must say that an antioxidant is
an adjunct and does not replace broad-spectrum sunscreen, sufficient
application, reapplication, or other sun protection. Do not claim boosted SPF,
longer wear, or reduced reapplication. Chemistry review must address order,
dry-down, pilling, and whether layering can disrupt the sunscreen film.

Pregnancy/lactation: no pair-specific conclusion.

Source:

- Murray et al.,
  [A topical antioxidant solution containing vitamins C and E stabilized by ferulic acid protects human skin from UV damage](https://pubmed.ncbi.nlm.nih.gov/18603326/),
  PMID `18603326`.

### 10. Niacinamide × retinoid

Candidate ID: `00000000-0000-4000-8000-00000000000a`

Current candidate: synergy; none; grade C; `plausible`; no change; claims
niacinamide can ease retinoid dryness.

Disposition: **Revise to neutral compatibility; hold the mitigation/synergy
claim.**

Evidence assessment: a controlled patch study found that 3% niacinamide did not
relieve retinol-induced irritation in its test conditions. A separate study of
a moisturizer containing ceramides and niacinamide used with
adapalene/benzoyl-peroxide did not isolate niacinamide’s effect. These sources
do not support a generic claim that niacinamide tempers retinoid dryness.

Mechanism constraint: do not attribute barrier support or reduced retinoid
irritation to niacinamide for all products. A no-warning state may be reviewed
independently from a positive efficacy claim.

Copy/resolution constraint: candidate boundary: no evidence found that requires
routine separation. Remove “complement each other” and “can ease retinoid
dryness” unless an exact formulation and population are supported. Qualify
retinoid molecule, niacinamide concentration, vehicle, regimen, and co-actives.

Pregnancy/lactation: the retinoid still requires rule 11.

Sources:

- [Evaluation of niacinamide for retinol-induced irritation](https://pubmed.ncbi.nlm.nih.gov/38628085/),
  PMID `38628085`.
- [Ceramide/niacinamide moisturizer used with adapalene and benzoyl peroxide](https://pubmed.ncbi.nlm.nih.gov/38299457/),
  PMID `38299457`.

### 11. Retinoid × pregnancy

Candidate ID: `00000000-0000-4000-8000-00000000000b`

Current candidate: safety; high; grade C; `contested`; avoid/refer; pregnancy
condition, but copy also says breastfeeding.

Disposition: **Supported with limits for pregnancy avoidance/referral; split
pregnancy from breastfeeding and split by molecule.**

Evidence assessment: ACOG and AAD recommend avoiding topical retinoids during
pregnancy. Tazarotene is specifically contraindicated in pregnancy by its FDA
label. A meta-analysis of inadvertent first-trimester topical retinoid exposure
did not find a significant increase in major adverse outcomes, but the authors
stated that the evidence was insufficient to justify intentional use. The
clinical recommendation is therefore precautionary; labeling the entire
evidence proposition `contested` is misleading.

Mechanism constraint: do not infer fetal harm from topical exposure as an
established causal mechanism. State that retinoids are molecule-specific, human
pregnancy data are limited, and professional bodies recommend avoidance; call
out tazarotene’s contraindication separately.

Copy/resolution constraint: pregnancy copy may recommend stopping/avoiding and
contacting the prenatal clinician. It should not alarm a user after inadvertent
exposure or imply a diagnosed outcome. Do not automatically recommend
“pregnancy-safe” substitutes without their own review.

Pregnancy versus breastfeeding:

- **Pregnancy:** avoid/refer is a defensible candidate direction; preserve
  molecule-specific labels and do not downgrade tazarotene’s contraindication.
- **Breastfeeding:** do not reuse the pregnancy rule. LactMed describes topical
  tretinoin and adapalene as low risk because of poor absorption, with the
  smallest area/shortest duration and no nipple, areola, or direct infant-skin
  contact. Tazarotene is less certain, especially on larger areas. The final
  decision needs a separate molecule-specific clinical review.

Formulation/exposure limits: molecule, strength, body surface area, damaged
skin, occlusion, frequency, duration, and direct infant contact.

Sources:

- Kaplan et al.,
  [Pregnancy outcomes following first-trimester exposure to topical retinoids: systematic review and meta-analysis](https://pubmed.ncbi.nlm.nih.gov/26215715/),
  PMID `26215715`.
- ACOG, [Skin Conditions During Pregnancy](https://www.acog.org/womens-health/faqs/skin-conditions-during-pregnancy).
- American Academy of Dermatology,
  [Dermatologist-approved pregnancy skin care](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care).
- MotherToBaby, [Topical tretinoin](https://mothertobaby.org/fact-sheets/tretinoin-retin-a-pregnancy/).
- DailyMed/FDA label, [tazarotene](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=021744d1-a6d7-4ad6-99c2-7187c24e64c6).
- LactMed, [tretinoin](https://www.ncbi.nlm.nih.gov/books/NBK501419/),
  [adapalene](https://www.ncbi.nlm.nih.gov/books/NBK501423/), and
  [tazarotene](https://www.ncbi.nlm.nih.gov/sites/books/NBK500668/pdf/Bookshelf_NBK500668.pdf).

### 12. Salicylic acid × pregnancy

Candidate ID: `00000000-0000-4000-8000-00000000000c`

Current candidate: `bha` safety; moderate; grade C; `contested`; avoid/refer
only when a high-dose flag is present.

Disposition: **Revise — conditional caution, exact-molecule scope, and
consistent unknown-exposure handling.**

Evidence assessment: ACOG includes topical salicylic acid among OTC ingredients
that can be used during pregnancy. AAD advises using doses above 2% sparingly
and discussing them with the obstetrician. This does not support categorical
avoidance of all cosmetic BHA, nor does it support silently passing unknown
strength. Percent alone cannot describe systemic exposure.

Mechanism constraint: identify salicylic acid, not the broad `bha` tag. Describe
the uncertainty as exposure-dependent absorption rather than a proven fetal
effect from ordinary topical use.

Copy/resolution constraint: low-area, limited topical use and higher-strength,
large-area, prolonged, occluded, or damaged-skin use need distinct branches.
Unknown strength/area/vehicle must enter a cautious ask-a-clinician branch, not
skip the rule. The professional reviewer must define any numerical threshold
and ensure it matches the product category and jurisdiction.

Pregnancy versus breastfeeding:

- **Pregnancy:** do not call all topical salicylic acid contraindicated. Higher
  or uncertain exposure may warrant limited use and prenatal-clinician review.
- **Breastfeeding:** do not inherit the pregnancy warning. LactMed considers
  topical salicylic acid unlikely to be absorbed enough to affect a breastfed
  infant; avoid the breast and direct contact with treated skin.

Formulation/exposure limits: exact acid, concentration, amount, treated area,
leave-on/rinse-off, duration, frequency, vehicle, occlusion, damaged skin, and
direct infant contact.

Sources:

- ACOG, [Skin Conditions During Pregnancy](https://www.acog.org/womens-health/faqs/skin-conditions-during-pregnancy).
- American Academy of Dermatology,
  [Dermatologist-approved pregnancy skin care](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care).
- MotherToBaby, [Topical acne treatments](https://mothertobaby.org/fact-sheets/topical-acne-treatments-pregnancy/).
- LactMed, [salicylic acid](https://www.ncbi.nlm.nih.gov/books/NBK500675/).
- Cosmetic Ingredient Review,
  [Amended Safety Assessment of Salicylic Acid and Salicylates](https://www.accessdata.fda.gov/drugsatfda_docs/omuf/order/supportDoc/OTC000039/3.3_Literature_References/rev_cir-2019-sunsolv_090026f88e12645c.pdf).

### 13. Hydroquinone × pregnancy

Candidate ID: `00000000-0000-4000-8000-00000000000d`

Current candidate: safety; high; grade C; `contested`; avoid/refer; pregnancy
condition, but copy also says breastfeeding.

Disposition: **Supported with limits as a pregnancy precaution/referral; split
breastfeeding and add jurisdictional drug-status handling.**

Evidence assessment: a human pharmacokinetic study reported substantial dermal
absorption under its tested conditions. Human reproductive data are inadequate,
and AAD recommends avoiding hydroquinone during pregnancy. The mechanism should
be limited to meaningful absorption plus inadequate pregnancy data, rather
than a proven reproductive effect. In the United States, OTC hydroquinone
skin-lightening products are unapproved drugs and cannot be legally marketed;
this requires a regulatory branch independent of pregnancy.

Mechanism constraint: state the measured absorption context and missing
pregnancy data. Do not present fetal harm as established, and do not extrapolate
one vehicle/body-site study to all use.

Copy/resolution constraint: pregnancy avoidance and clinician referral are
defensible candidate directions. In the U.S., route hydroquinone use to a
licensed prescriber and do not imply that an OTC cosmetic hydroquinone product
is lawful or FDA approved. Counsel must approve country-specific handling,
including prescription-drug, cosmetic, compounding, import, marketplace, and
store-copy implications.

Pregnancy versus breastfeeding:

- **Pregnancy:** precautionary avoid/refer because systemic absorption can be
  substantial and reproductive evidence is inadequate.
- **Breastfeeding:** do not call it contraindicated. LactMed says topical
  hydroquinone has not been studied and some experts discourage long-term use;
  prevent infant contact or ingestion and obtain a molecule-specific clinical
  decision.

Formulation/exposure limits: concentration, vehicle, body site and surface
area, skin integrity, duration, frequency, occlusion, prescription status,
country, and direct infant contact.

Sources:

- Wester et al.,
  [Human in vivo and in vitro hydroquinone topical bioavailability](https://pubmed.ncbi.nlm.nih.gov/9638901/),
  PMID `9638901`.
- American Academy of Dermatology,
  [Dermatologist-approved pregnancy skin care](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/pregnancy-skin-care).
- LactMed, [hydroquinone](https://www.ncbi.nlm.nih.gov/books/NBK500669/).
- FDA,
  [FDA works to protect consumers from potentially harmful OTC skin-lightening products](https://www.fda.gov/drugs/drug-safety-communications/fda-works-protect-consumers-potentially-harmful-otc-skin-lightening-products).
- DailyMed, [hydroquinone drug label](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cbec45c9-4adb-4473-8c09-b1217d0f8ebc)
  (label context; not pregnancy-safety proof).

## Corpus and matrix discrepancies to resolve before signoff

The evidence review also identified implementation/documentation mismatches
that can alter which advice a user sees:

- The documented copper-peptide rule covers AHA/BHA, while candidate rule 7 is
  AHA-only. The evidence does not support silently extending it to BHA.
- The documented stacked-acid rule includes vitamin C, while candidate rule 8
  covers only AHA/BHA. Vitamin C needs the distinct, qualified rule 5 analysis.
- The documentation describes both a niacinamide/vitamin-C myth and synergy;
  candidate rule 4 supports only a narrow no-required-separation position.
- Pregnancy and breastfeeding are joined in candidate copy even though the
  conditions encode pregnancy only and the evidence differs materially.
- A high-dose-only pregnancy detector and a separate unknown-concentration
  caution can yield inconsistent salicylic-acid outcomes.
- If pair lookup returns only the first rule, coexisting safety, irritation,
  stability, or fixed-formulation conditions can be hidden.

These are launch blockers, not editorial preferences. Review must inspect the
actual runtime corpus, matching logic, concentration normalization, fallback
behavior, user-visible copy, and exact reviewed packet hashes together.

## Required reviewer outputs

For each rule, reviewers must record one of `Approved`, `Rejected`, or
`Deferred/production-disabled` against the exact snapshot. Approval must also
record:

- exact admitted mechanism, severity, evidence label, resolution, and user copy;
- included and excluded molecules, derivatives, concentrations, pH ranges,
  vehicles, delivery systems, products, and jurisdictions;
- pregnancy and breastfeeding decisions as separate conditions;
- unknown-data behavior and escalation/referral conditions;
- fixed-formulation exemptions by exact identifier and supporting evidence;
- contraindications or drug-label language that must override general advice;
- a claim-by-claim inventory of express claims, implied claims, and the net
  impression across in-app, App Store, paywall, share, and promotional copy;
- competent and reliable scientific evidence matched to the exact molecule,
  formulation, population, exposure, comparator, and claimed outcome, including
  contrary evidence and an accurate statement of evidence strength; expert
  signatures are admission controls, not scientific substantiation;
- clear limitations in the full user-interface context, without relying on a
  vague qualifier or a disclaimer that contradicts the claim;
- the Guideline 1.4.1 doctor reminder wherever the final surface can be used
  for a medical decision, plus supporting data, disclosed methodology, and
  validation for any health-measurement or accuracy claim;
- monitoring/re-review trigger and owner; and
- the dermatologist/clinician, cosmetic chemist/pharmacist, and regulatory
  counsel detached evidence required by the launch-blocking approval contract.

Until all applicable approvals and exact-snapshot controls are present, every
rule remains candidate content and must stay unavailable in production.
