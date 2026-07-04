# Apple App Review Notes

Status: draft, not ready for submission  
Last updated: 2026-07-04

These notes are for App Store Connect review information after legal/privacy review. Do not submit until URLs and signoffs are complete.

## Reviewer Summary Draft

OnSkin is a skincare routine organization app. Users can save products to a private shelf, build AM/PM routines, receive conservative routine-order conflict flags, and compare their own progress photos. The app does not diagnose, treat, cure, prevent, or detect medical conditions. Photo progress has no score, skin age, grade, or disease detection. Photos stay on device by default unless the user separately enables encrypted cloud backup.

## Health/Medical Boundary

- No diagnosis.
- No treatment instructions.
- No disease detection.
- No emergency or triage flow.
- No clinician marketplace in V1.
- Medical questions in Ask OnSkin are refused or escalated verbally to a board-certified dermatologist.

## Privacy Boundary

- Health-adjacent profile/routine data is collected only after consent.
- Photos remain on device by default.
- Cloud backup is separate and off by default.
- Paid-link partner sharing is separate and off by default.
- Ask cloud mode is separate, off by default, and deferred until vendor/legal review.
- Account deletion is available in app.
- Data export is available in app.

## Subscription Notes

- The paywall includes terms, privacy, restore, auto-renew, cancellation, and no-data-sale disclosures.
- Purchases are managed by Apple.
- Account deletion does not cancel App Store billing; the app tells users to cancel through the store.

## Test Account

TBD before submission.

## URLs

| URL                     | Environment variable                      | Status  |
| ----------------------- | ----------------------------------------- | ------- |
| Privacy policy          | `EXPO_PUBLIC_PRIVACY_URL`                 | Blocked |
| Terms                   | `EXPO_PUBLIC_TERMS_URL`                   | Blocked |
| Support                 | `EXPO_PUBLIC_SUPPORT_URL`                 | Blocked |
| Account deletion        | `EXPO_PUBLIC_ACCOUNT_DELETION_URL`        | Blocked |
| Data export             | `EXPO_PUBLIC_DATA_EXPORT_URL`             | Blocked |
| Consumer health privacy | `EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL` | Blocked |
