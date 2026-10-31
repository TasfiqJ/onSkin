# Campaign32 — main integration Quality governance recovery

Authority: explicit user Campaign32 task, 2026-10-31. Engineering verification
only; no qualified acceptance, main push, merge, force push, deployment or release.

Exact integrated base HEAD 53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6;
tree 7c99d545af73a1caaf174f09c9c1a2f2daa1764d. Independently verified live before
writes. Branch stage/m1-main-quality-governance32 starts exactly here. Stop on
base drift. Commit this immutable scope plan first, before tests.

Finite writable paths (all others read-only):
- .github/workflows/quality.yml
- scripts/release/full-app-j01/main_integration32.py
- scripts/release/full-app-j01/main_integration32.test.py
- scripts/release/full-app-j01/source_consumer32.test.py
- scripts/release/full-app-j01/check.py (append-only only if essential; prefer unchanged)
- docs/brain/task-specs/M1X-32/SCOPE_PLAN.md
- docs/brain/task-specs/M1X-32/TASK.md
- docs/phase-4/generated/source-worklist.json
- docs/phase-4/generated/source-worklist.md
- PROGRESS.md

Investigate a separately pinned, independently cloned PR33/Release29 replay at
71dde4eed92edd20ff0e9611da42086d6e0f2b89, tree
f9e5f995d37a7dc058b07271e6b98f79cf698951, with unchanged checker/negative controls
and normal installation/hooks. Execute with no claimed historical CI event.
Record the unchanged checker's actual current-context refusal separately.

Add a standalone current integration successor: pin the entire PR33 -> three
Campaign30 commits -> two Campaign31 commits and exact integrated base tree;
reject history substitution, unexpected source paths/modes, dirty bytes/index,
wrong CI event/base/branch/head/test-merge, stale live heads and fabricated
acceptance. Use existing authenticated Git/reader primitives where appropriate.
Preserve the whole original check.py and all inherited negative tests byte-for-byte.

Freeze one implementation commit after this plan, with TASK.md recording exact
source hashes and closed admission fields; then one worklist-only seal commit
using the unchanged generator. No source changes after that seal. Final endpoint
identities and results are reported externally to avoid self-reference. This is
source-integrity verification, not a signature or substitute for Brain review.

Quality must retain all later checks, database jobs and their real failures.
Change only its repository checkout/runtime and first governance block as needed
to run the new verification and authentic historical replay. No continue-on-error,
skip marker, approval pin, exception renewal or historical context fabrication.
Normal hosted CI on one new draft PR against exact main is authorized, including
unchanged automatic workflows. No manual scanner/provider/production actions.

Test positive source integration separately from negative synthetic controls.
Cover wrong CI events/heads/parents, ungranted mutations, substituted source
history, changed frozen code/worklists and approval claims. Run actual local
historical replay/current source verification and record commands/exits. Inventory
only PR10 non-evidence deltas; preserve PR10 open/unmerged and do not cherry-pick.
Stop with PARTIAL_BLOCKED if proof needs broader writable scope.

Original Security FAILED; G97 FAIL/NO_GO; DB06/DB08/R2B NOT_ACCEPTED; M1-03
BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED. Native iPhone/VoiceOver,
J01, clinical/legal/licensing/provider/paid/Apple/public release remain closed.
No protected evidence access or modification. USD0.
