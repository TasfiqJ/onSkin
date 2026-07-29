# Apple App Review Notes

Status: draft, not ready for submission
Last updated: 2026-07-29

These notes are for App Store Connect review information after legal/privacy review. Do not submit until the final identity, URLs, production services, professional signoffs, reviewer account, and exact build evidence are complete. The 20-feature acceptance matrix is [APPLE_REVIEW_FEATURE_ACCEPTANCE_MATRIX.md](../hugeToDo/APPLE_REVIEW_FEATURE_ACCEPTANCE_MATRIX.md).

## Reviewer Summary Draft

`[FINAL DISPLAY NAME]` is a general-wellness skincare routine organizer. Users can complete a consented skin-profile quiz; add products through manual entry, catalog search, barcode, or native label OCR; build and check off reviewed routines; use a conservative cycle/ramp scheduler; keep private local-first progress photos; receive reminders; manage a StoreKit subscription or one-time app-granted Explore-first period; inspect reviewed recommendations and Skin Notes; use a disclosed cloud Ask advisor; share reviewed conflict cards; follow disclosed commerce links; participate in a moderated community; `[ONLY AFTER POSITIVE PHOTO-05/06/07 ADMISSION: view validated score-free Trend insights]`; and use privacy-redacted iOS widgets and Live Activities.

The app does not diagnose, treat, cure, prevent, screen for, or detect medical conditions. Photo progress and Trend have no skin score, skin age, grade, percentage improvement, lesion analysis, or disease detection. Progress photos stay encrypted on the device and are not sent to Ask, analytics, crash reporting, commerce, community, or advertising. Cloud photo backup is not offered unless a later separately consented and reviewed requirement replaces this statement.

## Health/Medical Boundary

- No diagnosis.
- No treatment instructions.
- No disease detection.
- No emergency or triage flow.
- No clinician marketplace.
- Medical, emergency, lesion, diagnosis, prescription, and treatment requests in Ask are refused with appropriate professional/emergency-care direction; the app does not claim that a dermatologist is reviewing live prompts.
- Conflict, routine, recommendation, Skin Notes, Ask retrieval content, and Trend limitations must match the exact signed clinical/cosmetic-chemistry evidence hashes.

## Privacy Boundary

- Health-adjacent profile/routine data is collected only after consent.
- Photos remain encrypted on device unless the user explicitly shares one.
- Cloud backup and automatic photo-image sync are unavailable in the current contract.
- Paid-link partner sharing is separate and off by default.
- Ask cloud mode is separate and default-off for consent, but launch-required;
  it remains blocked until vendor, safety, privacy, clinical, and legal gates pass.
- Account deletion is available in app.
- Account-data export is available in app. Its versioned JSON wrapper includes owner-scoped server data plus registered encrypted records from the current device, including local-first shelf/routine state and sanitized Progress metadata/notes. Progress image files, thumbnails, device paths, ciphertext, keys, credentials, and transient cache files are excluded; images can be shared individually from Progress.
- Community posting requires filtering, report, block, contact, removal, appeal, audit, and real staffed response paths before these notes can be submitted.
- Trend requires separate default-off consent and a validated score-free engine; no user is silently enrolled from legacy photo consent.
- Current PHOTO-05A source has literal zero Trend admission: it exposes no
  positive consent or result path and must not be submitted or described as
  providing Trend insights. Replace the bracketed reviewer-summary placeholder
  only after the exact build has a real issuer plus complete measurement,
  fairness, privacy/legal/professional, archive, network, device, and release
  evidence.
- Widgets/Live Activities use an allowlisted App Group payload and redact private detail while the device/app is locked.

## Subscription Notes

- The paywall includes terms, privacy, restore, auto-renew, cancellation, and no-data-sale disclosures.
- Purchases are managed by Apple.
- Account deletion does not cancel App Store billing; the app tells users to cancel through the store.
- The app-granted Explore-first period is described as no-card access and is not represented as an Apple free trial or StoreKit product.

## Test Account

TBD before submission. Create a non-expiring reviewer account and include exact steps and sample resources for every route in the 20-feature matrix. Do not use a reviewer-only fixture or behavior unavailable to ordinary users.

## URLs

| URL                     | Environment variable                      | Status  |
| ----------------------- | ----------------------------------------- | ------- |
| Privacy policy          | `EXPO_PUBLIC_PRIVACY_URL`                 | Blocked |
| Terms                   | `EXPO_PUBLIC_TERMS_URL`                   | Blocked |
| Support                 | `EXPO_PUBLIC_SUPPORT_URL`                 | Blocked |
| Account deletion        | `EXPO_PUBLIC_ACCOUNT_DELETION_URL`        | Blocked |
| Data export             | `EXPO_PUBLIC_DATA_EXPORT_URL`             | Blocked |
| Consumer health privacy | `EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL` | Blocked |
