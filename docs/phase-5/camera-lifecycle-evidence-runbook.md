# Phase 5 CAT-06 Camera Lifecycle Evidence Runbook

CAT-06 is not cleared by source tests, Expo web, a simulator, a permission
Boolean, or a tester's prose summary. The gate requires a completed schema-v1
artifact for the exact committed source, EAS build, inspected signed archive,
and two supported physical iPhones. Until that artifact passes, camera
lifecycle status remains `in_progress` / physical-device-blocked.

A passing artifact establishes only the recorded technical QA result. It does
not guarantee App Review acceptance, legal compliance, commercial success, or
behavior outside the exact build, phones, OS builds, routes, and scenarios
recorded.

The retained CAT-04 and CAT-05 deterministic Expo-web packets were generated
before the CAT-06 shared camera lifecycle and are stale for the current source
until regenerated. Their `nativeDeviceProof=false` boundary is permanent:
regeneration may restore current UI provenance but cannot satisfy this native
artifact contract.

## Why this gate exists

- iOS may move the app through `inactive` while a system permission prompt is
  visible. Permission resolution, foreground refresh, route focus, camera
  mounting, camera-ready state, and in-flight native callbacks therefore have
  to be tested as one lifecycle rather than as independent Booleans.
- Expo Camera permits only one active preview. Every route must unmount an
  unfocused preview, wait for camera-ready before an operation, and use a fresh
  generation after failure or lifecycle invalidation.
- Camera output begins in app cache. Label and Progress photo paths must prove
  awaited, retryable cleanup across Continue, Retake, Save, Leave, late native
  results, route removal, gate replacement, and cold relaunch.
- Apple's review rules require a clear purpose string, contextual permission
  use, respect for permission choices, an alternative when practical, and a
  clear indication when recording user activity. The archive report verifies
  the exact final `NSCameraUsageDescription`; the device matrix verifies the
  actual recovery behavior. Professional review remains a separate launch
  gate.

Primary implementation references to re-check immediately before the run:

