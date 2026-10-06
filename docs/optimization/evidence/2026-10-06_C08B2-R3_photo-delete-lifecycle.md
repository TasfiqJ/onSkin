# C-08B2-R3 photo-delete lifecycle contract

This is the R3 implementation candidate, subject to independent approval. It extends the retained metadata-only `apply_photo_delete_outbox_batch` contract; it does not enable photo upload, alter photo ciphertext, restore historical trend architecture, or claim native/hosted release acceptance.

## Authority and storage boundaries

`layerwell.photos.deleteJournal.v1` remains ordinary encrypted health-purpose data, registered in both `LOCAL_PRIVATE_DATA_KEYS` and `HEALTH_PURPOSE_PRIVATE_DATA_KEYS`. It owns prepared/committed local metadata and exact encrypted-file recovery. Explicit sign-out, account cleanup, and full health withdrawal erase it and ordinary photos. R1's health classification is unchanged.

A separate minimal remote obligation is reserved **before** an authenticated local deletion can remove metadata:

- Namespace: `layerwell.photoDeleteCleanup.v1.<ownerBinding>`, where the suffix is exactly the existing 64-lowercase-hex `localDataOwnerBinding`.
- Encryption: the existing `LargeSecureStore` authenticated protocol, with a separate `WHEN_UNLOCKED_THIS_DEVICE_ONLY` SecureStore content key for each namespace. Ordinary photo/private-KV key destruction does not orphan this ciphertext.
- Fields: owner binding, operation UUID, photo UUID, reserved/committed phase, and an attention bit. No owner user ID, session/bearer/refresh token, note, date/time, health epoch, original/thumbnail path, image bytes, or arbitrary payload is retained.
- Bounds: at most 128 unresolved operations and 65,536 serialized characters per owner. Capacity failure occurs before local quarantine/metadata removal. There is no silent expiry or abandonment policy.
- This record is **not a bearer capability**. It cannot authorize network deletion by itself. Replay requires the same owner to possess a fresh legitimate account/health lease and current server authentication; the existing RPC derives its server subject from Auth. No old credential is saved or replayed.

The prefix is a secure-control namespace, not an exception preserving the health journal. A different owner computes a different namespace and never reads, decrypts, displays, or executes the prior owner's entries. Read/dispatch APIs assert the exact current lease before and after awaits. The queue does not retain plaintext results in its global serialization promise.

Generic private KV treats only the exact prefix plus canonical 64-hex owner suffix as a separately owned encryption protocol. It neither attempts to decrypt that ciphertext with an unrelated private-KV key nor silently exempts arbitrary similarly named keys. The specialized reader remains strict and fail-closed. This also prevents a pending obligation from making startup unavailable after sign-out.

## Local deletion and missing files

The protected photo metadata write remains the local deletion commit point. The full prepared journal still precedes file moves. Quarantine checks actual file existence under the original caller authority; successful absence of both live and quarantined copies is already-cleaned, not an error requiring nonexistent bytes to be restored. A move that committed before its acknowledgement failed is recognized only by successful source/destination reads. Filesystem errors or non-boolean existence results are never evidence of absence.

If a prepared journal still has a metadata row, recovery restores every surviving quarantined rendition, tolerates proven absent renditions, cancels the uncommitted remote reservation, and clears the prepared journal. If metadata is absent, recovery never restores the deleted photo and preserves/promotes the remote obligation. Uncertain reads keep recovery pending; a later successful read can resolve it. Encrypted-file cleanup failure after commit retains exact paths in the health journal.

## Sign-out and restart

The actual explicit-sign-out path still revokes publication/authentication and executes `prepareLocalDataForSession(previousOwner, null)` and its account/private/media drains. No AuthProvider policy is changed. That cleanup erases ordinary Progress data and its health journal but leaves only the independently encrypted minimal namespace.

A reservation interrupted before local deletion is reconciled against an authoritative photo-store read. A remaining row means no local delete committed: cancel the reservation without dispatch. An absent row, including after explicit sign-out erased local photos, permits the original user-requested metadata cleanup when the same owner later reauthenticates. This closes the reserve/metadata crash window without preserving photos merely to retain a tombstone.

