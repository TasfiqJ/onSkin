# Private-Vault Verify-Only Decrypt Checkpoint

Date: 2026-07-21 (America/Toronto)

Branch: `optimization`

Checkpoint parent SHA: `e862354f5c4e31de7588be4141e02c4d590afce3`

Scope: decision-independent plaintext-retention reduction in the existing exhaustive private-KV startup gate, supporting PERF-P0-005 and PERF-P0-009.

## Outcome

`assertPrivateKVReadable()` no longer calls the ordinary batch reader that constructs a complete `Map<string, string | null>` of decrypted private records. It now uses a dedicated generation-bound verification path that:

- validates every requested key and takes the same complete `AsyncStorage.multiGet` snapshot;
- classifies the complete snapshot before reading key material, preserving malformed/future-envelope error precedence;
- reads the existing private-KV content key exactly once and never creates one;
- authenticates each current envelope separately without converting the decrypted bytes into JavaScript strings and discards the result immediately;
- returns `void`, performs zero storage writes, and preserves every ciphertext byte;
- retains exact failed-read fencing for malformed, future, key-unavailable, key-missing, and authentication-failed records; and
- rechecks account generation after native storage/key awaits so delayed owner-A work cannot record failed-read state for owner B.

The ordinary `getPrivateItems()` contract is unchanged and still returns its complete result map to explicit callers.

## Deterministic Stress And Failure Matrix

The focused private-KV suite adds:

- 49 current envelopes carrying a 32 KiB plaintext fixture, proving a void audit result, one SecureStore read, zero AsyncStorage writes, and byte-identical ciphertext after verification;
- an explicit follow-up batch read proving normal callers still receive exact plaintext values;
- a later-record authentication failure proving zero writes, full ciphertext preservation, and exact replacement fencing; and
- a delayed content-key failure across an A-to-B account boundary proving immediate public invalidation, no mutation-drain pin, no stale failed-read snapshot, and successful owner-B replacement.

Existing cases retain coverage for legacy and absent values, malformed and unsupported envelopes, foreign storage authorities, missing/unavailable/invalid content keys, complete failed-read protection, and never-resolving full-audit enumeration.

## Verification

- Focused private-KV and gate matrix: **PASS**, 2 files / 68 tests.
- Complete private-storage matrix: **PASS**, 8 files / 153 tests.
- Repository TypeScript: **PASS**, 2 workspaces.
- Repository zero-warning lint: **PASS**, 2 workspaces, after running outside the filesystem sandbox required by the Windows resolver.
- Repository tests in the preserved dirty worktree: **2 files failed / 348 passed; 4 tests failed / 4,161 passed**. The failures are the same unrelated user-owned notification/Shelf changes recorded by the preceding checkpoint; the private-KV suite passes all 66 tests.
- Prettier and `git diff --check`: **PASS** for the implementation files.

No UI copy, route behavior, authorization order, or visible recovery state changed, so a new human-simulated UI run is not required for this internal storage-memory slice. Existing startup recovery UI evidence remains applicable.

## Evidence Boundary

This is deterministic source and unit evidence that the JavaScript verifier holds no complete plaintext result collection. It is not a signed-device peak-heap measurement and does not replace the exhaustive scan with an encrypted manifest or transactional database. Physical protected-storage interruption, SecureStore latency, cold/warm/resume distributions, low-memory behavior, and native heap traces remain required before release verification. OPT-DEC-004 still governs any startup shield/remount or gate-order change; none was made here.
