# Environment

- Repository: `C:\Users\jasim\Desktop\layerwell`
- Branch: `optimization`
- Date/time zone: 2026-07-14, America/Toronto
- Surface: Expo web, Codex in-app browser
- Start command: `npm --workspace apps/mobile run web -- --port 8265`
- Origins: isolated `http://localhost:8265` and `http://127.0.0.1:8265` browser storage for the cross-consumer, recovery, mutation-failure, and delayed-reread proofs
- Viewports: 375 x 667, 390 x 844, and effective 390 x 845 after applying the 390 x 844 in-app browser override
- External services: Supabase intentionally blocked by local placeholder configuration; notification delivery not exercised
- Destructive state: isolated browser-origin local fixtures only

## Development fixture matrix

- `EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE=always`
- `EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE=preferences_once`
- `EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE=dismissed_once`
- `EXPO_PUBLIC_E2E_RECOMMENDATION_READ_FAILURE=future`
- `EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS=3000`
- `EXPO_PUBLIC_E2E_RECOMMENDATION_DISMISS_FAILURE=once`

Each server was stopped before the next fixture was started. The browser viewport override was reset and temporary tabs were finalized after the run.
