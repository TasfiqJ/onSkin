# Hung Private-Read Isolation Checkpoint

Date: 2026-07-14 (America/Toronto)
Branch: `optimization`
Implementation SHA: `955717c44fc12dde2235ac76bd203966bc4d5f60`
Evidence class: `command` and `decision`

This checkpoint removes a cross-cutting account-isolation liveness defect: pure private-KV and encrypted-photo reads no longer share the mutation sets drained before owner cleanup. A native read that never resolves can now be invalidated without allowing late owner-A data to publish. Operations that may create keys, write bytes, move/delete files, or leave an ambiguous commit remain strictly drained. This is local deterministic proof, not a claim of native cancellation or physical-device verification.

## Implemented Contract

- `getPrivateItem`, `readPrivateItem`, `getPrivateItems`, and full-vault `getAllKeys` audit work register as active reads, not in-flight mutations. The outer private-KV boundary invalidates their public wrappers synchronously.
- Every private read asserts its captured generation immediately after non-cancellable AsyncStorage/SecureStore awaits and before returning data or setting/clearing `failedReadSnapshots`. Typed reads normalize invalidation to `{ status: 'unavailable', reason: 'account_boundary' }`.
- Late native private-read resolution or rejection retains a handler, cannot settle the already-invalidated public result, and cannot weaken owner-B failed-read rewrite protection.
- Pure `decryptPhotoToDataUri` and `decryptPhotoNote` reads bind both the app-wide account generation and the photo-storage boundary. They assert after FileSystem/SecureStore reads and before decrypting or returning plaintext; pass-through and null reads are boundary-blocked too.
- Photo capture, content-key/marker creation, note encryption, plaintext share staging, recovery/quarantine/finalization, and direct share/source/encrypted-file deletion remain mutation-owned. `waitForEncryptedPhotoWritesToSettle()` waits for those mutations but no longer waits for pure decrypt reads.
- `clearEncryptedPhotoStorage()` remains the explicit authoritative cleanup that runs after boundaries are held and both drains finish. It is not misclassified as an ordinary operation.
- Additional generation assertions after captured-photo reads and plaintext-staging reservation stop stale-account base64 stripping/encryption/decryption work before it begins.
- Nested boundaries keep all new reads and mutations blocked until the outermost release. A same-user refresh does not begin the boundary and therefore does not cancel valid work.

## Commands And Results

| Command or action | Result |
| --- | --- |
| Seven-file private/photo/store/share/auth isolation Vitest matrix | Pass, 7 files / 199 tests |
| `npm test` | Pass, 249 files / 3,173 tests |
| `npm --workspace @onskin/mobile run typecheck` | Pass |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm --workspace @onskin/mobile run lint` | Pass, zero warnings |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| Scoped `git diff --check` | Pass |

Independent adversarial review found no P0/P1 in the stabilized implementation. It identified two P2 plaintext-minimization windows after capture-file reading and share-staging reservation; both assertions were added before the final focused/full verification above.

## Verification Boundary And Follow-Up

The tests use never-resolving and late-resolving/rejecting AsyncStorage, SecureStore, and FileSystem promises. They prove wrapper invalidation, mutation-drain liveness, rejection handling, snapshot fencing, nested boundaries, share staging, direct deletion, and store/share integration in the deterministic test runtime. They do not cancel the underlying native call; they only prevent stale publication and detach it from the write drain.

No UI code changed in this checkpoint, and no new human-simulated surface run is claimed. Before physical session-boundary behavior is called verified, use a supported signed target to delay/fault protected-storage and encrypted-file reads during an account-A to account-B transition, confirm that the gate advances after mutation drains, and confirm that no owner-A plaintext or cache state appears. Deliberately hung or ambiguous writes must continue to hold the fail-closed gate.

Remaining local work includes the broader account-scoped read/write inventory (starting with app-index/onboarding, routine order, Trend, and recommendation inputs), executable delayed A-to-B Shelf coverage, and the plan's transactional-outbox work.
