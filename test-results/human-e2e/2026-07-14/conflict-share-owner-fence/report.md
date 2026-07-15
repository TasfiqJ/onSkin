# Conflict-card owner fence human-simulated E2E

- Date: 2026-07-14
- Surface: Expo web in the in-app Browser
- App URL: `http://127.0.0.1:8260`
- Requested viewport: 390 x 844; browser-reported layout viewport: 390 x 845
- Seed state: clean web origin, then two products added through the manual Shelf UI

## Environment

Expo web was started with:

- `EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED=true`
- `EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED=true`
- `EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED=true`
- `EXPO_PUBLIC_FINAL_BRAND_DOMAIN=https://routinekind.app`
- `EXPO_PUBLIC_E2E_REVIEWED_CONFLICT_SHARING=true`
- `EXPO_PUBLIC_E2E_SHARE_CARD_EXPORT=unavailable`

Supabase remained on the repository's blocked placeholder configuration. No real account, remote data, or native share sheet was used.

## User flow and result

1. Confirmed the manual Shelf entry screen was visible on a clean origin.
2. Entered `Glycolic 7%`, continued, kept `Just opened it`, and pressed `Add to shelf`.
3. Repeated the same real-UI flow for `Retinol 0.3%`.
4. Confirmed the Shelf showed two products and the `2 actives share your PM` conflict with an accessible `Review conflict` control.
5. Opened the reviewed conflict-card route and confirmed `SHARE YOUR SHELF CHECK`, `RoutineKind`, `Retinol 0.3% × Glycolic 7%`, `Share to Stories`, and `Done`.
6. Pressed `Share to Stories`. The forced unavailable fixture produced one inline alert with `Sharing unavailable` and `Sharing isn't available on this device right now.`
7. Confirmed the share button returned to its enabled `Share to Stories` state and that no JavaScript dialog appeared.
8. Pressed `Share to Stories` a second time. The same inline alert appeared, the button recovered again, no JavaScript dialog appeared, and the tab reported zero console-error entries.

Result: **PASS** for the Expo-web-compatible unavailable-share and retry-recovery branch.

## Evidence

- `01-conflict-card-before-share.png` — reviewed conflict card at the phone viewport before sharing.
- `02-first-share-unavailable.png` — inline unavailable state after the first attempt.
- `03-second-share-unavailable.png` — the same inline state after a successful second attempt, with the share control recovered.
- Browser DOM/accessibility inspection confirmed exactly one alert and exactly one enabled `Share to Stories` control after each attempt.
- Browser dialog inspection returned no active dialog after either attempt.
- Browser console inspection returned zero error-level entries after the second attempt.

## Residual coverage

This web pass cannot prove the native view-shot implementation, filesystem staging, OS share-sheet lifetime, app blur/refocus while the sheet is open, or an account/route switch during that native operation. Those owner-fence branches are covered by focused automated tests but still require an iOS Simulator/device run before native UI proof can be claimed.

The existing dev-only `/?e2eReset=local` fixture was not used for the passing run: on a previously populated origin it can delete the private content key after its unauthorized record-removal step fails, leaving correctly fail-closed orphan ciphertext. The pass used a fresh origin so the first Shelf write created a coherent key and ciphertext set.
