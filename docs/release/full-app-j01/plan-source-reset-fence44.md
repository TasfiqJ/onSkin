# Campaign44 source fence and direct reset synchronization

**PARTIAL_BLOCKED / SHARED_CLEANUP_SCOPE_OWNERSHIP_REQUIRED / NO_GO.**
This local candidate is incomplete and unsafe to publish. No Campaign44 push,
PR, hosted event, worklist generation/seal or release admission exists.

Authority: BRAIN-M1X-PLAN-SOURCE-RESET-FENCE44-SOURCE-CANDIDATE-01.
This is a source-only prerequisite, not V2-C05 routine-plan history or release
approval. All 38 obligations remain incomplete and all 18 owner gates closed.
Security/candidate29 remain FAILED; G97 FAIL/NO_GO; DB06/DB08/R2B NOT_ACCEPTED;
M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED;
R33-LEDGER/CORE PLANNED_NOT_AUTHORIZED. J01, clinical, native-device,
provider/paid/Apple and public release remain NO_GO.

## Decisive remaining safety failures

Three additive real-IO regressions remain red. Synthetic native platform ports
hold Promise delivery; account/health authority, encrypted stores, the direct
helper and the wider `clearAccountIsolatedState` control are actual source.

1. A direct helper starts without a recovery marker and pauses during key
   destruction. A wider account cleanup marks recovery, owns a broader boundary,
   and encounters a staging failure. The direct helper succeeds and clears the
   identical marker, so the failed wider cleanup loses its durable quarantine.
2. Gated dev reset runs its actual control-clear algorithm while a wider
   cleanup's native marker write has committed but its Promise is held BEFORE
   account-boundary begin. Dev reset clears that marker; the wider cleanup then
   begins and fails. Recovery marker is absent both before begin and after the
   failure. Account identity observation cannot detect the earlier held mark.
3. A wider cleanup finishes its helper and pauses in post-cleanup query work.
   Independent direct helper B begins and mistakes that open boundary for its
   own caller's scope. After B's photo purge, its private-key deletion is held.
   The wider scope finishes and releases account/photo exclusion. A genuine
   fresh grant and encrypted photo-note write now succeed; B later returns
   success with a recreated photo content key surviving its purge.

The cleanup-only FIFO does not own the wider marker/staging/query lifecycle.
Retaining an ordinary marker alone does not solve dev clearance or unrelated
boundary lifetime; read-then-remove cannot distinguish identical writes of `1`.
The public account API rejects handoff while closed, and its generic nested
begin advances subject identity. No safe in-grant ownership repair was found
without narrowing away reset/writers or changing protected lifecycle code.
These executions concern an overlapping independent direct helper; they do not
claim a demonstrated failure in the ordinary production cleanup control alone.

The smallest additional custody request identified is shared cleanup-scope and
marker coordination in `apps/mobile/src/lib/auth/localAccountIsolation.ts`,
`apps/mobile/src/lib/auth/sessionOwner.ts` and its `sessionOwner.test.ts`.
The first two source files and the marker tests are expressly read-only in this
campaign. A follow-up must also audit selective/account/photo lifetime callers;
this proposed extension is not a claim that untested schedules already pass.
No read-only file was changed and no failing test was waived.

External original red logs, successor pre-repair failures, these three final
counterexamples, actual full-suite exits and exact source context are retained.
All positive source-fence observations below remain bounded component evidence,
not a completed cleanup prerequisite or accepted campaign.

## Authenticated source and input

Exact base: draft PR44, stage/m1-today-optional-changes41,
HEAD 302e2b83216e7d100e7da3b3f579ee33db8dc5af,
tree 075ee95de6e23282bdaf40890bf7bc5ed8aa7c18.
PR43 remains draft/open/unmerged at e3d7e439cd32ccfbe4e5ac4eebcc8d31b007c84c,
tree e87b8701d48ff7862e651d77f127104ee9b94c6a. Main remains
53a84d921d14dbff1d2e9b8f1b3bb27e10dcede6.
Initial live GitHub API ref/PR/tree/ancestry checks passed, auto-merge and
maintainer edits off. A new full non-shallow HTTPS checkout with no hardlinks
was used; all 23,651 baseline working bodies matched Git blob identities.
Local diagnostic C42/C43 commits were never used as source parents.

