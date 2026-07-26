# Photo And Network Operation Timing Adoption

Date: 2026-07-26 (America/Toronto)

Branch: `optimization`

Implementation base: `4e7be8a07f6f48423348d5049f3e3eb5cce0ee41`

Evidence class: production instrumentation adoption, privacy review, and deterministic tests

## Result

The three previously registry-only operation labels now have production owners:

- `photo_encrypt` measures one complete captured-photo encryption and atomic publication;
- `photo_decrypt` measures one complete encrypted-photo-to-display-data decode;
- `network_request` measures one complete logical request-policy operation, including retries and retry delay.

Every public operation emits exactly one bounded, memory-only sample when it settles. Outcomes are limited to `ok`, `error`, or `cancelled`; samples retain no endpoint, URI, photo ID, filename, MIME type, byte size, payload, result, identity, timestamp, attempt detail, or error value. The existing 200-sample global bound remains unchanged.

This closes the local adoption gap for the fixed labels. It does not satisfy PERF-P0-001's signed-device baseline, approved-threshold, raw-trace, named-owner, or independent-signoff requirements.

## Production Boundaries

### Captured-photo encryption

`encryptCapturedPhoto` starts timing only after its existing missing-source validation and settles the sample with the unchanged public promise.

The sample includes:

- photo-boundary admission;
- directory and content-key access;
- source Base64 read;
- metadata stripping;
- XChaCha20-Poly1305 encryption and hex conversion;
- envelope serialization;
- temporary file write and atomic move.

Note encryption, camera capture, metadata-store commit, source cleanup, deletion, and recovery authentication are excluded.

### Display-photo decryption

`decryptPhotoToDataUri` times only owned encrypted `.onskinphoto` inputs. It includes the account-bound read, encrypted file read, envelope validation, content-key read, authenticated decryption, UTF-8 conversion, and data-URI construction.

Plaintext pass-throughs, note encryption/decryption, and `createPhotoShareFile` are excluded. Share preparation also strips metadata, reserves plaintext staging, writes a Base64 file, and advances a staging journal; mixing it into `photo_decrypt` would make the display-decode distribution uninterpretable. A future share-performance gate needs its own separately reviewed fixed label.

### Logical network requests

Both public request-policy entry points time the complete returned promise. A transient failure followed by success records one `network_request / ok`, not one sample per attempt. Owner-scoped, unscoped, and already-leased requests use the same wrapper.

The existing endpoint-specific request metrics remain separate and unchanged.

## Outcome And Privacy Contract

Photo work is `cancelled` only for an account-generation invalidation or the exact photo-account-boundary error. Network work is `cancelled` only for a raw account-generation invalidation or the existing normalized `cancelled`/`owner_changed` request failures. Timeout, offline exhaustion, authentication, validation, rate-limit, server, response-size, filesystem, key, envelope, crypto, and unknown failures remain `error`.

The wrappers await, return, and rethrow the original values and errors without modification. `startOperationTiming` is one-shot, so a detached native completion after the public operation settles cannot append a second sample.

Two independent read-only reviews converged on these hook points and exclusions. They rejected endpoint-derived labels, per-attempt samples, note/photo mixing, and share/display mixing as privacy or measurement-quality regressions.

## Verification

Focused command:

```text
npm.cmd --workspace apps/mobile exec vitest run src/features/photos/encryptedStorage.test.ts src/lib/network/requestPolicy.test.ts src/lib/observability/operationTiming.test.ts src/lib/diagnostics/localDiagnostics.test.ts
```

Result:

```text
Test Files  4 passed (4)
Tests       112 passed (112)
```

The matrix covers:

- captured-photo encrypt success, error, and account-boundary cancellation;
- encrypted display-decode success, malformed-envelope error, and account-boundary cancellation;
- no photo sample for plaintext pass-through, note crypto, or share-file preparation;
- network first-attempt success, retry-then-success, terminal error, caller cancellation, and a pre-existing owner boundary;
- exactly one fixed-label sample per logical operation;
- private sentinel absence from serialized samples;
- the unchanged three-field schema and 200-sample retention cap;
- content-free local diagnostics serialization.

Repository verification:

```text
npm.cmd run typecheck  PASS (2 workspaces)
npm.cmd run lint       PASS (2 workspaces, zero warnings)
npm.cmd test           370 files / 4,539 tests; 4,535 passed
```

The full preserved-dirty-worktree suite has the same four unrelated user-owned failures present before this slice: one notification behavioral-snapshot expectation and three Shelf metadata/provenance expectations. Both changed production domains and all timing/diagnostics tests pass.
