# Campaign31 — terminal output fence

Authority: explicit user request on 2026-10-31 to execute the independently
reviewed Campaign31 task and assess outstanding work for main integration.
This grants engineering work, not qualified Security or release acceptance.

Exact parent PR34 HEAD: 74aeb1ffbe0379bfc8b5ceaf38ea401b8d62e2c9.
Parent tree: 53168ac9fd6e2b6a1792465243b949bff6cdc5e2.
Verified live open/draft/unmerged before writes. PR33 remains immutable at
71dde4eed92edd20ff0e9611da42086d6e0f2b89 / f9e5f995d37a7dc058b07271e6b98f79cf698951.
Branch: stage/devtools-terminal31. Stop dependent work on source drift.

Commit this plan before tests. Exactly six tracked paths:
- docs/brain/task-specs/M1X-31/SCOPE_PLAN.md (immutable first commit)
- scripts/security31/patch-devtools-terminal.mjs
- scripts/security31/devtools-terminal.test.mjs
- scripts/postinstall.mjs (append mandatory patch/check; retain all existing hooks)
- docs/security/security31/devtools-terminal.md
- PROGRESS.md (short engineering observation)

Add `if (finished) return` before conversion/append in both real executor data
handlers. Preserve draining listeners, pre-terminal records, explicit terminal
messages, timeout, argument validation, confinement and all prior backports.
No Zod/schema/resource-budget change. Authenticate CLI57.0.32 from the unchanged
lock/archive. Executor preimage SHA256:
f4ee6307896aee35bcac074f7305bfd56fa593c7501ad547f3b5169af1f31236.
Require exact source identity, idempotence, check mode and unknown-byte refusal.

Independently reproduce the red invariant before normal installation applies the
repair. Test late stdout AND stderr after error/timeout/close and repeated terminal
events; require stable returned records/callback count after the fence. Preserve
ordinary text/image/audio, malformed text, stderr levels and argument refusals.
Exercise real bounded synthetic Node children for timeout/kill/close ordering;
await every owned child. Do not mislabel synthetic error injection as OS behavior.
Test patch idempotence/check mode/unknown-source and source-identity refusals.

At most 32 fresh probe invocations per available platform, including repetitions;
count nested synthetic children explicitly. Every probe child uses 128 MiB heap,
512 KiB stack, <=5-second deadline, <=64 KiB input/captured output and <=512
members. Controller must kill and await owned children on failure. Use clean
allowlisted environments and normal lockfile installation with all hooks. No
scanners/providers/production/sockets/third-party plugin execution or exhaustion.
Linux only if already available; otherwise concrete NOT_RUN. No OS repair.

Return exact before/after evidence, hashes, counts and limitations. Preserve
Campaign30 tests and historical checks at their authentic pinned source. Do not
rebind historical inventory/event contracts for this successor. User requested
main integration, but no failed check may be represented as passing and no
qualified owner approval, policy exception or release permission may be invented.
Do not bulk-merge evidence branches into the app. No force push or gate bypass.

G97 FAIL/NO_GO; DB06/DB08/R2B NOT_ACCEPTED; M1-03
BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED. Preserve F09/product
exclusions and native/iPhone/VoiceOver/J01/clinical/legal/licensing/provider/paid/
Apple/public-release closures. USD0. No private Security evidence access.
