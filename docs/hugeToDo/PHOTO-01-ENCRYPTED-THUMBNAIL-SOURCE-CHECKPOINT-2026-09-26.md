# PHOTO-01 encrypted-thumbnail source checkpoint — 2026-09-26

## Status

This is a bounded **source checkpoint**, not PHOTO-01 completion or release
evidence. PHOTO-01 remains open behind its governed prerequisites and still
needs signed-build, supported-iPhone, interruption, filesystem/cache, memory,
accessibility, performance, account-boundary, withdrawal, and human-simulated
E2E proof.

## Closed source gap

New plaintext camera captures now create two local-only encrypted renditions
before the camera source can be deleted:

- an original rendition; and
- a 320 px JPEG timeline thumbnail.

The thumbnail pipeline reserves a durable content-free plaintext-staging journal
entry before invoking the native image manipulator. It accepts only a canonical
JPEG child of the package's `ImageManipulator` cache, moves that output into the
reserved owned path, marks plaintext written, encrypts it, and requires
plaintext cleanup before returning. If direct cleanup fails, the pipeline runs
the durable recovery pass synchronously; it returns only after that pass proves
cleanup, otherwise encrypted cleanup must also succeed and the operation fails
closed.

Each new rendition has a distinct final path and a versioned XChaCha20-Poly1305
envelope. The photo ID, nullable capture-session ID, rendition kind, MIME type,
envelope version, and key ID are authenticated as AEAD associated data, so
tampering with publication identity makes decryption fail. New envelopes use an
exact-key parser and consumers provide the expected photo ID, capture-session
ID, rendition, and canonical owned direct-child path. Suffix-only, remote,
outside-directory, renamed, and swapped envelopes are rejected. Legacy envelope
reading remains an explicit compatibility lane and cannot authorize filesystem
mutation outside the owned photo directory.

One encrypted metadata publication binds the original URI, thumbnail URI,
photo ID, capture-session ID, capture metadata, and notes. Metadata is committed
before raw-source deletion. A durable content-free publication journal is
created before either final is adopted and records original adoption, pair
adoption, metadata commit, raw cleanup, and settlement under the exact account
and consent generation. Recovery removes uncommitted finals, preserves a valid
committed pair, finishes committed raw cleanup, and refuses corrupt or foreign-
authority journal state rather than guessing. Delete, reset, orphan reconciliation,
account cleanup, consent withdrawal, and path-free data export already cover
both rendition paths. Timeline cells prefer the thumbnail; detail, compare,
share, and time-lapse retain the original.

No thumbnail or photo publication code gains network, cloud, analytics, face
analysis, or fabricated progress-analysis capability.

## Automated evidence

- Aggregate source contract: `node --test scripts/photo01/photo01-source-contract.test.mjs`
- Focused mobile tests:
  `npm --workspace apps/mobile exec vitest run src/features/photos/photoThumbnail.test.ts src/features/photos/encryptedStorage.test.ts src/features/photos/store.test.ts`
- Mobile typecheck, lint, and the full mobile test suite remain required before
  this checkpoint is integrated.

## Gates that source cannot close

- Xcode compilation and signed archive inspection.
- Supported physical-iPhone capture, force-stop at every publication boundary,
  storage-pressure and key-loss behavior.
- Filesystem and cache inspection proving no plaintext raw or thumbnail residue.
- Memory inspection and background/lock/account-switch purge evidence.
- VoiceOver, Dynamic Type, Reduce Motion, and real timeline scrolling evidence.
- Real-device thumbnail latency, memory, energy, and large-library thresholds.
- Final privacy/counsel classification and App Privacy answers.
- Apple App Review of the exact submitted build.
