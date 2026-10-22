# M1-02 — independent review 01

**Decision: FIX_REQUIRED.** Reviewed delivery `8c1149116df00f34314357d10929b32f52f6d118`, tree `58ad583815b55736f1e907e02d9c46853f0d1a11`, on `stage/m1-retained-safety`. The last accepted runtime remains M1-01 `31307694ebb9895ed8cfb77fa6ac532b789d2810`. M1-02 is not accepted. Main promotion, PR9 merge, protected Security/source acceptance, replay and release are not authorized.

## Exact custody and scope

Main remains `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` and M0 remains `6aa01995f6dcb94fd28d358badc9f8d1e0273d39`. PR9 is open/draft/unmerged. GitHub's PR checkout `444e3d7cec085637cebe442b4cad7c216a249c93` has the delivery tree and main+delivery parents; it is a CI merge ref, not a merge to main. Codex measured `0377c190b92625eb76bdb43ebcfd0c21c9a96c3e` / `2f2617e6718c48213e483790d0272fdc978194c3`. The 165-path delivery tail contains only checkpoint evidence and root handoff, not unmeasured runtime/config/test/authority changes.

Brain inspected the 20-commit M1-02 chain, all 544-path change inventory (5,553 cumulative versus main), the 30 ordinary changed source/config/test paths and relevant surrounding implementations. This is not a claim to have manually read every historical artifact. All 491 declared report artifacts were hashed against committed Git blobs. The independently issued manifest matched; all 30 listed inputs and 14 manifest-listed Brain review files matched. Prior task/research authority stayed immutable; no protected source changes were found in the commit checks. A transient PROGRESS.md change was restored, not erased from history. All14 derived worklist meanings and414 fingerprints were unchanged/correct, using the unchanged generator.

## Useful implementation retained

The checkpoint adds routine-order compare-and-swap conflict handling, offline query/mutation execution, serialized notification preference saves, permission/lease rechecks around native scheduling, stale-response routing closure, visible save/retry notices, and earlier ownership of uncertain photo destination moves. New tests cover related races. Preserve these improvements; this review is not a request to restart or rewrite the subsystem.

## Independent checks at delivery

| Check | Result and limits |
|---|---|
| Fresh forced root suite | 6,048 passes:6,024 mobile+24 console, no failures/skips or cached test tasks |
| Forced typecheck/lint | Exit0, no cached tasks. Types has no independent lint; console lint is TS, mobile ESLint |
| Governance | 49 passes+2 genuine Windows symlink privilege skips,51total |
| M1-02 real report CLI and strict worklist | Exit0; consistency is not acceptance |
| Selected source-contract suite | 148 passes,1 inherited failure,149total; not an overall pass |
| Unmodified actual daily browser | Four failures:390,375,430 and cross-owner+daily390 |
| Additional controlled-port probes | Two targeted failures exposing reminder unavailable/retry gaps |
| Modified-harness diagnostic | One failure later in AM re-entry; not an acceptance pass |

Windows/Node22.21.0/npm11.20.0/Python3.9.13 and existing dependencies were used. No Linux, real OS notification/device, native camera/Keychain, physical process-death, live paid/provider or qualified review is claimed. Standalone focused counts reported by Codex were not independently rerun as a separate set; root coverage overlaps them.

## M102-R1-F1 — scheduling unavailable resolves as success

`features/notifications/deliver.ts` handles unavailable `configureNotifications()` by throwing only for its lifecycle parameter; the ordinary preference path returns undefined. With the real rescheduler and controlled existing ports, the new probe expected a truthful unavailable result but observed a fulfilled promise. Therefore successful saving of preferences can be confused with completed scheduling. The repair may use typed outcomes rather than exceptions, but must carry the difference through save coordinator, hook and visible status/retry. Deliberate all-off/no-op and unsupported-web behavior must remain truthful, not automatically become an error or OS delivery claim.

## M102-R1-F2 — Retry cannot recover bootstrap unavailability

