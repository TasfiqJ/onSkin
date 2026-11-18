# Engineering25 actual local browser verification

Final result: **PASS** at 375×667, 390×844 and 430×932 in the installed Edge browser against actual local Expo web source. This is synthetic browser evidence, not native, physical-device, VoiceOver, provider or release qualification.

The external driver is `local-recovery-browser25.mjs`. Every run retains its exact driver copy, raw command receipt/log, Expo log, step history, summary and owned-process IDs. No repository application or test source was modified by the browser agent. The final four production-source hashes were verified unchanged after the run in `BROWSER_VERIFICATION.json`.

## Completed at each viewport

- Start from a fresh synthetic local owner using the existing development fixture and ordinary age/consent/free-onboarding UI. No real app profile or data was opened.
- Open You → Help → Local recovery. All six rows are reachable: Shelf, Today check-offs, Reminder choices, Photo cleanup, Manual intake drafts and Optional change drafts.
- Verify both initially empty draft collections say Not configured; other domain statuses remain independently represented.
- Explicitly save one incomplete manual-intake draft and one optional factual-note draft through their existing UI. Do not resume/discard/confirm those drafts, submit the optional note, or add the incomplete draft as a product. The separate ordinary onboarding cleanser establishes a synthetic completed profile.
- Return to the overview and verify generic Saved on this device statuses for both collections. Original synthetic product/brand/ingredient/note marker strings and internal identifiers/errors are absent from the overview DOM and accessibility labels.
- Activate Check again on all six rows by keyboard. Each control has an accessible name, verified focus and hit point, and a measured 48 px height.
- Introduce a temporary in-memory getItem error for one synthetic draft collection at a time. No persisted record, ciphertext or key is constructed or altered. The affected row shows Unavailable and Nothing was reset; the other draft collection remains Saved on this device. Restore the ordinary read boundary and explicitly retry successfully.
- Capture zero calls to Storage setItem/removeItem/clear while all six explicit inspection retries run, and again through each independent unavailable/recovery check. All nine final zero-write receipts are empty arrays. These web adapter receipts complement the parent’s native-adapter unit invariants; they do not establish installed-native behavior.
- Keyboard-activate Open saved manual intake drafts, verify the existing `/shelf/intake-drafts` inventory and its resume control without activating it, return through Back to Shelf and the You tab, and reopen the active Local recovery section.
- Keyboard-activate Open Today for saved change drafts, open Your optional change notes → Saved change drafts, verify the existing resume control without activating it, then return to You and verify fresh saved statuses.
- Verify no horizontal overflow. Both overview navigation controls also measured 48 px height with keyboard focus/hit checks.
- Capture five generic overview states per viewport, each with six cropped row screenshots: empty, saved, manual unavailable, optional unavailable, returned overview. The final run contains 90 screenshots. No editor or private inventory content is included in screenshots. Representative empty, unavailable and returned/saved images were visually reviewed.

## Retained initial attempts and bounded corrections

| Run | Exit | Result |
| --- | --- | --- |
| browser-r1 | 1 | Default sandbox could not connect to localhost8500; startup timed out before app interaction. A local probe returned Windows socket-access refusal. No external request was attempted. Exact local-only elevation was approved for later attempts. |
| browser-r2 | 1 | Full synthetic onboarding completed. The harness searched for an exact Local recovery label, but the existing You row combines label and explanatory hint. The driver selector was corrected to match that existing control. No application change or timeout change was made. |
| browser-r3 | 1 | Six-row empty/saved/unavailable/retry and zero-write checks passed at 375×667. Return-to-You checking used a global selector that selected a hidden retained route's close control. The harness then waited for that inactive panel's rows. No application failure was established; this failure is preserved. |
| browser-r4 | 0 | Active-route selectors exclude hidden/inert route elements, using the same interaction-tree rule as the existing harness. All assertions pass at all three sizes; no timeout or row/privacy/geometry assertion was weakened. |

The r3 diagnosis is confirmed by r4 `reentry-57.json`: the old Local recovery section is hidden, has no layout and is not the active open panel. `reentry-61.json` then records a separate active section with all six generic rows. This is actual route-state evidence, not an assumed timing explanation.

## Isolation and cleanup

The driver uses only installed Node, Expo and Edge; no Playwright dependency is installed or required. Environment credentials/public provider settings are removed. Expo uses offline/no-dotenv/no-telemetry plus `EXPO_UNSTABLE_HEADLESS=1` to suppress its debugger-shell download path. Browser DNS rules and CDP request interception allow localhost only. The final run records zero attempted external browser requests; local network receipts and raw console/Expo logs are retained. No download, installation, hosted CI, provider, native/device, paid or remote operation was used.

Dedicated hidden/headless Expo and Edge processes are stopped in each driver's finally block. Final owned PIDs 58640 and 72112 were verified absent after completion; `BROWSER_VERIFICATION.json` records that check. Fresh synthetic browser profiles remain isolated in temporary directories; no real browser profile was used or deleted.

All 38 requirements and 18 gates remain UNACCEPTED. J01 Visible Pores remains the only Korean assessment and inactive/refusing positive results. Release remains NO_GO; independent acceptance remains with Brain.
