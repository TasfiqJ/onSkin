# Phase 5 Native OCR Evidence Runbook

CAT-05 is not cleared by source tests, a feature flag, a simulator, or a typed
Boolean. Production OCR must remain disabled until this contract passes for the
exact signed iOS build and source commit tested on physical iPhones. A passing
artifact establishes only the recorded technical QA result; it does not by
itself establish Apple approval, legal clearance, or product accuracy outside
the governed corpus.

## Evidence floor

- Start from the schema-v2
  `docs/phase-5/native-ocr-evidence.template.json`; do not remove fields or
  replace raw runs with a prose signoff. Schema v2 makes label-photo image-cache
  inspection mandatory; schema-v1 artifacts cannot clear OCR.
- Bind the artifact to the exact 40-character EAS source Git SHA, every required
  runtime source-file SHA-256, the EAS iOS build UUID, build profile, bundle ID,
  app/build versions, and inspected archive SHA-256.
- Use at least two distinct physical iPhone models on iOS 17 or newer. Include
  the supported-floor class and a current device when available; simulator and
  generic device labels are rejected.
- Govern at least five independently identified labels in each class: `clear`,
  `curved`, `tiny`, `multilingual`, and `glare_heavy`. Test every label on every
  declared phone, yielding at least 50 device-label runs for the two-device
  floor. At least two multilingual items must carry an Arabic, Persian, Hebrew,
  or Urdu language tag so right-to-left geometry and reading order cannot be
  replaced by Latin-only multilingual evidence.
- Do not commit third-party label photos. Record a permitted rights basis,
  meaningful provenance note, reviewed ground-truth digest, language tags, and
  token count for each corpus item. Retain the protected corpus and review
  record in the access-controlled evidence workspace.
- Store no OCR transcript, ingredient text, image path, or device file URI in
  this summary artifact. The corpus IDs, ground-truth digests, and aggregate
  token counts are sufficient for cross-binding without turning launch docs
  into a new sensitive-data store.

## Predeclared thresholds

The named owner must record thresholds before `testStartedAt`. The validator
will accept stricter values, but never weaker values, than:

- clear-label token recall: at least 0.95;
- curved, tiny, multilingual, and glare-heavy token recall: at least 0.85 for
  each class;
- inserted-token rate: at most 0.05 for every class;
- ordered-sequence similarity: at least 0.95 for clear labels and 0.85 for each
  challenging class, calculated from the token-sequence edit distance rather
  than unordered token overlap;
- class p95 native recognition time: at most 5,000 ms; and
- application timeout: exactly 12,000 ms.

Recall, insertion rates, and ordered-sequence similarity are calculated from
raw matched/expected/output counts and token-sequence edit distance. Use the
same predeclared tokenization for ground truth and OCR output, then calculate a
one-to-one, minimum-Levenshtein alignment with unit insertion, deletion, and
substitution costs. `matchedTokenCount` is the number of exact-equal aligned
token pairs; `insertedTokenCount` is a subset of unmatched output tokens. The
validator rejects counts that cannot reconcile with that alignment, including
matches beyond either sequence, edit distance below the sequence-length delta,
or edit distance below either sequence's unmatched-token count. It also
calculates nearest-rank p95 recognition time. This prevents a transcript
containing the right tokens in the wrong INCI order from passing on unordered
recall alone. Every RTL run requires an explicit reading-order pass. A typed
`pass` or edited summary cannot override a calculated failure.

Vision confidence is an engine score, not a calibrated probability. Every run
must retain editable text, uncertainty cues, and reachable manual recovery;
the app must not present confidence as “percent accurate.” Multilingual runs
must preserve their reviewed glyphs and every transcript must remain NFC.

## Required proof attachments

Keep these seven non-symlink, non-duplicate artifacts under
`docs/phase-5/evidence/native-ocr/` and record their exact size, MIME type, and
SHA-256 in the summary JSON:

1. EAS build log;
2. signed-archive inspection;
3. raw run export;
4. physical-device network capture;
5. VoiceOver/Dynamic Type/accessibility report;
6. cancellation/temp-photo and image-cache cleanup report; and
7. corpus provenance/rights report.

The network capture must span the test window and demonstrate zero OCR network
requests, zero label-image upload, zero transcript upload, device-only image
and transcript handling, and no sensitive logs. Cleanup evidence must cover
cancel-and-drain, ignored late results, Continue, Retake, Leave, and orphan
inspection. The same `cleanup_report` must bind
`noLabelPhotoInImageCaches: true` to an explicit filesystem inspection of Expo
Camera's pre-managed `Caches/Camera` staging location and the Expo
Image/SDWebImage disk-cache locations after Continue, Retake, Leave, and a cold
relaunch. Search using the governed test image's byte digest and recognizable
file signature so a UUID, hashed cache filename, or transformed preview cannot
evade the check; do not use a real user's sensitive photo for this proof.
Record `noOrphanedManagedPhotos: true` only after checking managed
`catalog-label-photo-temp-*` files. Separately record
`noOrphanedExpoCameraPhotosAfterColdRelaunch: true` only after a cold-relaunch
inspection confirms that the app-boot snapshot/drain removed the governed raw
direct-child `Caches/Camera/<canonical UUID>.jpg` fixture without touching a
post-boot capture. The cleanup report must include the test fixture digest, the
pre/post path inventory, each bounded retry pass, and the final absence check;
keep the image bytes outside Git.

