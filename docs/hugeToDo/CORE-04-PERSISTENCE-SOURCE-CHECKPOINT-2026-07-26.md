# CORE-04 Routine Persistence Source Checkpoint - 2026-07-26

## Status

`CORE-04` is `in_progress`. The current source candidate has bounded local
persistence controls for AM/PM application order and authored Custom cycles.
This checkpoint does not mark CORE-04 complete and does not prove native
relaunch, process-death recovery, offline behavior, DST/timezone behavior,
cross-device sync, professional approval of cadence, an archive-identical
build, App Store acceptance, or launch readiness.

`CORE-03` remains an upstream dependency. Persistence can retain user intent,
but it cannot publish sequencing, cadence, recovery, or stop/refer authority
that CORE-03 has not independently admitted.

## Bound Persistence Records

The source contract covers exactly two current private-KV keys. New native
writes target an XChaCha20-Poly1305 envelope whose content key targets
SecureStore:

- `layerwell.routineOrder.v1` stores separate schema-versioned AM and PM
  arrays of stable shelf-product IDs.
- `layerwell.cycle.v2` stores one schema-versioned cycle configuration,
  including the complete schema-versioned Custom-cycle definition.

Legacy plaintext-compatible private-KV reads and native content-key migration
paths still exist for upgrades, so this checkpoint does not claim every
historical byte is already encrypted. Legacy `layerwell.cycle.v1` remains a
migration and export-compatibility input and is not the current cycle authority
once v2 exists. Routine-order legacy values without a schema can be normalized
in memory, while malformed current v1 and future-version records fail closed
without repair writes. Current cycle v1 requires the complete exact field set;
partial and unknown-field records remain preserved and fail closed.

## In-Process Serialization and Failure Preservation

Both records use `updatePrivateItem`, whose synchronous transform runs inside
the account-generation boundary, health-purpose lease, and serialized per-key
mutation slot. The transform receives the latest decrypted value and requests
one encrypted replacement or removal. This is one in-process serialized
read-transform-write, not a claim of crash-atomic or fsync-durable storage.

The routine-order transform decodes the latest current value and merges only
the AM or PM phase changed relative to the editor's prior snapshot. Independent
concurrent AM and PM edits therefore do not erase one another. The cycle
mutation path performs no preliminary reconciliation write: it parses legacy
input only when v2 is absent, applies reconciliation and the requested mutation
inside the same current-key transform, and emits one complete configuration.
Malformed, unsupported-version, read-failed, authority-stale, or write-failed
state is not treated as an empty preference and is not reported as a successful
save.

The private-KV wrapper models reject-before-commit and commit-then-reject
outcomes. While it still owns the serialized slot, it reads back the raw value,
restores the exact prior raw bytes or absence when the attempted value landed,
and verifies the restoration. Unknown/conflicting bytes or an unverifiable
rollback fail closed with `PRIVATE_KV_WRITE_ROLLBACK_FAILED`; they are never
described as a confirmed prior value. These are deterministic mock/source
controls, not proof of iOS behavior during process death, storage pressure, or
power loss.

The source and focused tests bind these properties:

- concurrent same-key transforms serialize;
- independent concurrent AM and PM order edits merge against the latest value;
- failed private reads block fallback rewrites;
- malformed and future routine-order values stay byte-preserved;
- incomplete, malformed, future, and unknown cycle schemas stay preserved;
- modeled pre-commit and commit-then-reject failures either verify exact prior
  restoration or surface a distinct rollback failure; and
- a complete Custom-cycle definition and its staged-product choices share one
  in-process complete-record transform and write request.

## Publication Ordering

The routine editor awaits the private-KV write before publishing React Query
cache state, emitting success analytics, haptic success, or leaving the route.
Its failure path stays in the editor and says that the save could not be
confirmed; it does not promise that an ambiguous storage failure left prior
bytes unchanged.

Cycle mutations likewise await the storage operation, publish only the returned
committed configuration to the date-scoped cache, and invoke success analytics
after cache publication. This is a source-order contract, not native
process-death evidence.

## Stable Identity and Reconciliation

Routine ordering and Custom cycles persist stable shelf-product IDs, not product
names or array positions:

- duplicate or renamed display names do not change saved identity;
- removed or replenished unit IDs are pruned only through explicit
  reconciliation/save;
- temporarily excluded routine-order IDs can retain their relative intent;
- a Custom cycle stores one `productId` or recovery (`null`) per night; and
- switching to a preset does not delete the saved Custom definition.

Application-order overrides are applied only to the already-generated AM and PM
arrays. They cannot move a product between phases, modify `plan.cycle`, create a
cycle night, restore an excluded product to the canonical plan, or manufacture
cadence authority.

## Cadence-Authority Isolation

Routine-order persistence is a preference layer and imports no cadence review
gate. It receives the canonical plan after generation and returns only reordered
AM and PM arrays.

Custom-cycle persistence remains different: every save flows through the cycle
mutation boundary, which requires admitted cadence before any storage, cache,
or success-analytics effect. Recovery-changing operations additionally require
the separate recovery/stop-refer authority. Closed recovery publication
preserves stored recovery bytes while exposing neutral runtime state.