Applied/duplicate RPC dispositions acknowledge the exact operation UUID. Response loss, offline errors, and failed acknowledgement writes retain the stable UUID for idempotent retry. Permanent dispositions remain explicit attention states. Network waits do not hold the local photo mutation queue. Reserved/unresolved local intent is reported as pending local recovery, not false deletion success. The visible promise explicitly requires connectivity **and sign-in to the same account**.

Existing R2 pending journals still present under current authority are promoted by the normal authorized recovery path. This code cannot reconstruct obligations already lost by older best-effort deletion/sign-out. The feature is device-local; app uninstall, loss of the device, or inability to reauthenticate is not represented as guaranteed autonomous server cleanup. Full account/health server cleanup remains independent.

## Full health withdrawal and account deletion

Full health withdrawal's existing server operation independently deletes the owner's photo metadata and owned photo storage. The mobile withdrawal path proves the local owner, opens its existing destructive boundaries, and drains active work before erasing that owner's minimal namespace, its health journal, media, and caches. Raw namespace erasure does not decrypt anything and can remove an obligation even if its independent content key was lost. It does not touch another owner's namespace. Failure remains `HEALTH_PURPOSE_LOCAL_CLEAR_FAILED`; no fresh grant is authorized by a false cleanup success.

Terminal account deletion similarly retires only the server-proven owner binding, **after** existing local sign-out/drains and **before** discarding the completed-deletion recovery proof. Erasure failure preserves retryable terminal proof. These erasure-only APIs return no capability or data, take no new health lease, and are called only by the full-health and terminal-account paths.

## Detail route privacy settlement

Once a destructive attempt starts, captured visible exits consult a synchronous guard, and ordinary Back, replacement, and navigator removal use the same `usePreventRemove` boundary. The store mutation begins only after that guard is installed. An attempted exit is queued once, not executed through the critical phase.

Both a confirmed delete and an uncertain mutation result require successful decoded-memory purge before ordinary exit can be released. False/failed purge remains in a single visible, accessible retry surface. That surface sits inside the existing Pro/lock/owner boundary but outside photo source readiness, because a memory-only retry must remain usable when storage is unavailable. It renders no photos or notes. Retry purges memory without issuing the local deletion again.

After successful memory settlement, navigation is released once; durable encrypted-file cleanup and remote replay may continue independently. Forced health/account/lock teardown purges immediately and disposes the old session. An old continuation cannot navigate, publish content, or obtain a later owner lease. Existing C-08A sensitive-image generation/lock defenses and C-08B1 capture authority remain unchanged.

## Accessibility and short-screen layout

Attention and unavailable deletion recovery each have one polite live alert; retry uses a stable accessible label with busy/disabled state. There is no additional competing progress indicator. Detail-owned memory recovery does not duplicate the aggregate status alert.

R2's `compactEmptyFirstRun = height < 700` and its empty-only use remain unchanged. Populated Compare/Timeline keep their prior compact threshold and padding. The browser matrix reruns the actual Expo app at 360 x 640, 375 x 667, and 390 x 844, including real visible age/consent bootstrap, source gates, center taps, clipping/overflow measurements, and the actual floating dock. Browser-only native filesystem/SecureStore ports and deliberate status-read failures are controlled test seams, not native-device or hosted-RPC evidence.

## Verification locations

The real native-file/private-KV/vault/account-isolation regressions are in `photoDeleteR3.integration.test.ts`; the entire rendered detail suite uses the real React Navigation core removal protocol. Accessibility is asserted in `photoDeleteLifecycle.c08b2.test.ts`, and `photoDeleteRemoteCleanupContracts.test.ts` constrains lifecycle consumers and registry ownership. Existing note, reference, store/outbox, health withdrawal, account isolation, C-08A and C-08B1 tests remain part of required validation. The deterministic delivery packet contains red-before/green-after and fresh full-suite logs, source-preservation hashes, browser screenshots/measurements, and guarded-installer tests.
