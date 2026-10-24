# M1-02 / RETAINED-RESILIENCE-01

**SUBMITTED_REVIEW_REQUIRED. Independent Brain review required; no self-acceptance.**

Authorization: `M102-RETAINED-RESILIENCE01-CLIENT-SOURCE-01`.
Base/main: `d9912f4c8b30358593569c5b9b4e84773c6f463e`, tree
`389c2a09b62e78a225a2b41c8a1965a1b0e1ab80`.
Independent branch: `stage/m1-retained-resilience`.

Measured implementation: `8284218a0c0c261a7eca841029ff3090af3e7c3b`, tree
`3d0575e6a94031b1b698c79dce95c434962d7b46`.
Three separate source commits repair weekly adherence, committed photo-save
reporting, and malformed native permission admission. Exactly eight source/test
paths changed. See [source commits](source-commits.json),
[scope and pre/post hashes](source-scope.json), and [protected objects](protected-objects.json).

The later checkpoint/handoff commit is evidence only. Its actual pushed SHA,
tree, draft PR and final CI observation are returned externally after creation;
this checkpoint does not claim a future self-hash or future CI result.

- [Results and reproduced failures](RESULTS.md)
- [Commands, exits and evidence classes](TEST_MATRIX.md)
- [Changed-source attribution](SOURCE_SCOPE.md)
- [Open limitations and protected gates](BLOCKERS.md)
- [Machine report](completion-report.json)
- [Environment](environment.json)
- [Raw command receipts](receipts/)
- [Actual synthetic browser evidence](ui/)

Forced repository tests passed: 6,078 (6,054 mobile + 24 console).
Forced root typecheck and lint passed with zero cached tasks. Before-repair
regressions failed nine cases; the repaired focused run passed 105 tests, and
the encrypted photo integration suite passed 32. Earlier setup/fixture failures
remain recorded and are explained in TEST_MATRIX.

Actual Expo web daily flows passed at 375×667, 390×844 and 430×932; the real
synthetic cross-owner flow also passed at 390×844. Paid positive/native cases
remain explicitly NOT_RUN; screenshots and traces do not grant those admissions.

Original Security, DB, clinical, native configuration, dependencies, accepted
history, main and PR10 are unchanged by this candidate. M1-03 remains
BLOCKED_EXTERNAL_CUSTODY / NOT_ACCEPTED; M2-01 remains NOT_AUTHORIZED.
No merge, release, source GO, provider interaction or incremental spending.
