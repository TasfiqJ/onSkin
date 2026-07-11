# Pregnancy Safety Status E2E

- Status: pass
- Surface: Expo web in headless system Chrome
- Viewports: 360 x 640 and 390 x 844, plus 200% text pressure on the editable setting
- Covered: encrypted local status persistence, all four status choices, one-shot profile-write failure/retry, prefer-not cautious behavior, explicit-none restoration, Plan and Today exclusion consistency
- Consent/profile recovery: legacy consent stays cautious until current-text regrant; first consent write failure retries inline; missing local profile stays cautious and exposes rebuild recovery
- UI fixtures: retinoid and BHA without confirmed-low concentration; the focused unit matrix also covers hydroquinone
- Privacy: no vendor requests, dialogs, page errors, or disallowed browser errors
- Native follow-up: iOS 17+ and Android 10+ screen-reader, Dynamic Type, and physical-device persistence remain Tas-owned QA
