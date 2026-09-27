# PHOTO-07 privacy-disclosure source checkpoint — 2026-09-27

## Status

This is a bounded **source checkpoint**, not PHOTO-07 completion or legal,
privacy-label, store-review, or release evidence. Formal execution status stays
unchanged. Final approved consent/policy copy, retention decisions, signed-build
traffic and filesystem inspection, physical-device deletion/export/key-loss
drills, accessibility, and professional review remain open.

## Corrected source claim

The welcome screen previously said photos “never leave your phone.” That was
too absolute because single-photo detail deliberately offers explicit image
sharing. It now matches the capture disclosure and actual implementation:
photos stay encrypted on the phone unless the user chooses to share one.

## Audited boundary

- Capture states no automatic upload, no cloud backup, no faceprint or
  biometric template, the explicit-share exception, and possible photo loss
  with a lost phone. The exact displayed words remain in the hashed receipt.
- Face framing retains only bounded geometry and finite pose angles for capture
  comparability; PHOTO-03 separately gates the no-identity implementation.
- Trend capability and exposure remain literal false, unavailable copy says no
  validated engine ships, no Trend consent is requested, and compatibility
  hooks remain inert.
- Explicit sharing says it sends the chosen image, does not blur it, and omits
  notes. Single-photo deletion distinguishes local image removal from queued
  matching account-record deletion.
- Export includes sanitized Progress metadata and decrypted notes when
  available, while excluding photo/thumbnail bytes, device paths, ciphertext,
  key material, auth credentials, and temporary cache files.
- Health withdrawal/account cleanup closes photo writes, drains them, purges
  decrypted memory and generated caches, removes health-purpose private
  metadata and encrypted photo storage, and reports partial failure for retry.

## Automated evidence

- Aggregate mutation-tested disclosure/lifecycle contract:
  `npm run photo07:source-contract:test`
- Focused mobile tests:
  `npm --workspace apps/mobile exec vitest run src/features/photos/consent.test.ts src/features/photos/claimsafety.test.ts src/features/photos/store.test.ts src/features/settings/localDeviceExport.test.ts src/features/healthConsent/selectiveCleanup.test.ts src/features/trend/useTrend.test.ts src/features/trend/trendRoutes.test.ts src/lib/launch/phase7.test.ts`

## Residual gates

- Counsel-approved exact capture, withdrawal, privacy-policy, retention, and
  consumer-health notice wording.
- App Privacy and nutrition-label answers bound to the submitted archive.
- Physical-iPhone key-loss, device-loss explanation, share, export, individual
  deletion, withdrawal, account deletion, interrupted cleanup, and retry proof.
- Signed-build network capture and filesystem/cache inspection.
- Hosted deletion of every applicable active-service record and reviewed
  backup/retention handling.
- VoiceOver, Dynamic Type, localization, and supported-device human-simulated
  E2E evidence against the exact build.