Input ZIP SHA256: 289f516926710bb653a0c07db24946528fe828cb7fff9315347126a9ea09fcec.
Manifest: 60eeedc1b9a60154f1bdf46895ed48d15611e3ec72acde9a952015f17124df51.
Verifier: 4895092fff64fa5382bee6146fbb2741e2c836402a4ce63a5175694bb3395ad7.
The 36,752-byte archive passed external hash, EOCD/local/central record,
regular mode, safe name/alias, bounded expansion, CRC and inventory checks
before extraction into a new empty directory outside Git. Exact isolated
verifier: VERIFIED, 14 files, 85,533 expanded bytes, exit0, NO_GO.
Immutable plan-only first child: 5387a7a2b3b0c5d5f7f04191b74bdaf474d40ab8.

## Storage contract

`updatePrivateItemWithSources` is opt-in. It captures classified health leases
before waiting, reserves the sorted distinct union of source keys and one
destination in the existing privateKV queue, authenticates current ciphertext,
and holds every reservation through domain preparation, synchronous transform,
native write, exact authenticated readback and compensation. Non-null legacy
plaintext cannot establish an authenticated source; absent bytes remain exact
absence for domain validation. Async destination transforms are refused.
Read-only asynchronous preparation may call strict domain loaders; it must not
mutate or await a mutation of a reserved key. The implemented adapter only reads.
Default privateKV APIs and purpose-limited export semantics are unchanged.

A completed earlier source mutation is observed before validation and an old
capture refuses before destination dispatch. A source mutation already holding
its key finishes or fails before validation. A source mutation queued behind
the fence runs after the snapshot commits: the snapshot is truthful at its
linearization point, not a claim about future changes. Destination omission,
ambiguous native failure, source/native conflict or changed authority never
produces success. Compensation keeps exact prior ciphertext when possible;
foreign divergence or failed restoration surfaces PRIVATE_KV_WRITE_ROLLBACK_FAILED.
Deletion closes admission and drains that compensation before native erasure.

## Exact factual graph and owner adapter

| Private key | Consumed local facts / dependency |
| --- | --- |
| layerwell.shelf.v1 | Active product identity, name, category, ingredients; full record including formula and mirror metadata is expected state |
| layerwell.skinprofile.v1 | Strict local quiz axes, pregnancy/reproductive status and goals |
| layerwell.conflict.overrides | Strict conflict choices, never a render error fallback |
| layerwell.healthDataCollectionConsent.v1 | Exact current granted local disclosure receipt |
| layerwell.routineOrder.v1 | Current order state and the sole optional destination |

`capturePlanSource44` runs actual strict Shelf/profile/choice/order/consent
loaders while reserved and derives only ephemeral factual AM/PM product IDs and
names through the existing generator/projections. It never falls back to a
server-only profile. Missing profile/Shelf/consent or no active Shelf refuses;
absent conflict/order uses the existing explicit successful empty semantics.
Malformed/future records and I/O failure refuse. Whole-key expectations, source
hash and original owner/account/health generation/epoch/expiry stay in memory.
Proofs are privately branded; a copied snapshot cannot invent authority.

`savePlanOrderWithSource44` is an opt-in adapter for the existing order-v1
record, not a plan-version append or new UI action. It validates order membership,
original authority and all five full-key expected values under the same fence.
Ordinary Shelf/profile/conflict/order writers already use the shared queue.
Clinical generation, Today/Shelf/formula history, notes, sync and entitlements
are unchanged. This bounded factual snapshot excludes current-use/cycle/expiry
display state; a richer future cut requires a new dependency audit.

## Direct reset and deletion

Production account isolation and selective consent cleanup already closed and
drained before purge. Campaign43 demonstrated the separate direct exported
helper/development Welcome reset bypass, not an ordinary production-deletion
exploit. Campaign44 closes the actual helper path; it does not exclude dev mode.

Each cleanup uses real privateKV close/drain/end. A direct cleanup retires old
account/health authority through the existing purpose-limited account handoff
without advancing subject identity, and drains photo operations before destroying
their key. Nested outer cleanup retains its own boundaries. Account operations
are not self-drained by a helper their tracked caller may be awaiting.
Widget privacy prelude, registered keys, independent cleanup aggregation and
owner/quarantine proofs are preserved. Proofs are removed only after successful
cleanup. The gated dev control finalizer runs within exclusion and is not run
after failed private cleanup. Partial cleanup never reports all data gone.

A newly demonstrated local-consent preparation bypass yielded while hashing
before privateKV registration, then recreated consent ciphertext/content key
after direct purge. Its original red log is retained. The permitted consent
store now account-scopes that preparation and passes its original assertion
into privateKV; recording a consent receipt still does not require an active
health-processing grant or alter consent policy.

