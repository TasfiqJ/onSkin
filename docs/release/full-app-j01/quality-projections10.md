# Release10 quality projections candidate

Authority: `BRAIN-RELEASE10-QUALITY-PROJECTIONS-CONSUMERS-CANDIDATE-01`.
Status: **PARTIAL_BLOCKED / SUBMITTED_REVIEW_REQUIRED**. Independent Brain review
alone decides source acceptance and any later ordinary main promotion. Spend USD0.

The immutable start is Release09 delivery
`8ac97c32901272d97d1bff05f2abc294811055a6`, tree
`a59fc7ea1cc57901f6d848ff5009734f446bdff2`. The new branch is
`stage/full-app-j01-quality-projections10`, stacked on PR13's unchanged branch.

## Phase4 repair and sequencing

The original `npm run phase4:source-worklist:check` reproduces exit1 for both
projections at the clean exact base. The unchanged producer indexes 420 source
occurrences across 250 unique files. It reports 14 work items: seven blocked and
seven local-scaffold; sourceReview has three items, curation four, betaEvidence
one, productSurface four and operations two. Missing sources, structural blockers
and warnings are zero. These counts do not approve source rights or clinical use.

The stale bound input is `.github/workflows/quality.yml`: SHA256 changed from
`c78ed1c9559407dd31634da1f3afaf00e887f976ff54f78c926acff7478a16c8` to
`51a295770e798707507048bc56cf10765b308b18ed9ce9922c05bf699b660c49` in Release09.
The worklist output pair is absent from its own input inventory. Its original
freshness comparison ignores only its existing timestamp/Git-SHA/strict policy;
source hashes, status, warnings, work items and evidence requirements stay checked.

Freeze implementation first, then invoke the official strict writer on a clean
source. Commit only its two generated outputs in a separate projection commit.
The checkpoint records both source and projection identities. No hand-patched hash
or substituted producer is permitted. `quality_projection10.test.py` runs the real
canonical check and byte-authenticated bounded source fixtures, rejecting malicious
JSON/Markdown output and a clean committed workflow-input mutation before restoring
authentic bytes. These fixtures are not an independent complete-checkout test.

## Readiness investigation: BLOCKED_OUTSIDE_SCOPE

The unchanged strict check reproduces exit1, including the separate drift message.
A read-only Node Inspector breakpoint at the final check observed:

- `verifyReadinessStatusSnapshot(sourceSnapshot)`: pass, errors empty.
- `inventoryStabilityErrors()`: empty.
- `governedEvidenceChainStabilityErrors()`: governed evidence-chain binding unavailable.
- Source Git status clean, all captured working inputs matched their pinned blobs.
- Committed July projection has no `sourceSnapshot.headSha` or governed chain.
- Only `_template` exists under `docs/phase-9/release-candidates`.

This is an expected provenance refusal, not a demonstrated deterministic bug.
The conditional readiness-source edit grant is not activated. The original scripts,
33 negative tests and output pair remain byte-identical. The official writer cannot
supply missing real S/E/ledger custody from a generic source checkout. A current
source hash alone does not establish its required direct E, exact generated tail
through R, and final readiness-only F commit. Evidence-only checkpoint commits and
GitHub synthetic PR merge commits are not substitutes for that chain.

Separate blockers include CAT07 manifest status blocked/fail, 480 actual mobile test
files versus reviewed constants 337/4204, old 301/3529 documentation baselines, stale
dates and missing required command/evidence references. Repair needs separately
authorized `LAUNCH_READINESS.md`, `BLOCKERS.md`, `docs/TESTING_STRATEGY.md`,
`docs/e2e/generated/human-e2e-manifest.json/.md`, real non-template RC evidence and
the protected publication DAG. Readiness, CAT07 and release-provenance owners must
review authentic evidence. No fabricated counts, dates, owners or signoffs.

## Versioned source-scope extension

The Release08-to-Release09 segment now ends at the immutable Release09 delivery;
its exact original delta parser, workflow byte checks and semantic validator
functions are preserved. Release10 separately checks every cumulative intermediate
commit, index, worktree and untracked path from that fixed endpoint. Only the finite
new grant is allowed, with regular 100644 blobs, correct create/edit classification,
linear ancestry, normal index flags and no protected edits/deletions/renames. The
unproven conditional readiness-script grant is deliberately excluded.

The initial source-head CI exposed an overly strict rejection of GitHub's synthetic
PR merge checkout. The corrected orchestration accepts only PR14's immutable
workflow/event context, exact PR13 base, exact new-branch head, and a synthetic
merge tree identical to that source head. It still validates every real source
commit and rejects ordinary merges, altered integration trees, wrong events and
wrong base/head identities. This does not create a source merge or readiness
provenance, and the failed initial CI remains recorded in the checkpoint.

`source_consumer10.test.py` uses actual Git deltas and histories based on the exact
Release09 tree through private read-only object alternates. It tests rejected
protected paths, old evidence, modes, deletions, collisions, ancestry, merges and
hidden malicious intermediate commits. The original Release09 guard still rejects
new Release10 paths; it is not broadened. Original 151 semantic negatives and the
unchanged 23 Release09 controls remain required. No 65/38/47/51, G97/DB/J01 or
admission validation semantics change.

## Unapplied consumer migration

`legacy-consumer-cutover10.unapplied.json` is a concrete source map of 52 direct
references and 133 direct/transitive files, 208 relative-import edges and three CI
workflow consumers, plus package-command dependency closures and actual test paths.
It includes all 250 unique worklist inputs and a versioned owner/gate DAG. This is
an UNAPPLIED plan, not an issued broad migration.

The candidate Release09 governance CI step is already wired in Quality. The legacy
runtime/launch contract still enforces Lean V1. Release08's immutable `ci_wired=false`
describes its historical observation and is not rewritten. Future migration needs
new exact-path owner authorization, a successor contract, each mapped consumer's
tests, CI integration and authentic source/evidence publication in that order.

First public iPhone scope remains F01–F17/F19–F20, all 12 consumer and six professional
groups, plus only J01 Visible Pores. F09 local history/manual comparison is required;
F18 automated Trend and J02–J27, including J05, defer. J01 intake remains missing;
G1/G2/G3/G5 and qualified review gate single-scan use, G4 additionally gates change.
No count, size, score, improvement, diagnosis, percentage or accuracy claim is admitted.

G97 remains FAIL/NO_GO; canonical DB remains H01_SQL_PROBE_FAILED; M1-03 remains
BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED and M2 remains NOT_AUTHORIZED. No stub counts
as a completed provider, clinical, catalog, community, payment, professional, signed
native or Apple release feature. No public release GO or release date.

Exact measured source/evidence commits, protected frontier, raw commands, failures,
negative controls and final-head CI observations belong in the separate Release10
checkpoint. Limited host disk keeps fresh independent full-checkout 0/1/0
NOT_QUALIFIED until genuinely performed. No old checkpoint or guard is overwritten.
