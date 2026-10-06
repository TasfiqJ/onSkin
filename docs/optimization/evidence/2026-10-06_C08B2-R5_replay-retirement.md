# C-08B2-R5: exact-owner retirement of captured photo-delete replay

Review candidate on baseline `00c75c07daa08692f88f9f2b4fa416bacd02ad12`. This adds one replay-authority boundary to R4; it is not independent approval, a new deletion architecture, or hosted/native acceptance.

## Reproduction and cause

The exact independent-review file (SHA-256 `e269ce65abb9e1099fa18757fd635dac6ff26c61a8bc906d76676133cb14211b`) reproduced both reported failures on the verified R4 payload. After two accepted offline deletes, the first RPC was already sent and its response held. Actual photo-purpose cleanup erased the journal and owner vault without replacing base health. R4 still sent the captured second operation afterward, both while capture consent stayed closed and after capture consent alone was re-granted. The persisted vault remained absent; the defect was use of the detached in-memory batch, not persisted resurrection.

## Retirement linearization point

`erasePhotoDeleteRemoteCleanupForBinding()` validates the exact canonical owner key, then synchronously advances that owner's process-only retirement generation and marks native erasure pending **before** enqueuing or awaiting the existing native removal. This is the replay-retirement linearization point. Every batch captured under an earlier generation is permanently stale, including after a later grant or erasure retry.

The generation map contains only pseudonymous owner bindings, counters, and a pending bit; it contains no photo IDs, operation IDs, health epochs, tokens, or photo content. It is module-local process state, not new persisted consent or a replacement global account/health lease. Process restart cannot retain a copied JavaScript batch. The existing durable journal/vault/purpose-withdrawal protocols still own recovery after restart.

Native erase failure remains an error through the existing R4 cleanup path. It does not restore an old batch's authority. Fresh replay in that process is also refused while exact-owner native erasure remains pending. The existing explicit purpose-cleanup retry is needed to clear that pending state; an ordinary retry of network replay cannot pretend purpose cleanup succeeded. Successful erasure permits a new invocation to capture the new generation, not to adopt an old copied array.

## Dispatch and settlement checks

`retryPhotoDeletes()` captures the exact-owner replay generation before reading/copying obligations. The capture stamps the start of asynchronous owner-binding resolution, so cleanup during that lookup cannot lend the invocation a successor generation. Retirement of B does not invalidate A.

A replay guard wraps the existing exact account/health operation lease; it does not replace it. Existing photo-queue, read, promotion and acknowledgement operations now perform both checks. Before each RPC, the replay also reads the still-live committed obligation and matches both operation and photo IDs. After that read and all preparation, a synchronous generation/lease assertion occurs immediately before invocation. A current consent boolean or a copied array alone never authorizes dispatch.

Already-dispatched requests receive an advisory AbortSignal on exact-owner retirement; the listener is removed after settlement. This is not a claim to retract a request already received by the server. Tests deliberately let a sent request settle after retirement, ignoring advisory abort, and prove that no later operation is sent and that no old acknowledgement/error changes successor state.

Late applied, duplicate, permanent, error-response and thrown network results are fenced before acknowledgement and again inside its queued work. Purpose retirement is treated as supersession, not remote success or a new owner's error. A genuinely changed account/base-health lease still follows its existing fail-closed error contract. New same-owner work can start independently of a retired flight still awaiting the network. Slow network waits remain outside local photo/vault cleanup serialization.

## Preservation

R4's exact-owner clearPhotos cleanup, purpose-level server authority, generated-RPC narrowing and compiler drift contract are unchanged. Ordinary sign-out still preserves only the minimal encrypted per-owner obligation and requires legitimate same-owner reauthentication/current health to resume. Different owners cannot read or execute one another's namespace. Full-health and terminal-account erasure continue through the same exact-owner leaf.

R1 health classification; the complete R2 <700 empty layout; R3 missing-file/quarantine handling, route-removal and decoded-memory settlement, privacy-only retry, accessibility, notes/reference and local offline mutations; and C-08A/C-08B1 remain unchanged. No schema, encryption format, dependency, backend, token retention, or UI composition is changed.

## Tests and evidence boundaries

`photoDeleteReplayRetirement.c08b2.test.ts` retains the two reviewer scenarios and their real R4 lifecycle harness. It adds controlled native await barriers for retirement before first dispatch/during owner resolution and a later membership read, five late-response classes, fresh accepted obligations, a newer flight completing while the retired one remains blocked, erase failure/explicit retry, different-owner retirement, liveness removal, uninterrupted multi-operation replay, sign-out resumption, and listener release. The copied original 16 lifecycle cases are not represented as newly invented coverage; the original R4 suite is preserved and run separately too.

Only native/service ports are controlled. Photo store, encryption, private KV, per-owner vault, account/health/consent lifecycles and cleanup are real candidate implementations. No production credentials or real user photo data are used. The packet preserves the byte-identical supplied reviewer proof, raw red/green logs, complete current validation, source/manifest hashes, protected-source checks, installer tests and short-phone browser evidence. No implementation commit, PR, push or main integration is authorized by this candidate.
