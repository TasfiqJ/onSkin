# Apple App Review Notes

Status: draft, not ready for submission
Last updated: 2026-07-29

These notes are for App Store Connect review information after legal/privacy review. Do not submit until the final identity, URLs, production services, professional signoffs, reviewer account, and exact build evidence are complete. The 20-feature acceptance matrix is [APPLE_REVIEW_FEATURE_ACCEPTANCE_MATRIX.md](../hugeToDo/APPLE_REVIEW_FEATURE_ACCEPTANCE_MATRIX.md).

## Reviewer Summary Draft

Do not submit a fixed feature paragraph from this draft. Generate the reviewer
summary from the exact signed release candidate's capability inventory and
include only routes that are production-admitted and reachable by an ordinary
user in that build. The current repository has no positive release admission
for recommendations, sharing, commerce, community, Trend, cloud Ask, or
widgets/Live Activities, and several other launch-required surfaces still lack
archive/device/professional evidence.

`[FINAL DISPLAY NAME]` is a general-wellness skincare routine organizer.
`[INSERT ONLY CAPABILITIES PROVEN BY THE EXACT SIGNED RELEASE INVENTORY.]`

The app must not diagnose, treat, cure, prevent, screen for, or detect medical
conditions. Do not submit categorical photo-storage, encryption, processing,
or network claims until PHOTO-01 through PHOTO-07 and the exact signed archive,
filesystem, memory, network, deletion, export, and physical-device evidence all
pass. Trend remains literal zero-admission and must not be described as a user
feature.

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
- The intended photo boundary is encrypted on-device storage and explicit
  user-directed sharing only; this wording remains blocked until PHOTO-01
  through PHOTO-07 and exact-build evidence pass.
- Cloud backup and automatic photo-image sync are unavailable in the current contract.
- Paid-link partner sharing is separate and off by default.
- Ask cloud mode is separate and default-off for consent, but launch-required;
  it remains blocked until vendor, safety, privacy, clinical, and legal gates pass.
- Account deletion is a launch-blocked source candidate. Do not state that it
  is available until malformed/unavailable local-store recovery, hosted/vendor
  deletion, subscription disclosure, and exact-device evidence pass.
- Account-data export is available in app. Its versioned JSON wrapper includes owner-scoped server data plus registered encrypted records from the current device, including local-first shelf/routine state and sanitized Progress metadata/notes. Progress image files, thumbnails, device paths, ciphertext, keys, credentials, and transient cache files are excluded; images can be shared individually from Progress.
- Community posting requires filtering, report, block, contact, removal, appeal, audit, and real staffed response paths before these notes can be submitted.
- Trend requires separate default-off consent and a validated score-free engine; no user is silently enrolled from legacy photo consent.
- Current PHOTO-05A source has literal zero Trend admission: it exposes no
  positive consent or result path and must not be submitted or described as
  providing Trend insights. Replace the bracketed reviewer-summary placeholder
  only after the exact build has a real issuer plus complete measurement,
  fairness, privacy/legal/professional, archive, network, device, and release
  evidence.
- The widget source candidate uses an allowlisted App Group payload and has a
  locked-state redaction contract, but publication/start remain disabled and
  this is not a user-facing reviewer claim until signed-build/device gates pass.

## Subscription Notes

- The paywall includes terms, privacy, restore, auto-renew, cancellation, and no-data-sale disclosures.
- Purchases are managed by Apple.
- Account deletion does not cancel App Store billing; the app tells users to cancel through the store.
- The app-granted Explore-first period is described as no-card access and is not represented as an Apple free trial or StoreKit product.

## Test Account

TBD before submission. Create a reliable reviewer account or approved demo
route that remains usable for the review window, and include exact steps and
sample resources for every admitted route in the submitted build. Long-lived
access is an internal reliability control, not an Apple-authored non-expiry
requirement. Do not use a reviewer-only fixture or behavior unavailable to
ordinary users.

## URLs

| URL                     | Environment variable                      | Status  |
| ----------------------- | ----------------------------------------- | ------- |
| Privacy policy          | `EXPO_PUBLIC_PRIVACY_URL`                 | Blocked |
| Terms                   | `EXPO_PUBLIC_TERMS_URL`                   | Blocked |
| Support                 | `EXPO_PUBLIC_SUPPORT_URL`                 | Blocked |
| Account deletion        | `EXPO_PUBLIC_ACCOUNT_DELETION_URL`        | Blocked |
| Data export             | `EXPO_PUBLIC_DATA_EXPORT_URL`             | Blocked |
| Consumer health privacy | `EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL` | Blocked |
