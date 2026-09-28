# PHOTO-03 capture-analysis source checkpoint — 2026-09-26

## Status

This is a bounded **source checkpoint**, not PHOTO-03 completion or release
evidence. Formal execution status remains unchanged. PHOTO-03 still depends on
PHOTO-02 and requires signed-build, supported-iPhone, diverse-condition,
filesystem, performance, accessibility, and human-simulated E2E proof.

## Source boundary

Post-capture analysis runs only on the disposable local still. Native face
output is copied immediately into an allowlist containing one bounding box and
finite Euler pose angles; landmarks, contours, classification, tracking,
templates, embeddings, identity comparison, and faceprints are disabled or
absent. A `matched` framing result requires one face, valid dimensions, every
finite pose signal, center/scale tolerances, pose tolerances, and the bounded
geometry score. Missing, malformed, multiple-face, timed-out, or unavailable
signals fail safely to adjustment or unavailable states.

Lighting uses a 64 px local JPEG derivative registered in the plaintext-staging
journal before generation. The generated file must be a canonical package-cache
child, is moved into the journal-owned path, decoded with strict resolution and
memory caps, and cleaned before success can return. Cleanup failure remains a
retryable blocking error rather than silently saving plaintext residue.

One per-URI, account-generation coordinator fences detector and lighting work.
URI replacement, timeout, navigation, save, unmount, or account change aborts
and drains work; native continuations reassert the lease before publication.
The implementation imports no cloud, network, analytics, or identity service.
Development fixtures require both `__DEV__` and the explicit E2E enable flag.

## Automated evidence

- Aggregate mutation-tested AST/dataflow contract:
  `npm run photo03:source-contract:test`
- Focused mobile tests:
  `npm --workspace apps/mobile exec vitest run src/features/photos/captureAnalysis.test.ts src/features/photos/analyzePhotoLighting.test.ts src/features/photos/detectedFacesOperation.test.ts src/features/photos/captureAnalysisCoordinator.test.ts src/features/photos/quality.test.ts src/features/photos/qualityProvenance.test.ts src/features/photos/progressRoutes.test.ts src/features/photos/progressCapturePrivacy.test.ts`

## Gates source cannot close

- Signed iOS archive dependency resolution and native detector execution.
- Supported physical-iPhone calibration across skin tones, lighting, hair,
  glasses, occlusion, devices, poses, and ordinary environments.
- Filesystem/cache inspection proving no raw or derivative plaintext residue.
- Zero-egress traffic capture and process-death/startup-scavenge evidence.
- Timeout, force-stop, background, memory-pressure, and account-switch drills.
- VoiceOver, Dynamic Type, Reduce Motion, and fail-safe UX evidence.
- Real-device latency, memory, energy, and thermal thresholds.
- Current human-simulated E2E evidence bound to the exact source and build.
