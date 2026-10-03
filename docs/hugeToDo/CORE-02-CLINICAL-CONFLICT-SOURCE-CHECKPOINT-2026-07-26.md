# CORE-02 Clinical Conflict Source Checkpoint — 2026-07-26

Status: `in_progress` source implementation; **zero conflict rules are
production-admitted**

This checkpoint advances CORE-02 without claiming clinical clearance, legal
clearance, App Store acceptance, launch readiness, or a revenue outcome. It
turns the existing 13-row interaction matrix into a fail-closed candidate
corpus and makes professional review evidence—not bundled availability—the
publication authority.

## Implemented source boundary

- The canonical 13-rule corpus is `draft_blocked`. Its trust-authority registry
  and detached review-receipt list are empty.
- Production admission requires three independent roles bound to the exact
  corpus and rule bytes: a board-certified dermatologist, a qualified cosmetic
  chemist, and separate regulatory counsel. This intentionally follows the
  current Lean V1 `conflict_engine` launch contract exactly; a pharmacist may
  provide research input but does not substitute for the required cosmetic
  chemist admission receipt.
- A source record cannot become reviewed authority from a citation string or
  URL alone. Positive admission requires a retained evidence artifact identity,
  artifact reference, and non-zero SHA-256 for every source record. The current
  candidate registry deliberately leaves all three values null, so no source
  can be positively admitted by changing `reviewStatus` alone.
- The detached signed review body binds each source ID to the SHA-256 of its
  exact citation string plus its retained artifact identity/reference/content
  hash. Each reviewer receipt also binds a separately retained independence and
  conflict-of-interest disclosure reference and SHA-256.
- Reviewer identity, credential-evidence byte hash, corpus/source/rule hashes,
  jurisdiction/market-policy hashes, decision, dates, expiry, and a detached
  Ed25519 signature are part of the signed contract. The present Hermes
  boundary has no sound detached-signature verifier, so the verifier
  deliberately returns false and admission remains impossible.
- Runtime-admitted corpus objects carry a module-private `WeakSet` provenance
  brand. A structurally forged TypeScript object, a legacy `reviewedBy` string,
  an ad hoc rule array, or a copied hash shape cannot open the production
  evaluator.
- Candidate applicability is participant-specific and independently covers
  molecule, finished product, finished formulation, concentration, amount,
  area, frequency, duration, pH, vehicle, occlusion, barrier condition,
  exposure, and exact reproductive context. Review-required facts fail closed.
- Breastfeeding, unknown, prefer-not-to-answer, and no-applicable-context
  remain distinct and cannot borrow pregnancy rule copy. The current CORE-01
  profile deliberately stores the combined UI answer `Pregnant or trying` as
  `pregnant`; it does **not** preserve pregnancy and trying-to-conceive as
  distinct states. A future safety corpus must therefore either be reviewed
  explicitly for that combined state or follow a separately versioned profile
  migration that splits it. This checkpoint does not claim the split exists.
- Missing corpus admission or pair coverage returns
  `unsupported_unreviewed`; no assessable pair returns the non-claim
  `not_applicable` state. Neither state is reported as compatibility.
- Every untagged physical product pair and every untagged product against an
  active reproductive context receives a distinct non-identifying
  `unassessable_pair` coverage key. Those keys are unioned with parsed-pair
  coverage even on a mixed shelf, so one assessable pair cannot hide another
  pair that the evaluator could not assess.
- Severity branches do not use array order as a tie-breaker. Missing branch
  facts return `unsupported_missing_facts`; more than one matching branch
  returns `unsupported_ambiguous_branches`. Detection withholds an unresolved
  severity, coverage remains unsupported, and recommendations exclude the
  affected type regardless of rule order.
- A typed Ask conflict question resolves only when it names exactly two
  unambiguous stored products, then filters admitted conflicts to those exact
  product IDs. Partial or duplicate-name questions refuse instead of borrowing
  a different shelf pair. The suggested conflict prompt remains shelf-wide
  only when admitted coverage is available.
- Replenishment cannot become implicit reproductive-safety guidance. For an
  exact pregnant/combined, breastfeeding, trying, unknown, or
  prefer-not-to-answer state, repurchase copy for retinoid, hydroquinone, and
  BHA rows is withheld until admitted clearance exists; unrelated replenishment
  remains eligible. The legacy coarse caution bit alone does not invent a
  reproductive status or exclusion.
- Shelf, routine, scheduler, Ask, recommendations, conflict detail, conflict
  choice, and conflict-share consumers require production admission before
  using claim-bearing rule copy. Candidate preview helpers have no production
  consumer.
- With zero admission, Ask derives interaction availability only from
  `compatible` or `reviewed_interactions`. It suppresses both the proactive
  conflict lead and the suggested conflict prompt, and zero-admission copy says
  the capability is unavailable and requires completed independent
  professional review rather than claiming that a review is already active.
- Conflict choices bind the exact corpus and rule-content SHA-256. Legacy
  choices without those hashes remain exportable but cannot affect current
  guidance. The client does not mirror choices into the old backend schema.
- Conflict existence, detail, resolution, override, exporter, and
  conflict-only public-link telemetry are prohibited. Conflict share links
  contain only an opaque path; the exporter and destination are
  analytics-free.
