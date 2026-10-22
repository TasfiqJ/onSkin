# M1-01 / CONT-02 — independent REVIEW-03

**Decision: FIX_REQUIRED.** The previously reproduced sign-out recovery and maintained-harness defects are resolved at `fdf040cf28a4b3576f98b60d3b8d96a54bf689b0`. The task is not accepted because its required actual A-to-B account-switch browser proof is still missing. This is an evidence gap, not a newly alleged data leak. Main promotion is **NOT AUTHORIZED**. The next issued work is the same M1-01, CONT-03, after HIGH-context rotation.

## Identity, ancestry and custody
Reviewed delivery `fdf040cf28a4b3576f98b60d3b8d96a54bf689b0`, tree `2be9159a7eca917a7e0cbbc083c4c1ec6f3fa0ea`; prior reviewed delivery `6b137a4f57ed9ad11cef0c91b49ca0bfaf71427a`. Original accepted M1 base remains `6aa01995f6dcb94fd28d358badc9f8d1e0273d39`. Main remains `bbc28dc3d1f945191a81be56945b8bda7bb6ef73`, M0 stage remains at its accepted commit, PR9 is open/draft/unmerged. GitHub's PR test merge `22d4a84b459a0eda576975b4138e7561530c167b` has parents main and this delivery and exactly the same tree `2be9159a7eca917a7e0cbbc083c4c1ec6f3fa0ea`; this is a CI checkout, not a merge into main.

All 15 continuation commit path sets and substantive ordinary diffs were inspected, with relevant surrounding authority code. The continuation changes 2,675 paths, of which 26 are ordinary code/tooling/flow documentation/attributes; most of the remainder is checkpoint evidence. Cumulative stage versus main has 3,917 changed paths. Brain verified **2,619 declared report artifact hashes against exact HEAD Git blobs**, all 29 CONT-02 manifest-listed input files and the manifest anchor, and byte-equivalent review copies. No mismatch. This integrity check is not a claim to have semantically inspected every screenshot or every line of all artifacts.

Old M0/original-M1/CONT-01 checkpoints/inputs and prior review records are unchanged. Protected workflow/database/package/lock/phase2/phase9/custody paths are unchanged in each continuation commit and in net diff. The unchanged worklist generator has SHA256 `b3882f954498008cd80fe57d50f75c358504bca99f5f97b7481239977af26d1e`; all 14 item meanings and all 414 Git-source fingerprints were checked. Main was not written. The audited worktree was clean before and after tests. No install, vendor spend, live-data mutation or branch write was performed by Brain.

## Independent exact-delivery executions
Windows x64, Python3.9.13, Node22.21.0/npm11.20.0, existing dependency junctions unchanged. Commands/exits/actual source identities/raw-log hashes appear in REVIEW_OBSERVATIONS.json.

- Forced root suite: **6,013 passed** = 5,989 mobile + 24 console; zero failed/skipped/cache hits. These are one root run, not added to overlapping focused counts.
- Forced typecheck and lint: exit0, zero cache hits. Mobile lint is ESLint; console lint runs TypeScript; the types lint task explicitly has no independent lint configured.
- Governance: **44 passed, 2 genuine Windows symlink-privilege skips, 0 failed** (46 total). No Linux rerun claimed in this review.
- Native-age/Metro/harness contracts: **14 passed**; these are source contracts, not native invocation.
- Current M1 report CLI and unchanged strict derived worklist check: exit0.

The separately submitted 332 focused tests and 21 selected browser scenarios are Codex-reported at measured `bb9d84be5fba8bbcb8a05343b66152a7ae8cded6` (tree `8c38e82f86b595eae9ac64c5409a75763c8f1c37`); they are not additional independent executions. Brain independently replayed these **six actual Expo web/Chrome scenarios at final delivery**:

| Scenario | Viewport | Result |
| --- | --- | --- |
| Account A sign-out: first/repeated cleanup failure, usable retry, success, protected-route/reload closure | 390x844 | PASS |
| Same sign-out recovery | 375x667 | PASS |
| Same sign-out recovery | 430x932 | PASS |
| Retained encrypted startup/manual Shelf/offline/age-closed rights and interrupted withdrawal/reload/retry | 390x844 | PASS |
| Same-owner guest upgrade, invalid-code retry and retained Shelf | 390x844 | PASS |
| Pending deletion fixture -> simulated completion -> manual acknowledgement -> reload | 390x844 | PASS |

The recovery, signed-out welcome and cold-relaunch screenshots from the independent390 run were visually inspected: usable Try again with no Expo overlay, followed by public entry/age closure and no old account content. Browser fixtures use synthetic local data/transport and unconfigured hosted services. These are not authenticated live A/B accounts or server deletion proofs. Loaded-app offline verification and Metro-enabled document reload are not native offline cold-start/process-death evidence.