These boundaries prevent a durable preference from becoming clinical
publication authority.

## Cleanup and Current-Device Export

Both current keys are registered in the local private-data cleanup inventory.
Account cleanup therefore removes them through the same encrypted-data boundary
as other local health-purpose records.

Both are also registered in the purpose-limited current-device export:

- `routine_order_overrides` contains the versioned AM/PM ID preference; and
- `cycle_configuration` contains the authoritative v2 configuration, including
  Custom-cycle intent.

The retained legacy cycle value is separately labeled
`legacy_cycle_configuration`. Export registration does not imply cross-device
sync or cloud backup.

## Mandatory Source Contract

`scripts/core04/persistence-source-contract.test.mjs` is a blocking command in
both `phase3:verify` and `launch:verify`. It checks bounded structural markers,
loader and publication ordering, named executable-test coverage, and
verification wiring for:

1. guarded serialized private transforms and ambiguous-write rollback;
2. malformed/future/failure preservation;
3. independent AM/PM merge behavior and one-transform cycle mutations;
4. cache, analytics, and navigation ordering;
5. loader wiring and schema-version decoding;
6. stable product identity;
7. cleanup and export registration;
8. cadence-authority isolation;
9. named Node/Vitest timezone cases; and
10. mandatory verification wiring.

The focused mobile store, route, reconciliation, cleanup, and export tests
remain the executable behavior evidence. Passing them proves only the inspected
source and test environment; the structural contract is not runtime,
process-death, native-Keychain, or durability proof.

## Exact-source development E2E evidence

The retained
[`CORE-04 persistence development E2E report`](../../test-results/human-e2e/2026-07-26/core04-persistence-current/report.md)
binds an Expo-web browser run to source revision
`b4560797b52e6910c17b03d8f66c6ef53c20900d`. At reported CSS viewports
`390 x 845` and `360 x 641`, it exercised AM failure copy, retry, reload,
AM/PM independence, both cancel paths, an eight-night Custom-cycle save and
reload, and downstream Today projection. The compact routes reported no
horizontal overflow and the browser log contained no console errors.

That run reused same-origin anonymous-owner development data established by an
earlier same-day onboarding run. It is not a clean-install result and is not
native iOS, storage durability, process-death, offline, timezone, accessibility,
archive, privacy, export-compliance, legal, App Review, or market evidence.

## Primary-Source Boundaries

The checkpoint uses these current primary sources to bound, rather than
inflate, its claims:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  require appropriate data security and accurate privacy handling; review of
  this source tree cannot predict App Review acceptance.
- [Apple keychain accessibility](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility)
  distinguishes migratable and this-device-only classes. The current private-KV
  content-key calls do not yet set a reviewed `ThisDeviceOnly` class.
- [Apple iCloud backup guidance](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup)
  makes archive and backup/restore inspection necessary before any no-backup or
  device-only promise.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
  documents persistence and platform behavior, while
  [AsyncStorage `setItem`](https://react-native-async-storage.github.io/2.0/API/#setitem)
  documents a rejecting promise but does not make rejection evidence that no
  bytes committed.
- [Node `TZ`](https://nodejs.org/api/cli.html#tz) bounds the new Toronto, Los
  Angeles, and UTC cases to Node/Vitest. They do not establish Hermes/iOS,
  suspended-app, or live travel-zone behavior.
- [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
  require the exact app and third-party behavior to match the submitted label.
- [Apple export-compliance guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance)
  remains a separate production gate for the app-layer XChaCha implementation.

## Remaining Acceptance Gates

CORE-04 cannot become `complete` until the accepted revision has retained
evidence for all of the following:

- CORE-03 is complete and the exact production guidance/cadence corpus is
  professionally and legally admitted;
- supported physical-iPhone and archive-identical encrypted-storage relaunch,
  force-quit/process-death, background, low-storage, commit-ambiguous,
  rollback-failure, and write-failure flows;
- offline edits and recovery without stale cache, analytics, or navigation
  success;
- supported timezone and DST transitions without changing authored identity or
  double-applying cycle reconciliation, including foreground, suspended-app,
  force-quit, pause/recovery, and live travel-zone changes;
- current-owner, account-switch, health-consent withdrawal, account deletion,
  cleanup retry, and purpose-limited export behavior on native storage;
- current-source Save, Cancel, retry, preset/Custom round-trip, AM/PM
  independence, removed/replenished identity, and downstream Plan/Today/Week
  agreement;
- Dynamic Type, VoiceOver, safe-area, and pending-exit behavior on supported
  devices; and
- upgrade migration and byte-level inspection proving historical private
  records and content keys do not remain in plaintext-compatible storage;
- a reviewed Keychain accessibility/backup policy plus exact-archive
  backup/restore/reinstall/key-loss evidence;
- exact-archive privacy-manifest, required-reason API, third-party SDK, network
  activity, App Privacy label, and export-compliance review; and
- privacy/security review and App Store review of the submitted binary and
  metadata.

Cross-device routine synchronization remains deferred under
`B-ROUTINE-PERSIST`. No source contract can guarantee legal compliance, Apple
acceptance, product-market fit, or revenue.