- Migration `0066` revokes every table privilege from API roles on the legacy
  `conflict_rules` and `sequencing_rules` relations, forces no-policy RLS, and
  blocks migration-owner data mutations. Migration `0067` preserves static
  lint coverage for the catalog-release wrapper's runtime-created temporary
  table without adding a runtime extension dependency.

## Durable evidence

- `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts`
- `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.test.ts`
- `scripts/core02/clinical-rule-source-contract.test.mjs`
- `docs/phase-3/reviewed-guidance-professional-review-inputs.json`
- `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md`
- `docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md`
- `docs/02-ingredient-intelligence.md`
- `supabase/migrations/20260726000066_legacy_clinical_content_immutability.sql`
- `supabase/tests/database/clinical_content_legacy_seal.test.sql`
- `supabase/migrations/20260726000067_catalog_release_temp_table_lint_contract.sql`
- `supabase/tests/database/catalog_release_temp_table_lint_contract.test.sql`
- `test-results/human-e2e/2026-07-26/core02-conflict-admission-current/`
- `docs/e2e-bug-reports/2026-07-26-core02-ask-fit-evidence-label.md`

The CORE-02 source contract is mandatory in both `phase3:verify` and
`launch:verify`. The Phase 3 review packet includes the exact corpus and both
2026-07-26 gap audits.

## Verification recorded in this checkpoint

- CORE-02 source contract: 16/16 passing.
- Focused intelligence and recommendation regression suite: 81/81 passing,
  including mixed-shelf unassessable coverage, ambiguous severity branches,
  exact applicability, recommendation ambiguity propagation, and
  reproductive-status replacement withholding.
- Analytics sanitizer test: 24/24 passing.
- Phase 7 core-loop, Phase 8 growth/store, and Phase 10 beta-analytics code
  gates pass; their external-evidence warnings remain open and are not treated
  as launch evidence.
- Focused PostgreSQL 15 rehearsals for `0066` and `0067` pass. The exhaustive
  current-head database replay is recorded separately only when its complete
  command exits; an in-flight run is not a pass.
- 2026-07-29 update: the complete 70-migration PostgreSQL 15 gate through
  `0071` exited 0, including all four forward cutovers, two clean resets, the
  15-file / 1,199-assertion pgTAP suite, lint, empty drift, temporary type
  generation, CAT-08 10/10, and teardown. This local result does not replace
  hosted, device, professional-review, or release evidence.
- A local, folder-specific human-simulated Expo-web observation at the supported
  390 x 844 viewport records the ordinary zero-admission Shelf, Ask
  prompt-hiding, exact typed-pair refusal, stale-detail, invalid public-share,
  and paywall non-sale/disclosure states against source commit
  `c78208ef1da9dd4b3c5f385d421541f8741dba3c`. The pass found and fixed one
  unbound `Evidence: established` label in the deterministic Ask fit answer.
  The retained console snapshot contains 96 expected development warnings and
  zero errors only through `2026-07-26T13:11:31.816Z`; it predates the final
  screenshots, and no post-flow console export is retained. The tester observed
  `Back to Shelf` return to `/shelf`, but no post-click screenshot or trace is
  retained. This is local Expo-web evidence, not native or submitted-build
  proof.
- The repository-wide human-E2E manifest stops before this packet on the
  pre-existing absent 2026-07-22 CAT07 shelf-freshness folder. The governed
  CAT07 runner writes live timestamps while that manifest requires
  `2026-07-22T...`, so rerunning it on 2026-07-26 would not truthfully repair
  the missing packet. No CORE-02 packet contract is currently registered in the
  manifest either. The CAT07 runner contract passes 38/38; no evidence was
  fabricated or backdated.

## Remaining release gates

1. Qualified professionals must review and sign the exact candidate corpus;
   every held/revise item in the clinical evidence audit must be resolved. The
   exact source snapshots or source manifests they review must be retained and
   byte-hashed into every source record before any positive admission.
2. A reviewed native detached-signature verification boundary and separately
   reviewed trust-root change must exist before any receipt can admit content.
3. Regulatory counsel must classify the exact U.S. release functions, claims,
   privacy flows, seller entity, and storefront scope. Canada and Quebec remain
   excluded from this corpus.
4. A submitted build cannot expose temporary `under review` feature shells.
   Before submission, each gated conflict/Ask/recommendation surface and its
   prompts, upsells, routes, metadata, and screenshots must be either complete
   and reviewed or removed/hidden, with non-obvious retained functionality
   disclosed in Review Notes. Any medical-decision surface must carry the
   applicable doctor reminder; measurement/accuracy claims require validated
   supporting data and disclosed methodology.
5. Final policy/support URLs, legal seller and brand, production services,
   subscriptions, App Store Connect record, active demo account or
   Apple-preapproved fully featured demo mode, exact signed archive,
   physical-device QA, privacy-manifest/SDK/network evidence, and Apple-issued
   review outcome remain external launch gates.
6. The dependency on CORE-01 remains until the exact production profile and age
   provenance path is accepted by its own launch contract. That decision must
   also resolve whether `Pregnant or trying` remains a combined precautionary
   state or becomes two separately versioned, reviewed states.

The source now fails closed at the current code boundary. This checkpoint
records a current folder-specific human-simulated Expo-web observation but does
not claim manifest admission and does not record the in-flight exhaustive
database replay. It is not a substitute for professional signoff, an
exact-release legal decision, native/physical-device evidence, or Apple's
review.