- [Expo Camera (SDK 57)](https://docs.expo.dev/versions/v57.0.0/sdk/camera/)
- [React Native AppState](https://reactnative.dev/docs/appstate)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple privacy permission guidance](https://developer.apple.com/design/human-interface-guidelines/privacy)
- [Apple protecting user privacy](https://developer.apple.com/documentation/uikit/protecting-the-user-s-privacy)

## Generate the blocked template

From a clean source candidate, run:

```bash
npm run phase5:camera-lifecycle-evidence:smoke
npm run phase5:camera-lifecycle-evidence:template
npm run phase5:camera-lifecycle-evidence:template:check
```

Use `docs/phase-5/camera-lifecycle-evidence.template.json` without removing,
renaming, or replacing fields. A template containing `null` values is a
blocked work order, never evidence.

## Exact source and build binding

1. Commit every runtime/config change before starting EAS. The artifact binds
   the exact 40-character EAS source SHA and SHA-256 of every required camera,
   permission, consent, cleanup, route, config, dependency-lock, and app-lock
   input.
2. Use the reviewed `staging` or final `production` profile. The validator
   rejects development builds because CAT-06 is a release-candidate gate.
3. Retain the EAS UUID or canonical Expo build URL and build log. The log must
   show the pinned EAS CLI, full EAS image, resolved Xcode version/build, and
   iOS SDK. Commit only a reviewed canonical binding excerpt beginning with
   `LAYERWELL_CAMERA_BUILD_BINDING_V1` and exactly one line for source
   SHA, EAS build ID, profile, image, EAS CLI, Xcode, iOS SDK, bundle ID, app
   version, iOS build number, and archive SHA-256, in template order, with no
   other lines. Retain the untouched raw build log only in the access-controlled
   release workspace; never commit it or any credential-bearing diagnostic.
4. Hash the signed `.xcarchive` before extraction. Record the bundle ID,
   application identifier, Team ID, provisioning-profile UUID, signing
   certificate digest, executable digest, and a successful `codesign`
   verification in the canonical archive-identity report. The executable hash
   is taken from the inspected archive on macOS; the contract does not pretend
   a standard non-jailbroken iPhone exposes its installed executable.
5. Extract the application `Info.plist` from that same archive. Do not validate
   source config or a generated pre-signing plist instead. The final value must
   be exactly:

   ```text
   Allow <resolved display name> to use the camera to scan product barcodes, capture ingredient labels, and take guided progress photos. Barcode frames are processed on your device; label and progress photos remain local.
   ```

   Record one string occurrence and the absence of unresolved `$(...)` or
   `${...}` build variables. The final plist report repeats the exact
   source/build/archive binding and the bundle/display/version/build identity.

The archive may remain in the access-controlled release workspace. The
checked-in report and build binding carry its digest; do not put signing keys,
provisioning secrets, raw device identifiers, or user photo bytes in Git.

## Two-physical-iPhone floor

Test every required run on both phones:

- one distinct physical iPhone on an actual iOS 17.x build for the accepted
  install floor, at 375 points wide or wider; and
- one distinct current flagship-class physical iPhone on the current public
  iOS release.

Before `testStartedAt`, record the current public iOS version and a primary
Apple HTTPS source. The current phone's exact OS version must match that
reviewed value. The contract review performed 2026-07-18 binds `iOS 26.5.2`,
Apple security release page `https://support.apple.com/en-ca/100100`, and an
`iPhone 17 Pro` or `iPhone 17 Pro Max`. Re-review and rerun immediately after a
new public iOS release; beta releases do not replace the current-public floor.
Record hardware model identifiers and OS build numbers. Store
only a SHA-256 digest of the device identifier; never commit a UDID. Both
phones must start from a fresh install of the exact candidate. Each phone gets
a unique, hash-verified installation receipt recording the source/build/archive
binding, privacy-preserving device digest, install timestamp, and supported
installation method (EAS internal distribution, TestFlight, or Apple
Configurator). Confirm bundle ID, app version, and build number in-app/on-device.
The receipt binds the installation to the archive hash without claiming an
unobservable installed-file hash.

Additional supported iPhones may be added, but they add the full 27-run matrix
and cannot replace either required role.

## Required per-device route matrix

For each of `/shelf/scan`, `/shelf/ocr`, and `/progress/capture`, execute all
nine governed scenario suites on both phones. The two-phone floor is therefore
54 required runs. Every run has exact timestamps, pre/post permission state,
network mode, all predeclared observations set to true, and one unique,
hash-verified JSON proof artifact; no other proof media type is accepted. The
small canonical wrapper repeats the exact source/build/archive binding and embeds the complete
governed run object. Interactive video/screenshots stay in the access-controlled
workspace; record their reviewed digest in the structured log rather than
committing camera/photo pixels.

Each run proof also carries a bounded canonical `sourceEvidence` array. Normal
UI/lifecycle runs require `[screen_recording, structured_device_log]`; offline
runs require `[screen_recording, structured_device_log, network_trace]`;
accessibility runs require `[accessibility_recording]`; privacy runs require
`[screen_recording, structured_device_log, network_trace, filesystem_inspection]`.
The array order is exact. Every entry has a unique non-zero SHA-256, an exact
derived `cat06/<device>/<route>/<scenario>/<kind>` access-controlled reference,
an accountable person's name, and a canonical review timestamp after the run
and before packet completion/signoff. Absolute paths, URLs, traversal,
credentials, duplicate digests/references, zero digests, role-only or sample
names, and unreviewed raw evidence are rejected. These digests, references, and
names are accountable attestations; the validator does not fetch or independently
authenticate access-controlled raw media.

1. **Permission:** first-use `undetermined` to granted; contextual request;
   retryable denial and retry; no preview before authority. Progress must also
   prove local-photo consent before the OS request and consent-save failure
   recovery in its camera-operation suite.
2. **Settings:** `denied` plus `canAskAgain=false`; exactly one Settings action;
   fresh permission query on return; recovery after grant; visible, retryable
   Settings-open failure; non-camera fallback remains reachable.
3. **Lifecycle:** the iOS permission-prompt `inactive` transition invalidates
   the pending request result; the fresh foreground permission query is
   authoritative before remount; background invalidates the lease; late
   callbacks and post-unmount state writes are absent.
4. **Mount:** only one preview; unfocused route unmount; camera-ready gates the
   operation; mount/ready failure is visible; retry creates a fresh generation
   and recovers without relaunch.
5. **Camera operation:** barcode checksum/duplicate/queued-callback behavior on
   Scan; failure/retry/manual fallback/late cleanup on OCR; consent, shutter,
   capture failure, navigation drain, and gate-replacement cleanup on Progress.
6. **Offline:** verify airplane-mode or equivalent real offline state. Scan
   must retain safe fallback/confirmation semantics; OCR must retain local
   capture/manual entry without OCR or image network traffic; Progress must
   capture, encrypt, save, and view locally without upload or a cloud-backup
   control.
7. **Interruption:** exercise a native interruption such as Control Center,
   phone call/system overlay, or camera interruption. Prove suspension, lease
   invalidation, fresh query, one remount, no stale navigation/mutation, and
   successful retry.
8. **Accessibility:** VoiceOver labels/values/focus order, 200% Dynamic Type,
   44-point targets, non-color status, Reduce Motion, and reachable Settings,
   retry, and fallback paths.
9. **Privacy:** a network capture spans the scenario. Scan retains no frame or
   raw-barcode analytics; OCR proves managed/Expo Camera/image-cache cleanup;
   Progress proves Retake/Back/Close/Save/failure cleanup, no cached preview,
   no duplicate encrypted save, no uploads, and no sensitive logs.

Do not edit an observation to `true` from memory. Retain the raw video,
screenshot, structured device log, or network/filesystem report that proves the
run. A typed `result: "pass"` cannot override a missing/false observation.

## Required canonical reports and attachments

All files must be regular, direct files below
`docs/phase-5/evidence/camera-lifecycle/<candidate>/`. The validator re-hashes
every byte through canonical realpath containment, rejects symlinks, junctions,
alternate-data-stream/portable-path violations, read races, oversized inputs,
duplicate files, invalid MIME signatures/extensions, and requires a unique
`proof-<run-id>` attachment for every run. The main manifest is capped at 2 MiB.

Each file also contains a named, timestamped privacy classification that must
attest to synthetic or redacted non-sensitive content only, with no user or
label-photo pixels, raw barcode, raw OCR transcript, raw device identifier, or
absolute local filesystem path. The validator rejects any affirmative
sensitive-content flag. Text/JSON are also scanned for common absolute
Windows, `file://`, and iOS container paths. Do not hide sensitive pixels in a
syntactically valid video or screenshot; the named reviewer and aggregate
cleanup report remain accountable for the actual bytes.

Per-file ceilings are 512 KiB for JSON and 8 MiB for the redacted build-log
attachment. The entire attachment set is capped at 24 MiB. Keep full raw
captures in the access-controlled evidence workspace and commit only the
smallest structured proof needed for review.

The eight base artifacts are:

1. `eas_build_log`;
2. `archive_identity_report`;
3. `final_info_plist_report`;
4. `device_inventory_report`;
5. `network_privacy_report`;
6. `privacy_cleanup_report`;
7. `accessibility_report`; and
8. `scenario_index`.

Two additional `install_receipt-<device-id>` JSON artifacts are required at
the two-phone floor, followed by all 54 unique run proofs.

Every JSON report repeats the exact source SHA, EAS build, archive hash, bundle
ID, app version, and iOS build number. The scenario index must enumerate all
run and proof IDs without omissions or duplicates. Network, cleanup, and
accessibility reports must enumerate every relevant run and both phones. The
privacy cleanup report must enumerate every artifact ID and attest that all
files were reviewed and contain no user/label pixels, raw barcode/transcript,
raw device identifier, or absolute local path. A per-file classification and
this aggregate attestation are both mandatory; neither substitutes for the
other.

All timestamps use canonical millisecond UTC form
`YYYY-MM-DDTHH:mm:ss.sssZ`. Future-dated test, completion, report, privacy
review, or signoff records beyond the validator's five-minute clock-skew
allowance are rejected. Completion and signoff must be no more than seven days
old; device-policy review must be within seven days before testing. Runs on the
same phone must have non-overlapping intervals of at least one second, and a
passing canonical run has `notes: null`. The network capture uses an allowlisted,
structured name/version/mode record and must begin at or before
`testStartedAt`, end at or after `completedAt`, and enumerate every offline
run. Per-run JSON is parsed and compared exactly with the governed run; a
syntactically valid but edited proof cannot pass. A `pass` artifact must have
no unresolved `knownLimitations`; record and resolve gaps before signing.

For privacy cleanup, use a governed synthetic/original test image, retain its
digest outside the summary, and inspect managed label-photo storage, Expo
Camera staging, Expo Image/SDWebImage cache locations, encrypted Progress
storage, and cold-relaunch residue. Never use or commit a real user's sensitive
photo. `noUserPhotoBytesCommittedToGit=true` is mandatory.

## Validation and governed evidence chain

After completing and reviewing the matrix:

```bash
PHASE5_IOS_BUILD_ID=<exact EAS UUID or build URL> \
PHASE5_IOS_BUILD_PROFILE=staging \
PHASE5_CAMERA_LIFECYCLE_EVIDENCE_PATH=docs/phase-5/evidence/camera-lifecycle/<candidate>/evidence.json \
PHASE9_RELEASE_CANDIDATE_DIR=docs/phase-9/release-candidates/<rc-id> \
npm run phase5:camera-lifecycle-evidence:strict
```

Use three accountable-person signoffs: QA, privacy/security, and accessibility.
Role labels and sample personas are rejected; QA and privacy/security must be
independent people. Sign only after the final run. The validator records these
as accountable attestations and does not independently verify civil identity.

Stage the evidence JSON, every referenced attachment, the selected RC metadata,
and all other direct evidence while `HEAD` is the exact build-source commit
`S`. Build the selected RC ledger with
`scripts/phase9/build-evidence-chain-ledger.mjs`, then commit the ledger and all
of its entries together as the single non-merge evidence commit `E` directly
on `S`. The strict checker requires the camera JSON and every attachment to be
the exact `phase5-camera-lifecycle` ledger entries, verifies their digests and
immutability through current `HEAD`, rejects source drift, nonlinear/merge
history, unledgered or post-`E` raw evidence, and accepts later commits only at
the centralized exact generated-output paths. Any runtime/config/doc gate
change requires a new build and full rerun. Then pass the same build/profile/
evidence/RC variables to:

```bash
npm run phase5:qa-packet:strict
```

`PHASE5_CAMERA_PERMISSION_QA_PASS` is legacy, ignored, and incapable of
clearing CAT-06. Non-strict validation intentionally exits successfully when
evidence is absent so local development can continue, but prints a blocked
warning. Never translate that warning or exit code into completion.
