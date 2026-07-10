# E2E Bug Report: Unreadable local encryption keys could erase recoverable data

Severity: Critical
Surface: Mixed
Environment: Native storage source audit with deterministic Vitest adapters
Feature: Encrypted private records and Progress photo/note storage
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Persist an authenticated private-record or Progress-note envelope.
2. Make the corresponding SecureStore key temporarily unavailable, missing, malformed, or valid but incorrect.
3. Read the record and let the feature store follow its prior empty/default recovery path.

## Expected Result

Ciphertext and key material remain unchanged, the operation fails closed, and a retry can recover after the original key becomes readable.

## Actual Result

Before the fix, private-KV reads deleted unreadable envelopes, Progress decryption could create or rotate key material during a read, and the Progress store could convert a key failure into an empty list/null note and persist that fallback over the original metadata.

## Evidence

- Screenshot: Not applicable; this was a storage-layer source-audit finding.
- Video: Not applicable.
- Trace: Not applicable.
- Logs: Focused Vitest transcript from 2026-07-10.
- UI snapshot: Not applicable; no visual contract changed.
- Terminal transcript: 8 focused files / 70 tests passed after the fix.

## Frequency

- Always under the deterministic missing/invalid/wrong-key fixtures; transient SecureStore availability depends on the OS state.

## Scope

- Affected route/screen: Any local-first store; highest direct risk was Progress metadata and notes.
- Affected account or fixture: Native installs with encrypted local data.
- External service involved: OS Keychain/Keystore through Expo SecureStore.
- Destructive action involved: Prior automatic ciphertext deletion or fallback overwrite.

## Suspected Cause

Low-level reads treated every key/decryption failure as corrupt data, while feature stores treated read errors as an authoritative empty state. Key creation also lacked a shared in-flight operation and prior-key marker.

## Minimal Fix Recommendation

Separate web/native key storage, preserve ciphertext on all key/authentication failures, block same-snapshot writes after failed reads, make Progress decryption key-read-only, persist prior-key metadata, and serialize first-key creation.

## Verification Flow After Fix

1. Exercise native/web, legacy migration, missing, malformed, wrong-key, unavailable-storage, and concurrent-first-write fixtures.
2. Confirm ciphertext/key snapshots are unchanged after every rejected read/write.
3. Restore the original key, read successfully, then verify an intentional write succeeds.

## Post-Fix Evidence

- Screenshot: Not applicable.
- Video: Not applicable.
- Trace: Not applicable.
- Logs: Mobile typecheck and lint passed; focused storage/Progress/cleanup/export tests passed 70/70.
- UI snapshot: Not applicable.
- Terminal transcript: Full launch verification will be recorded in the source/evidence commits.

## Remaining Risk

- Untested branches: Real iOS Keychain and Android Keystore update/reinstall/restore/locked-device behavior.
- Missing fixtures: Physical-device SecureStore fault injection and genuine OS key-loss recovery evidence.
- Follow-up needed: Tas must complete the staging-only device matrix in `docs/FOR_TAS_TO_DO.md`; V1 intentionally has no cloud key recovery.
