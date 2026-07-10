# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-10
- Codex task: prevent encrypted Progress read failures from rendering false empty or missing-photo states
- App surface: Expo web development build
- Build/start commands:
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE=unavailable EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=false npm --workspace apps/mobile run web -- --port 8162 --clear`
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_PROGRESS_PHOTOS=populated EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE=unavailable_once EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=false npm --workspace apps/mobile run web -- --port 8163 --clear`
- Browser/device/simulator/OS: Google Chrome 150.0.7871.101, bundled Playwright 1.61.1, Windows; 360 x 640 and 390 x 844
- Feature tested: shared encrypted Progress storage recovery gate
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: available and used
- iOS Simulator: unavailable on this Windows run
- Android emulator: not used; native secure-storage fault behavior remains Tas QA
- Expo web: used
- Playwright: bundled runtime 1.61.1 used against system Chrome
- Codex Computer Use: not needed

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Persistent read failure | Progress tab at 360 x 640 and 390 x 844 | Pass | `progress-tab-*.png/json` | False first-photo/populated states hidden; floating tabs remain available |
| Persistent read failure | Direct capture at both supported sizes | Pass | `capture-*.png/json` | Consent, camera, and reference content did not mount |
| Persistent read failure | Direct review with captured URI at both sizes | Pass | `review-*.png/json` | Captured review and Save stayed hidden |
| Persistent read failure | Populated detail at both sizes | Pass | `detail-*.png/json` | Date, note, missing-photo copy, and actions stayed hidden |
| Persistent retry | Retry while failure remains | Pass | All route snapshots and `persistent-results.json` | Stable alert appears; 56 px retry remains available |
| Direct-route escape | Detail recovery to Progress | Pass | `detail-exit-recovery-modern-390x844.png`, `persistent-exit-recovery.json` | 50 px Back to Progress opens tab recovery with floating navigation |
| One-shot retry | Direct captured-photo review | Pass | `retry-before-*`, `retry-after-*` | Successful reread removes recovery and reveals the correct review route |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `progress-encrypted-storage-false-empty-state` | Critical | Make encrypted photo metadata unreadable, then open any data-bearing Progress route | Block content and offer non-destructive retry | Consumers discarded query failure and rendered empty, missing, or incomplete route content | `docs/e2e-bug-reports/2026-07-10-progress-encrypted-storage-false-empty-state.md` |

## Tests Added Or Updated

- `src/features/photos/progressRoutes.test.ts`: every data-bearing Progress route nests the shared storage gate inside biometric unlock; retry and accessibility contracts are pinned.
- `src/features/photos/store.test.ts`: existing regression coverage proves private-store and photo-note key failures propagate without replacing metadata.
- The deterministic development fixture supports persistent and one-shot failures without changing production behavior.

## Commands Run

```text
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test -- src/features/photos/progressRoutes.test.ts src/features/photos/store.test.ts src/features/photos/encryptedStorage.test.ts src/features/photos/claimsafety.test.ts
node run-persistent.mjs
node run-retry.mjs
```

## Remaining Risk

- Expo web proves route gating, user-visible recovery, geometry, state transition, and request absence, not native secure-storage behavior.
- Tas must force real SecureStore/Keychain/Keystore read failures after encrypted records exist and prove ciphertext remains byte-identical until key access returns.
- VoiceOver and TalkBack announcement/focus behavior requires supported physical devices.
