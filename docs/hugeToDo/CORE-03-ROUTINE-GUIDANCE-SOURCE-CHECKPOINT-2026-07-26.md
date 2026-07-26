# CORE-03 Routine Guidance Source Checkpoint — 2026-07-26

## Status

`CORE-03` is `in_progress` and production-zero-admission. This checkpoint
hardens the source candidate and publication boundary; it does not approve
routine sequencing, frequency, cycling, ramping, recovery, stop/refer, medical
claims, a market, an App Store binary, or launch.

The production runtime currently admits:

- zero routine sequencing rules;
- zero cadence or frequency-cap policies;
- zero ramp or recovery policies; and
- zero stop/refer thresholds.

Development fixtures remain available for implementation and testing. They can
be forced closed through the dedicated E2E review-gate variables. They are not
publication authority and must not be represented as professionally reviewed.

## Implemented Source Boundary

The candidate in
`apps/mobile/src/features/routine/routineSequencingCorpus.v1.ts` binds the
following to one canonical SHA-256 content identity:

- exact candidate source records, snapshot dates, retained-artifact identities,
  retained-artifact references, and retained-artifact SHA-256 values;
- one complete, claim-specific mapping from every sequencing, cadence, and copy
  field represented in this corpus version to its exact source propositions;
- all ten sequencing-role records and their individual content;
- frequency-cap, cycle-recovery, ramp, and phased-introduction candidates;
- a U.S.-only market-scope policy; and
- an explicitly unavailable stop/refer policy with no thresholds.

The current source records deliberately contain no retained-artifact identity,
reference, or hash, and their claim mappings deliberately contain no
substantiating source/proposition references. Admission validation rejects
those null and empty values. A live URL and access date are background research,
not proof of the exact bytes a reviewer assessed.

Production admission requires three distinct, current, exact-corpus approval
receipts:

1. a board-certified dermatologist for clinical order, eligibility, and user
   copy;
2. a cosmetic chemist for formulation order and application copy; and
3. regulatory counsel for claims, jurisdiction, and market clearance.

The machine-readable launch contract binds both `routine_builder` and
`cycle_scheduler` to those exact three roles, task IDs, and scopes. CORE-03's
structured dependency list also names `REV-04`, `REV-05`, and `H-07`; prose
alone cannot satisfy or remove those gates.

Each receipt must bind the reviewer identity, credential evidence, trusted
public-key fingerprint, exact source registry, exact rule hashes, jurisdiction,
market-scope hash, decision, signing time, and expiry. Module-private runtime
provenance prevents a structurally similar JavaScript object from becoming
admitted.

The trusted-authority and receipt registries are intentionally empty. The
Hermes boundary has no reviewed detached-signature verifier, and its verifier
therefore returns `false` for every candidate signature. Those are deliberate
launch blockers, not TODO values that a build flag can bypass.

## Fail-Closed Consumer Decisions

- Free-text `reviewedBy` values have no publication authority.
- Production ignores caller-supplied sequencing objects and consumes only a
  runtime-branded admitted corpus.
- Boolean environment approvals and conservative-looking numeric fallbacks no
  longer publish cadence.
- Invalid cadence inputs—including non-finite values, fractions, unsafe
  integers, impossible bounds, and overflow-prone budgets—return a closed
  result.
- Cycle, cadence, recovery, and ramp mutations refuse before private storage,
  React Query cache changes, or analytics when cadence admission is closed.
- Recovery is independently closed unless the exact stop/refer policy is
  admitted and its threshold evaluator is implemented. The evaluator currently
  returns `false` for every policy.
- Why Tonight and Phased Introduction are independently closed until every
  claim-bearing branch uses exact corpus-bound copy. That binding predicate
  currently returns `false`.
- Runtime sequence, cadence, ramp, procedure, recovery, and tolerance consumers
  obtain the numeric policy and copy fields represented in this corpus version
  only through admitted corpus selectors.
- Stale cadence or recovery state is withheld when authority closes without
  rewriting its stored bytes. Ramp-up and de-escalation notification admission
  is checked before preference reads, scheduling, or logging; notification copy
  itself is still locally owned and is not yet corpus-bound.
- Start Today cannot mutate unless both cadence and recovery authority exist and
  a real cycle is present. Plan gaps no longer expose unreviewed inferred order,
  and cycle streak milestones are not fabricated without actual cycle progress.
- A real user shelf cannot inherit the synthetic Maya example profile when the
  current profile source is absent or explicitly unavailable.
- Privacy deletion remains available even when guidance admission is closed.

## Primary-Source Snapshot and Decision Rationale

The runtime source registry currently includes the American Academy of
Dermatology's general product-order page only as `candidate_unreviewed`. It is
useful background, but it does not independently substantiate OnSkin's exact
product eligibility, cadence, ramp, recovery, or stop/refer instructions:

- AAD, “Should I apply my skin care products in a certain order?”:
  <https://www.aad.org/public/everyday-care/skin-care-basics/care/apply-skin-care-certain-order>
- AAD, retinoid/retinol consumer guidance:
  <https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol>

The following current policy sources informed the decision to keep guidance
closed rather than infer approval:

- Apple App Review Guidelines, last-updated marker observed June 8, 2026:
  <https://developer.apple.com/app-store/review/guidelines/>