Set `startupSnapshotRetryBeforeSuccessPass: true` only after forcing an initial
`getInfo` or directory-list acquisition failure, proving that both label and
Progress shutters remain blocked, and then successfully acquiring on retry.
Exercise successful missing-directory, empty-directory, and populated-directory
snapshots. Set `startupSnapshotFrozenAfterSuccessPass: true` only after creating
a recognizable post-acquisition Camera file and proving that overflow and
deletion retries drain only the first successful snapshot without relisting or
deleting the new file. Acquisition may retry before success because every
`takePictureAsync` call awaits the same serialized shared drain; after the first
successful snapshot it must never relist.

Set `combinedStartupDrainCoordinationPass: true` only after forcing one sibling
of the combined managed-prefix/raw-Camera pass to reject while the other stays
pending, proving the rejection is not exposed until both have settled. Concurrent
start/retry callers must receive the same pending promise; exactly one new pass
may launch after a settled rejection; and every start/retry after the first
fulfilled combined pass must return that fulfilled promise without any new
listing or deletion.

Set `staleRawCaptureRemovedAfterLeaseInvalidation: true` only after delaying a
Progress shutter result across blur, explicit close, and unmount, then proving
the resolved raw URI is awaited through idempotent deletion before return. The
same cases must emit no capture analytics or navigation after lease invalidation
and must not write UI state after unmount. The exact source binding includes
both capture routes and the shared scavenger so these ownership boundaries
cannot drift after evidence is recorded.

Set `progressReviewRawCaptureLifecyclePass: true` only after proving the
Progress review route rejects non-canonical or non-direct Expo Camera route
URIs before any read, preview, persistence, or deletion; renders an accepted
preview with `cachePolicy="none"`; and drains the raw source before back, swipe,
close, Retake, or successful Save removes the route. Exercise concurrent Save
and removal, persistence failure, raw-deletion failure with visible retry, and
post-persistence cleanup retry without duplicate encrypted storage. The report
must prove route removal stays blocked until cleanup succeeds and the governed
raw digest is absent afterward. Exact hashes bind both
`apps/mobile/src/app/progress/review.tsx` and
`apps/mobile/src/features/photos/progressCapturePrivacy.ts`; the protected image
bytes stay outside Git.
Accessibility evidence must cover both declared phones, VoiceOver editing,
non-stealing status announcements, 200% Dynamic Type, at least 48 pt targets,
non-color uncertainty cues, and manual fallback.

## Workflow

1. Refresh and commit the blocked template with the source implementation:

   ```bash
   npm run cat05:native-ocr-source-contract:test
   npm run phase5:native-ocr-evidence:template
   npm run phase5:native-ocr-evidence:template:check
   ```

2. Define thresholds, corpus governance, devices, build identifiers, and test
   protocol before the first measured run.
3. Build from a clean committed source SHA. Retain the EAS build log and inspect
   the signed archive before installing the same build on both phones.
4. Run the full device × label matrix, raw network capture, accessibility pass,
   and cleanup pass. Calculate the class summaries from the raw counts; do not
   omit failed or timed-out runs.
5. Put the completed summary JSON and all seven attachments below the governed
   evidence root. Stage them with every other direct release-candidate evidence
   file, build the selected RC `evidence-chain.json`, and commit the ledger plus
   its entries together as the single evidence commit `E` whose sole parent is
   the build-source commit `S`. Follow the exact builder procedure in
   `docs/phase-9/release-candidates/README.md`; do not hand-edit the ledger.
6. From the clean committed `E` checkout, run:

   ```bash
   PHASE5_IOS_BUILD_ID=<exact EAS UUID or expo.dev build URL> \
   PHASE5_IOS_BUILD_PROFILE=staging \
   PHASE5_NATIVE_OCR_EVIDENCE_PATH=docs/phase-5/evidence/native-ocr/<candidate>/evidence.json \
   PHASE9_RELEASE_CANDIDATE_DIR=docs/phase-9/release-candidates/<rc-id> \
   npm run phase5:native-ocr-evidence:strict
   ```

   The checker requires the evidence JSON and all seven attachments to be the
   exact `phase5-native-ocr` ledger entries at `E`, verifies their committed
   SHA-256 values and unchanged working bytes, re-hashes the runtime source files
   pinned to `S`, and rejects merges, nonlinear history, raw-evidence mutation,
   source drift, unledgered files, and near-miss generated paths. Later commits
   may change only the centralized exact generated-output allowlist.

7. Pass the same four values into `npm run phase5:qa-packet:strict`. A failed
   `E` is not repaired by appending another raw-evidence commit; correct the
   packet and construct a fresh governed `S`/build/`E` chain.

Outside strict mode, an absent artifact emits a warning and leaves OCR
externally blocked. Never translate that zero exit code into a launch pass.
