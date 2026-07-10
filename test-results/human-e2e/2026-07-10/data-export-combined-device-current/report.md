# Combined Account And Device Export Human E2E

- Date: 2026-07-10
- Surface: Expo web development build
- Viewports: 360 x 640 supported floor and 390 x 844 modern phone
- Fixture: Pro entitlement, app lock disabled, Supabase intentionally unavailable
- Result: PASS

## Flows Executed

At both supported phone sizes, the complete `YOUR DATA` card was brought into the app ScrollView and inspected before interaction. It visibly names the account plus current-device scope, including profile, shelf, routine settings, completion history, preferences, and Progress notes. It separately states that photo files and thumbnails remain encrypted and directs individual image sharing from Progress. Export and Delete controls are 56 px tall, all copy wraps within the card, and horizontal overflow is zero.

Tapping `Export my data` exercised the backend-free path. No `data-export` request was emitted. Expo web does not provide the native cache/share lifecycle required to hand off the JSON, so the route rendered raw-error-free `Export failed` recovery with `role="alert"`. The disclosure remained present, no JavaScript/native dialog opened, no completion/review analytics request fired, no page error or unexpected warning/error appeared, and horizontal overflow remained zero.

The artifact contract is covered by focused tests rather than claimed from the web surface: all `LOCAL_PRIVATE_DATA_KEYS` are represented exactly once; representative profile, shelf, completion, sanitized Progress metadata, and decrypted note records are included; local paths, ciphertext, key IDs, credentials, image bytes, and thumbnails are absent; configured server failure aborts before file creation; backend-free native-capable builds mark the server scope `backend_not_configured`; and temporary files are deleted across share availability/rejection branches.

## Evidence

- Screenshots: `combined-export-floor-360x640-{before,after}.png` and `combined-export-modern-390x844-{before,after}.png`
- Geometry/UI snapshots: `combined-export-floor-360x640.json` and `combined-export-modern-390x844.json`
- Browser logs: `browser-logs.json` and `browser-unexpected-logs.json`
- Network requests: `network-requests.json`
- Dialogs/page errors: `dialogs.json` and `page-errors.json`
- Aggregate result: `summary.json`
- Bug record: `docs/e2e-bug-reports/2026-07-10-account-export-omitted-local-first-data.md`

## Commands

```text
EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=false
EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro
EXPO_PUBLIC_E2E_LOCAL_RESET=1
npm --workspace apps/mobile run web -- --port 8165 --host localhost

Bundled Playwright 1.61.1 + installed Chrome, headless
npm --workspace apps/mobile test -- --run src/features/settings/localDeviceExport.test.ts src/features/settings/actions.test.ts
npm run phase9:data-rights-smoke
```

## Remaining Risk

- Tas must inspect a seeded live staging artifact with deliberately divergent server/local records.
- Native iOS and Android share-sheet success/rejection and physical cache deletion remain external Phase 5/7/9 QA.
- Expo web cannot prove the native JSON file contents or OS share handoff.
