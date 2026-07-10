# E2E Bug Report: Private envelope corruption could bypass or strand recovery

Severity: Critical
Surface: Mixed
Environment: Expo web development build at 360 x 640 and 390 x 844; source-level native storage boundary
Feature: Encrypted private storage and app lock
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Store a truncated or wrong-shaped XChaCha20-Poly1305 envelope under an app-owned private key and cold-open `/shelf`.
2. Separately store an unsupported value under `onskin.appLock.enabled` and cold-open `/shelf`.
3. Retry or authenticate through the surfaced recovery.

## Expected Result

Malformed ciphertext remains byte-identical and blocks app content. A malformed app-lock preference stays locked but exposes an explicit, device-authenticated reset for that preference only.

## Actual Result

Before the fix, malformed private envelopes could be treated as legacy plaintext and later overwritten. Malformed app-lock values were rewritten to disabled. The first fail-closed patch then exposed a retry-only lockout because the private-data gate would encounter the same irreparable app-lock envelope after authentication.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/`
- Video: Not captured
- Trace: Not captured
- Logs: `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/browser-browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/results.json`
- Terminal transcript: Focused Vitest and E2E command output in the active Codex task

## Frequency

- Always

## Scope

- Affected route/screen: Any route behind `PrivateDataAvailabilityGate`; app-wide lock overlay
- Affected account or fixture: Device with malformed app-owned private or app-lock storage
- External service involved: None
- Destructive action involved: Potential ciphertext overwrite or automatic app-lock preference removal

## Suspected Cause

Private-KV parsing used one null result for legacy and malformed envelopes, while app-lock normalization treated every unknown value as disabled. The initial repair also lacked an authenticated setting-level escape for permanently malformed app-lock bytes.

## Minimal Fix Recommendation

Classify envelopes by structure and storage authority, preserve failed snapshots, reject stale/concurrent writes, fail malformed app-lock state closed, and permit deletion of only that preference after an explicit successful device authentication.

## Verification Flow After Fix

1. Inject a real truncated private envelope at both supported browser sizes; verify pre-mount blocking and byte-identical repeated retry.
2. Remove the fixture and retry; verify the requested Shelf route and tabs mount.
3. Inject a malformed app-lock preference; verify the named reset action, no pre-reset Shelf content, and successful authenticated recovery that removes only the preference.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/`
- Video: Not captured
- Trace: Not captured
- Logs: `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/browser-browser-logs.json`
- UI snapshot: `test-results/human-e2e/2026-07-10/private-envelope-corruption-current/summary.json`
- Terminal transcript: E2E reports `Private envelope corruption E2E passed 3/3.`

## Remaining Risk

- Untested branches: Real native SecureStore, Keychain, Keystore, LocalAuthentication cancellation/failure, and screen-reader focus
- Missing fixtures: Physical-device malformed-envelope fault injector
- Follow-up needed: Execute the named Tas-owned iOS/Android matrix in `docs/FOR_TAS_TO_DO.md`
