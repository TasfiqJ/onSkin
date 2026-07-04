# Phase 5 Device QA Checklist

Record device model, OS version, build profile, build ID, tester, date, pass/fail, and notes for every row.

| Surface | Required Checks | Status |
| --- | --- | --- |
| Install | Fresh install, update, reinstall, dev/staging side by side | Blocked until EAS builds |
| Camera permission | Granted, denied, denied then settings recovery | Blocked until physical devices |
| Barcode | EAN-13, UPC-A, UPC-E, EAN-8, invalid checksum, duplicate, glare, low light | Blocked until physical devices |
| Catalog lookup | Match, no match, external candidate, offline/error fallback | Blocked until Supabase staging + devices |
| Label capture | Capture real label photo, editable text, low-confidence token visible, temp label deleted | Blocked until physical devices |
| OCR engine | ML Kit/Vision text recognition on real labels | Blocked; native OCR disabled |
| Progress photos | First capture, retake, reference ghost, timeline render, compare render | Blocked until physical devices |
| Encryption | Plaintext temp deleted, encrypted file survives restart, key missing handled, delete removes ciphertext | Blocked until physical devices |
| Notifications | Soft ask, OS prompt, AM/PM, capture nudge, quiet hours, denied recovery | Blocked until physical devices |
| Exact alarm | Play Console has no exact-alarm warning | Blocked until Android build |
| Share | Conflict card share and photo share open OS sheet; cancel handled | Blocked until physical devices |
| RevenueCat | SDK configure, fetch offerings, Test Store purchase, restore user action | Blocked until RC keys + native build |
| Observability | Sentry native crash captured, PostHog payload audit clean | Blocked until native build |
| Accessibility | Screen reader labels for close/capture/retake/save/settings/manual fallback | Review needed on devices |

## Device Matrix

Minimum before beta:

- Current iPhone on current public iOS.
- Older supported iPhone or small-screen iPhone.
- Current Pixel or equivalent Android.
- Current or midrange Samsung Android.
- Android 13+ notification permission behavior.
- Android 14+ exact-alarm/background behavior.