`features/notifications/startup.ts` retains `configuration ??= configureNotificationRuntime()`. When the first native category configuration temporarily fails and the port then recovers, the second call still returns unavailable without invoking it again. Independent observation: `retry=unavailable, initialCalls=4, finalCalls=4`. This source is inherited unchanged, but retry is in the issued M1-02 scope. Preserve single-flight behavior and ready reuse; make failed/unavailable attempts safely retryable without duplicated scheduling, reset preferences or unauthorized opt-in. Prove bootstrap-to-save-to-retry behavior, not only a mock of reschedule.

## M102-R1-F3 — four actual browser daily replays do not reproduce reported pass

The unmodified maintained runner failed in every attempted case at `retained-daily-loop.mjs` waiting for “Check-offs aren't available right now.” The actual URL was `/today?routine=AM`, but captured content was Good evening / Evening routine. Thus an AM URL/capture filename was mistaken for an AM rendered-state proof. No storage-error branch was reached, and downstream browser acceptance cannot be claimed from these runs. The broader source tests still passed.

A separate, explicitly modified temporary harness changed only the first AM entry to reload and require Morning routine. It advanced past the initial refusal/retry/check-off steps, but failed later at “reloaded saved AM progress”; the second AM URL again displayed PM content. This is a diagnostic, not a workaround admitted as a full pass. `useRoutineClock` and the Today source are unchanged from the accepted M1-01 base. The causal layer is a phase/clock/route-binding problem in the verification path; no production data loss or fabricated Codex execution is established. Correct the phase/date binding and validate actual supported navigation behavior before deciding whether production code needs a change. Do not simply increase waits or assert the URL.

## Undo — explicit Brain decision, not a silent pass

The actual retained completion implementation is append-only and the repeated check does not remove an event. A local destructive toggle would disagree with durable outbox/server history. **ADR-038** preserves this invariant and explicitly moves additive correction contracts/adapters to existing M2-01 and correction UX to existing M2-02. Required correction remains open before M2-03/M2-04 readiness. M1-02 must now make its once-recorded behavior truthful in UI/accessibility and mark undo UNAVAILABLE_RETAINED_APPEND_ONLY, never PASS. No later-task implementation or SQL change is authorized by this decision. This is a scope reconciliation of the original task's check-off/undo request, not evidence that undo works.

## Inherited source debt and current CI

The source-contract failure expects “exact 94-migration source history” in CORE05 at line630. The contract and protected targets are unchanged from M1-01. Do not modify counts or fixtures to get green; M1-03 retains exact-custody reconciliation.

Quality39496961034 is completed/failure: repository, PG15/17 rehearsals and both exports passed; canonical DB118884388306 failed ECR Data limit exceeded in prepareCanonicalPostgresImage before SQL. Security39496961082 completed/failure; raw logs reject source inventory, review dates and Vite/certifi/mcp advisories. iOS39496960969 is source-only success. The proposal date2026-10-21T00:00:00Z is unchanged. No automatic renewal, replay, scanner reinterpretation or main promotion. CI_OBSERVATIONS.md retains precise IDs and refusal terms.

## State hygiene and next action

The prior successor's aggregate acceptance-ledger axes still carried older M1-01 CONT-02 values despite its correct final acceptance task entry. This successor archives those stale aggregate values and replaces only current axes from already documented exact evidence. Historical immutable reports are not changed; no external gate is upgraded.

Issue only **M1-02 / CONT-01** from this delivery, same stage, fresh Codex due reported HIGH context plus one compaction. Own the complete reminder unavailable/retry transaction, deterministic daily-loop proof and truthful append-only interaction; retain photo/order/owner protections. Finish remaining ready local matrix work, with paid/native/provider limits explicitly separate. No owner action is needed for the ready local work.

Evidence provenance: exact source and CI were independently inspected; command executions, four browser failures and two probes were independently reproduced; ADR decisions are new Brain authority; native/provider behavior and permanent ECR resolution remain unknown. See REVIEW_OBSERVATIONS.md and the companion task packet’s REPRODUCERS.md. Raw local evidence remains on the authorized workstation in the paths/hashes recorded there; this text-only package does not pretend those raw artifacts are embedded.
