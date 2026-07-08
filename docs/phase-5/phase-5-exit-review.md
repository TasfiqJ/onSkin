# Phase 5 Exit Review

## Current Status

Implementation baseline is in progress-ready state, not device-certified state.

Completed in repo:

- Native camera dependency and config plugin added.
- Runtime version policy added.
- Android camera and notification permissions declared.
- Exact-alarm permissions intentionally absent.
- Shelf barcode scanner uses live camera, local checksum validation, duplicate suppression, and Phase 4 catalog lookup.
- Ingredient label path captures a real label image and requires editable user-confirmed text.
- Progress capture uses the front camera, sends the real still to review, and saves encrypted local photo files.
- Photo timeline/detail/compare render through encrypted-aware image loading.
- Photo deletion removes local encrypted files.
- Phase 5 config check and device QA packet generator added.
- The generated QA packet now requires granular physical-device evidence flags
  for install, camera permission recovery, barcode, label capture, progress
  photos, encrypted photo storage, notifications, share sheet, RevenueCat,
  Sentry, Supabase catalog calls, accessibility, and conditional native OCR.
- The generated QA packet hashes the human-simulated E2E rules, user-flow tree,
  manifest generator, and generated manifest so native QA reviewers can see
  which local UI evidence contract the build was checked against.

Still blocked before beta:

- EAS iOS and Android builds with real build IDs.
- Physical-device installs and matrix results.
- On-device OCR module selection and QA if OCR is a launch claim.
- Real face/pose detector for progress-photo signals if precise framing claims are used.
- RevenueCat Test Store/sandbox native smoke.
- Sentry native crash/source-map smoke.
- Notification timing matrix on iOS/Android.
- Brand/legal clearance for production identifiers.

## Seven-Figure Product Gate

Phase 5 supports the paid app thesis only if it makes the core loop trustworthy on real phones: scan/search product, add shelf item, capture progress, receive reminders, and share safely. The highest-risk revenue blockers are not visual polish; they are barcode match reliability, photo privacy proof, reminder reliability, and purchase SDK readiness.

Do not advance launch copy from "beta/internal" to customer-facing claims until
the generated QA packet has no blockers and every required granular evidence
flag is backed by physical-device evidence.