- FDA, _General Wellness: Policy for Low Risk Devices_ (January 2026):
  <https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices>
- FTC, _Health Products Compliance Guidance_:
  <https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance>

Apple guideline 1.4.1 subjects medical apps that could diagnose or treat
patients to greater scrutiny and requires clear disclosure of data and
methodology used for health-accuracy claims. Apple also reminds users to check
with a doctor before making medical decisions. Guideline 2.5.18 restricts
behavioral advertising based on sensitive health/medical data, while section
5.1 imposes privacy, consent, minimization, retention, and use constraints.

The FDA document is a boundary policy, not an OnSkin classification. Regulatory
counsel must decide whether each exact feature and claim remains general
wellness, becomes device functionality, or must be removed. The FTC source
requires competent substantiation matched to the exact health claim and
audience; a general educational source cannot be stretched into product-specific
efficacy or safety assurance.

Therefore the candidate sources remain unreviewed, stop/refer thresholds remain
unavailable, and no “conservative” number is treated as safe to publish merely
because it is numerically low.

## Verification Contract

The independent contract
`scripts/core03/routine-guidance-source-contract.test.mjs` is a blocking command
in both `phase3:verify` and `launch:verify`. It rejects:

- non-hash-bound or non-zero-admission corpus state;
- free-text or structural publication bypasses;
- malformed or unsafe cadence arithmetic;
- Boolean/numeric production cadence fallbacks;
- mutations that can reach persistence, cache, or analytics before admission;
- missing retained source artifacts or claim-specific source mappings;
- recovery, explainability, ramp, cycle, streak, and notification paths that
  could bypass their independently required authority;
- synthetic-profile use for a real shelf; and
- removal of the CORE-03 contract from either parent verification gate.

Focused unit tests cover exact-corpus refusal, runtime-brand refusal,
development-only fixtures, invalid cadence domains, mutation ordering, and real
profile admission. They also cover source-artifact and claim-mapping validation,
stale recovery isolation, route admission, ramp gating, notification admission,
plan mutation/gap gating, and non-fabricated cycle milestones. From the current
working-tree rerun, the independent source contract passes 14 of 14 checks, the
15 focused Vitest files pass 252 of 252 tests, mobile TypeScript and ESLint pass,
the launch contract and execution baseline validate and pass their smoke suites,
formatting passes, and `git diff --check` reports no findings.

## Historical Local Human-Simulated E2E

The pre-latest-hardening Expo-web packet is retained at
`test-results/human-e2e/2026-07-26/core03-routine-cadence-review-gate-current/`.
With a development-only Pro entitlement and the production cadence gate forced
closed, all nine direct routes passed at confirmed 375 x 666, 390 x 844, and
430 x 932 CSS-pixel viewports:

- 27 of 27 route/viewport observations remained on neutral gate copy;
- all nine routes remained closed after refresh;
- 11 of 11 visible safe exits returned to `/today`;
- minimum visible control width and height were 48 px;
- horizontal-overflow, clipped-control, forbidden-draft-copy, JavaScript
  dialog, and browser-error counts were zero.

Visual inspection found and fixed two defects: Metro's repo-local `.tmp`
package collision and an unreviewed `moisturizer → SPF` order on the closed
Cycle Week card. The packet includes 27 calibrated screenshots, aggregate
browser diagnostics, a machine-readable summary, the run report, and both bug
reports.

This is historical outer-gate UI evidence. It predates the later recovery,
explainability, ramp-cache, notification, and stale-state hardening and therefore
does not prove those paths against the current exact source. The browser
controller produced 375 x 666 or 376 x 668, not exact 375 x 667, so it does not
claim the exact 375 x 667 observation. It is not registered in
`e2e:human:manifest`, has no immutable source-commit binding or raw trace, and
does not prove native or archive-identical behavior.

## Remaining Acceptance Gates

CORE-03 cannot become `complete` until all of the following have evidence:

- CORE-02's upstream clinical conflict dependency is complete;
- the exact source artifacts reviewed by each professional are immutably
  retained, SHA-256 bound, and mapped proposition-by-proposition to every
  runtime claim;
- the exact sequencing and cadence corpus receives independent professional and
  regulatory decisions with verified credentials and signatures;
- a reviewed Hermes-compatible detached-signature implementation and pinned
  trust roots are present;
- stop/refer behavior is exactly reviewed, admitted, and evaluated by
  independently reviewed executable thresholds, or the affected features
  remain unavailable;
- every Why Tonight and Phased Introduction claim-bearing branch uses exact
  admitted corpus copy, or those routes remain unavailable;
- every local claim-bearing UI and notification string is inventoried and
  exactly corpus-bound, independently reviewed, and admitted, or its surface
  remains unavailable;
- exact 375 x 667, empty, error, stale, offline, relaunch,
  compact/text-pressure, native simulator, and physical-iPhone flows pass;
- legal/privacy review clears the exact U.S. wave-1 copy and data use;
- an archive-identical production build proves the same corpus hash and closed
  behavior; and
- App Store review accepts the submitted binary and metadata.

No engineering control can guarantee App Store acceptance, legal compliance,
clinical correctness, market success, or seven-figure revenue. It can make the
current product truth explicit, prevent unreviewed guidance from shipping, and
preserve auditable prerequisites for qualified reviewers.