## Code disposition and resolved findings
**M1-SIGNOUT-02 closed for this head.** Compact and normal You sign-out handlers and SessionBoundaryGate retry own their rejected event promises. Auth still rejects incomplete cleanup with EXPLICIT_SIGN_OUT_LOCAL_BOUNDARY_INCOMPLETE. Concurrent sign-outs join the same in-flight promise rather than invalidating each other's sequence. Durable cleanup markers and exact publication assertions remain. Source regressions cover repeated failures, duplicate calls, delayed owner callbacks and remount recovery.

Once the overlay was fixed, actual cleanup hit the existing private-write boundary when revoking widget bearer capabilities. The new deletion-only privateKV function accepts no caller key, removes only the two widget action-capability entries, shares their serialized write/rollback queue, attempts both removals, and preserves a failure for retry. It does not open ordinary reads/writes or erase Shelf/photo/billing records. The reviewed tests exercise real storage admission, older write/rollback ordering and removal failure/retry. The successful browser recovery exercises the composed path.

**M1-HARNESS-02 closed for this head.** The maintained portable runner now follows current age/privacy routes, asserts usable controls and stable completion flags, and fails unhandled runtime errors independently of normally allowed environment warnings. It no longer relies on the hardcoded evidence-folder copy for the current scenario. Earlier failed artifacts remain unchanged.

The local age-closed rights fallback now reuses the existing unconfigured local-device owner only after durable exact-owner proof. Configured signed-out and foreign retained owners stay denied; no health subtree or fresh-consent admission is created. Interrupted local withdrawal now succeeds in the independent replay after reload/retry. The deletion fixture's monotonic sessionStorage phase and stronger DEV/web/development/unconfigured resolver are explicitly synthetic, not substituted production receipts. Original native/provider operations and policy gates remain unvalidated.

The continuation overlay/report changes remain small, tied to the externally issued digest, and preserve prior anchors/refusal tests. No new governance redesign is warranted.

## Remaining blocking client row
**M1-OWNER-BROWSER-03 / M1-MATRIX-01 remain open.** Mounted source A-to-B tests pass within the root suite, but the browser cases perform A-to-sign-out and a same-owner guest upgrade. They do not execute A-to-B publication and delayed old-owner settlement in the actual app. Codex's closeout CSV explicitly reports this NOT_RUN. No fabricated substitute is accepted.

CONT-03 must prioritize that complete cross-owner scenario, including usable B after legitimate admission, failed cleanup/retry, old-owner data/callback/cache refusal, rights/privacy closure and controlled relaunch. A tightly gated local synthetic transport may drive existing client authority; it must not directly set a health lease, write an age/consent proof, pre-clear storage, or replace the core account boundary with a test mock. Existing reviewed owner-data policy, not a new migration policy, determines retention/cleanup. Do not add a consumer account-switch feature just to test it. No outside authentication or spending is needed merely to execute a local fixture.

## Current provider CI and external gates
Final-head Quality **39470402671** completed **successfully** during this review (provider updated2026-10-20T18:45:08Z). Repository source gates, PostgreSQL15/17 rehearsals, both Expo exports and canonical database job **118793354045** all passed. Its unchanged full reset/test/lint/drift step passed; the failure-only type diagnostic upload was skipped. Earlier observations in this review saw it pending; this final provider result supersedes them. This is point-in-time recovery, not proof of permanent ECR remediation, a local Brain database replay, or protected hosted/integration authority.

Final-head Security **39470402583** failed. The current raw static job **118792630280** independently shows SOURCE_INVENTORY_DRIFT; braces/node-forge invalid/expired review dates; unreviewed `mcp@1.29.0:GHSA-84m7-p3x7-pcfv`. Continued step badges are not clean underlying exits. Secret/code jobs passed, live Supabase was skipped, dependent source-only acceptance failed. No waiver or applicability/remediation conclusion is granted by this review.

iOS launch contract **39470402549** passed source-only. Proposal expiry remains **2026-10-21T00:00:00Z**. No mechanical renewal. Physical iPhone/Keychain/private files/reminders, real provider identity/deletion/billing, qualified legal/privacy/clinical review, research claims and public release remain separately NOT_RUN/BLOCKED/NOT_ADMITTED. Commercial investment remains NO-GO and incremental vendor budget remains $0.

## Durable handoff
Last accepted checkpoint/runtime admission does not move to this partial M1 head. Accepted tasks remain M0-01/M0-02 with their existing narrow scopes. REVIEW-03 closes exact defects but not M1. CONT-03 stays on `stage/m1-retained-safety`. The predecessor reported HIGH and no compaction; a fresh instance is required. Approved successor state is installed as `docs/brain/reviews/M1-01/REVIEW-03`; old authority/evidence remains immutable. Main promotion remains Brain-only and unissued. Source/spec changes are not release approval.

Raw independent outputs remain at the authorized device paths/hashes in REVIEW_OBSERVATIONS.json; the minimized ZIP contains metadata, not all raw files. Hashes or local paths alone never justify inventing unseen evidence. Report any missing raw file honestly and use source re-execution where needed.
