# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-10
- Codex task: prevent shared encrypted local state from rendering as empty/default when its content key cannot be read
- App surface: Expo web development build
- Build/start commands:
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=true EXPO_PUBLIC_E2E_APP_LOCK_AUTH=success EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE=unavailable npm --workspace apps/mobile run web -- --port 8164 --clear`
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=false EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE=unavailable_once npm --workspace apps/mobile run web -- --port 8165 --clear`
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=false EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE=foreground_once npm --workspace apps/mobile run web -- --port 8166`
  - `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=true EXPO_PUBLIC_E2E_APP_LOCK_AUTH=not_authenticated EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE=unavailable npm --workspace apps/mobile run web -- --port 8167 --clear`
- Browser/device/simulator/OS: Chrome 150.0.7871.101, bundled Playwright 1.61.1, Windows; 360 x 640 and 390 x 844
- Feature tested: global shared private-KV readability gate, app-lock ordering, retry, foreground recheck, and exact-route recovery
- Source Git SHA: `4ca67a8e9f4ff30043fa44ea77a3eb631fd71d14`
- Overall verdict: Pass

## Tool Inventory

- Expo CLI: available and used
- iOS Simulator: unavailable on Windows
- Android emulator: not used; real Keystore fault behavior remains Tas QA
- Expo web: used
- Playwright: bundled runtime 1.61.1 used against system Chrome
- Playwright trace: not configured; scripts captured screenshots, UI/storage snapshots, console, page-error, dialog, and network logs
- Codex Computer Use: not needed

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Persistent key failure | `/today`, `/shelf`, `/routine/plan`, `/settings/privacy`, `/progress` at 360 x 640 and 390 x 844 | Pass 10/10 | `*-supported-floor-360x640.*`, `*-modern-390x844.*`, `persistent-results.json` | App lock completed first; route actions, tabs, and default/sensitive copy never mounted |
| Persistent retry | Key remains unavailable | Pass | Persistent route snapshots | Retry stayed 56 px, stable feedback appeared, ciphertext/key hashes remained identical |
| One-shot recovery | Cold direct `/shelf` entry | Pass | `retry-before-*`, `retry-after-*`, `retry-result.json` | Real shared-envelope decrypt audit succeeded and requested route mounted |
| Foreground recheck | Readable Shelf becomes unavailable after background/active | Pass after fix | `foreground-*.png`, `foreground-result.json` | Gate hid route/tabs, retry restored exact `/shelf`, no onboarding flash remained |
| App-lock ordering | Authentication rejected while private storage is unavailable | Pass | `app-lock-blocked-modern-390x844.png`, `app-lock-result.json` | Lock remained authoritative; private recovery and route content stayed absent |
| Privacy/network | Every scenario | Pass | `*-browser-*.json`, `*-network-requests.json`, `*-vendor-requests.json` | No dialog, page error, unexpected error log, Supabase/PostHog/Sentry request, or ciphertext UI leak |

## Bugs Found

| ID | Severity | Reproduction | Expected | Actual | Evidence |
| -- | -------- | ------------ | -------- | ------ | -------- |
| `private-data-foreground-route-reset` | High | Foreground failure on `/shelf`, restore key, tap retry | Restore `/shelf` | Root navigator remounted at onboarding index | `docs/e2e-bug-reports/2026-07-10-private-data-foreground-route-reset.md` |

## Tests Added Or Updated

- `privateKV.test.ts`: read-only audit verifies every shared envelope, ignores legacy/plaintext and separately keyed envelopes, and preserves ciphertext/key material on SecureStore failure.
- `privateDataAvailabilityGate.test.ts`: provider order, app-unlock sequencing, foreground audit, route restoration, hidden restoring state, retry geometry, and development-only fixtures.
- `run-persistent.mjs`, `run-retry.mjs`, `run-foreground.mjs`, and `run-app-lock.mjs`: repeatable user-facing browser drivers with valid encrypted seed preservation.

## Commands Run

```text
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test -- --run src/lib/storage/privateDataAvailabilityGate.test.ts src/lib/storage/privateKV.test.ts
node run-persistent.mjs
node run-retry.mjs
node run-foreground.mjs
node run-app-lock.mjs
```

The browser scripts used the Codex bundled Playwright runtime through `NODE_PATH`; no project dependency was installed.

## Remaining Risk

- Expo web proves provider ordering, route blocking/restoration, responsive layout, request absence, and deterministic ciphertext/key preservation. It does not prove native SecureStore, iOS Keychain, or Android Keystore fault behavior.
- Tas must run the shared-key fault matrix on supported physical iOS and Android builds and retain native secure-storage logs, hashes, recordings, device/build IDs, and named signoff.
- VoiceOver and TalkBack announcement, focus restoration, and exact deep-link/query restoration remain native device QA.