## Evidence custody and limits

Untouched baseline: normal npm ci/hooks PASS with Node22.21.0/npm11.20.0;
root 6,614 mobile +24 operator =6,638 PASS; typecheck/lint PASS.
Protected original core04/core06: 24 PASS/2 FAIL, exit1, unchanged.
Inherited dependency advisories and uncovered dependency scripts were not fixed
or waived. No package, lock, protected test, DB or clinical gate changed.

Original C42 diagnostic SHA256:
69a9ed953b1c3f071bd1273dbada502def7a26d417dd3a03aad506c593ecd592;
historical 3 PASS/3 FAIL. Original C43 diagnostic SHA256:
b8230053453d27be0e25e42a2e9f8d635cf610b8bfdd4231417aca0d4ca9988a;
historical 2 PASS/1 FAIL. Original files and historical failure claims remain
immutable; successor tests use the new API and corrected scheduling semantics.
External return contains exact source context and actual reproduction outcomes.

New tests exercise real XChaCha20-Poly1305/privateKV, real domain stores and
real account/health authority. Explicit synthetic native ports control Promise
delivery and injected platform failures. They prove one JS runtime's ordering,
not real iOS durability. Initial successor test harness import-order failures
and a test-only generic type error are preserved alongside corrected checks;
they are not rewritten as historical campaign evidence.

TASK records actual pre-seal command exits and log hashes. The external final
return records final HEAD/tree, complete local checks, original historical replay,
genuine hosted pull_request service merge/event and terminal workflow/job outcomes.
Hosted CI is NOT_RUN until an actual post-push event exists; earlier PR runs do
not count. Original current41 must refuse current44. Current44 verifies protected
preimages/raw Git/source scope, no admissions, final worklist seal and live PR
identity; only Quality's first governance block may change.

No physical native multi-process, process death, power loss, real device,
provider/payment, real remote user data, signed build, deployment, merge or
release qualification is claimed. Those axes remain NOT_RUN/NO_GO.

## Terminal diagnostic results

| Actual check | Terminal result |
| --- | --- |
| Untouched full root | 6,638 PASS, exit0 |
| Final full root, forced uncached | 6,703 mobile +24 operator PASS, 3 genuine cleanup failures, exit1 |
| Final typecheck / lint, forced uncached | Each 3/3 tasks PASS, exit0 |
| Final explicit 11-suite storage/privacy/compatibility selection | 225 PASS /3 FAIL, exit1 |
| Broader engineer 11-suite source/reset/compatibility selection | 246 PASS /3 FAIL, exit1; overlapping selection, not additive |
| Cleanup-only successor | 29 PASS /3 FAIL, exit1 |
| Plan-source factual adapter | 33 PASS, exit0 |
| New low-level source-fence tests | 24 PASS, exit0 |
| Protected core04/core06 | 24 PASS /2 FAIL, exit1, original bodies unchanged |
| Health processor inventory / privacy payload source controls | Each PASS, exit0 |
| New governance hostile boundaries | 19 PASS, exit0 |
| New actual-Git source controls | 12 PASS, exit0; source integrity only |
| Original C42 / C43 exact diagnostic reproduction | 3 PASS /3 FAIL and 2 PASS /1 FAIL, each exit1 |

The first current full-root run had one original release-inspection child timeout
(ETIMEDOUT at60 seconds), with 6,701 mobile passes and24 operator passes.
It was preserved. The final unchanged protected test passes; final full-root
failures are exactly the three new honest cleanup counterexamples.

Fresh exact PR44 original41 current-source, scope, external-readiness refusal2,
17 pure/13 source controls, UI19, original drivers103, cleanup23 and inventory5
actually passed. Authentic nested replay reached exact PR43 original40 pure22,
source12, drivers103, cleanup23 and inventory5. Its current40 validation child
was deliberately cancelled after the decisive safety blocker; nested39-to29
and the remaining40 suffix are NOT_RUN. Original41 and outer44 historical
wrappers terminated exit1. This is not a completed historical replay PASS.
An earlier new-driver invocation incorrectly attempted a hosted-only CAT08
behavioral lane locally; its genuine refusal is also retained, and the new
driver was corrected without changing that hosted-only test or hosted gate.

Current44 final seal/worklist producer, push, new PR, GitHub service merge/event,
Campaign44 hosted Quality/iOS/Security/candidate29: NOT_RUN after safety stop.
Existing earlier-PR hosted results, if included in the return, are inherited
metadata only. This candidate is PARTIAL_BLOCKED, not implemented/accepted.
