# Phase 5 Device QA Checklist

Record device model, OS version, build profile, build ID, tester, date, pass/fail, and notes for every row.

Use `docs/DEVICE_SUPPORT_POLICY.md` and the active launch contract as the
support floor. V1 release QA is iPhone-only on iOS 17.0+, with 375 x 667 as the
launch-blocking Expo web-compatible compact-iPhone floor. iPad and Android are
outside the release contract. Their source configuration may stay healthy, but
their results cannot replace required physical-iPhone evidence. Smaller browser
stress viewports are not launch blockers unless reproduced on a supported
iPhone or required by App Review or accessibility.

| Surface           | Required Checks                                                                                                                                                                                                           | Status                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Install           | Fresh install, update, reinstall, dev/staging side by side                                                                                                                                                                | Blocked until EAS builds                                  |
| Camera permission | Granted, denied, denied then settings recovery                                                                                                                                                                            | Blocked until physical devices                            |
| Barcode           | EAN-13, UPC-A, UPC-E, EAN-8, invalid checksum, duplicate, glare, low light                                                                                                                                                | Blocked until physical devices                            |
| Catalog lookup    | Match, no match, external candidate, offline/error fallback                                                                                                                                                               | Blocked until Supabase staging + devices                  |
| Shelf freshness   | Exact opened/unopened date keyboard, label-confirmed PAO, printed expiry precedence, relaunch persistence, new-UUID re-add without inherited package expiry, finished archive, explicit replenishment opt-in and delivery | Local web gate implemented; native/staging QA pending     |
| Label capture     | Capture real label photo, editable text, low-confidence token visible, temp label deleted                                                                                                                                 | Blocked until physical devices                            |
| OCR engine        | ML Kit/Vision text recognition on real labels                                                                                                                                                                             | Blocked; native OCR disabled                              |
| Progress photos   | First capture, retake, reference ghost, timeline/compare, encrypted save failure recovery                                                                                                                                 | Blocked until physical devices                            |
| Photo storage     | Settings/locked Progress show device-only with no backup switch; stale enablement clears; local save sends no photo image/metadata                                                                                        | Local gate implemented; native network inspection pending |
| Progress app lock | Cold/direct tab, capture, review, and detail entries; app-wide then timeline prompt order; one foreground unlock; background relock; assistive-tech focus                                                                 | Local route gate implemented; native auth QA pending      |
| Progress storage  | Force encrypted metadata read failure on tab/capture/review/detail; no false empty/missing state or writes; persistent retry; restored-key success; screen reader                                                         | Local web gate implemented; native fault QA pending       |
| Capture quality   | Real one/no/multiple-face results; analyzer error/timeout; framing/pose; dark/bright/uneven light; threshold/provenance migration; no network/template retention                                                          | Blocked until fresh native builds + physical devices      |
| Encryption        | Plaintext temp deleted, encrypted file survives restart, key missing handled, delete removes ciphertext                                                                                                                   | Blocked until physical devices                            |
| Notifications     | Soft ask, OS prompt, AM/PM, capture nudge, quiet hours, denied recovery                                                                                                                                                   | Blocked until physical devices                            |
| Exact alarm       | Not applicable to the iOS-only release; keep Android exact-alarm permissions absent in source                                                                                                                             | Not applicable                                            |
| Share             | Conflict card share and photo share open OS sheet; cancel handled                                                                                                                                                         | Blocked until physical devices                            |
| RevenueCat        | SDK configure, fetch offerings, Test Store purchase, restore user action                                                                                                                                                  | Blocked until RC keys + native build                      |
| Observability     | Sentry native crash captured, PostHog payload audit clean                                                                                                                                                                 | Blocked until native build                                |
| Performance       | Predeclared p95 thresholds; repeated raw startup, intake, barcode, routine, capture-analysis, encrypted-photo load/memory samples on supported iPhones                                                                    | Blocked until physical measurements                       |
| Accessibility     | Screen reader labels for close/capture/retake/save/settings/manual fallback                                                                                                                                               | Review needed on devices                                  |

## Device Matrix

Minimum before beta:

- Current iPhone on current public iOS.
- Oldest-supported iOS 17-class iPhone available to the team.
- A supported compact iPhone at or near the 375 pt width floor.
- A current flagship-class iPhone for camera, progress-photo, notification,
  subscription, WidgetKit, ActivityKit, deep-link, and share-sheet behavior.

iPad and Android testing is optional resilience work until the founder changes
the launch contract. It must be stored separately and cannot block or satisfy
this iOS release gate.

## Evidence Required For Strict Exit

- Generated `docs/phase-5/generated/device-qa-packet.md` with `Git status:
clean`, current source hashes, real EAS build evidence, physical-device
  labels, current human-E2E manifest hashes, and named signoff.
- `PHASE5_IOS_BUILD_ID=<real EAS UUID or expo.dev build URL>`
- `PHASE5_IOS_DEVICE=<physical iPhone model and iOS version>`
- `PHASE5_QA_SIGNOFF=true`
- `PHASE5_SIGNED_OFF_BY=<real tester/reviewer name>`
- `PHASE5_DEVICE_QA_PASS=true`
- `PHASE5_INSTALL_QA_PASS=true`
- `PHASE5_CAMERA_PERMISSION_QA_PASS=true`
- `PHASE5_BARCODE_QA_PASS=true`
- `PHASE5_LABEL_CAPTURE_QA_PASS=true`
- `PHASE5_PROGRESS_PHOTO_QA_PASS=true`
- `PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS=true`
- `PHASE5_NOTIFICATION_QA_PASS=true`
- `PHASE5_SHARE_SHEET_QA_PASS=true`
- `PHASE5_REVENUECAT_NATIVE_QA_PASS=true`
- `PHASE5_SENTRY_NATIVE_QA_PASS=true`
- `PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS=true`
- `PHASE5_ACCESSIBILITY_QA_PASS=true`
- `PHASE5_NATIVE_OCR_QA_PASS=true` only if native OCR is enabled.
- `PHASE5_PERFORMANCE_EVIDENCE_PATH=<completed JSON artifact>` plus a passing
  `npm run phase5:performance-evidence:summarize` and
  `npm run phase5:performance-evidence:strict`; follow
  `docs/phase-5/performance-evidence-runbook.md` and retain every raw sample.
