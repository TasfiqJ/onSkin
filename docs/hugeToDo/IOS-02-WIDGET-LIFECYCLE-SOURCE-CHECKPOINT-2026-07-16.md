# IOS-02 Widget Lifecycle Source Checkpoint

Date: 2026-07-16
Updated: 2026-08-08 for Expo SDK 57 and `expo-widgets` 57.0.8

Status: `in_progress` native source candidate. The RoutineKind lifecycle is
implemented and statically/model-tested in source, but interactive publication
and Live Activity start remain disabled by signed configuration. Feature 19
remains launch-blocked.

## Decision

The checked-in source now closes the previously identified JavaScript-only
cross-process race with a RoutineKind-specific App Group SQLite authority,
rotating compare-and-swap nonces, a durable action outbox, deterministic stale
state, a lock-held lease-close quiescence handoff, and an unconditional native
privacy kill lane. The quiescence handoff uses the same cross-process lock as
App Intent append, durably denies new admission, and captures the exact final
outbox before releasing the lock. A separate receipt-bound reconciliation can
commit a nonempty captured outbox once before converting the receipt to the
ordinary closed sentinel; an empty capture converts the receipt under the same
lock before quiescence returns. The source also contains the typed bridge,
owner-generation coordinator, host slot, and boundary-first cleanup call sites
needed to integrate that authority with app lifecycle and account boundaries.

This is not release evidence. The current generated-Info.plist source keeps
`RoutineKindWidgetInteractivePublicationEnabled` and
`RoutineKindLiveActivityStartEnabled` literal `false`; no signed artifact exists
yet. No Xcode or Swift compiler is available in the Windows workspace, so the
local result does not prove that the patched Swift compiles, that an extension
is generated or signed, or that an archive contains the expected entitlements,
privacy manifest, capabilities, or binary linkage. It also does not prove
physical-iPhone behavior, legal or privacy compliance, Apple approval, App
Review acceptance, or revenue.

## Official Platform Findings

- Apple says widget code runs in a process separate from the app. A button or
  toggle invokes an App Intent, and work needed by the reloaded timeline must
  finish before `perform()` returns. Apple's example sequence persists the
  canonical change in a database before the timeline reflects it. See
  [Adding interactivity to widgets and Live Activities](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities).
- Apple describes App Groups as shared containers and interprocess
  communication between an app and its extension. Sharing a container does not
  itself provide this product's required transaction semantics. See
  [Configuring app groups](https://developer.apple.com/documentation/xcode/configuring-app-groups/).
- Apple defines `staleDate` as the time when a Live Activity becomes out of
  date; at that time its activity state becomes stale. See
  [`ActivityContent.staleDate`](https://developer.apple.com/documentation/activitykit/activitycontent/staledate).
- Apple documents `Task` initialization as an asynchronous unstructured task
  and says discarding the task reference does not cancel it. ActivityKit's
  `end(_:dismissalPolicy:)` is itself asynchronous, and Apple says final content
  matters because an ended activity can remain visible until removal. See
  [`Task.init(priority:operation:)`](https://developer.apple.com/documentation/swift/task/init%28name%3Apriority%3Aoperation%3A%29-2dll5) and
  [`Activity.end(_:dismissalPolicy:)`](https://developer.apple.com/documentation/activitykit/activity/end%28_%3Adismissalpolicy%3A%29).
- Expo SDK 57 documents that widget code runs in an isolated runtime, an
  interactive `onPress` return value becomes new widget props, app interaction
  listeners fire only while the app process is alive, `updateSnapshot` creates
  a one-entry timeline, `getTimeline` returns past and future entries, and Live
  Activities may be recovered with `getInstances`. See
  [Expo Widgets SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/).

## Reviewed Dependency And Patch Boundary

The source contract pins `expo-widgets` exactly to `57.0.8`, including the
workspace dependency, lockfile version, registry URL, integrity, and installed
package identity. The deterministic installer in
`scripts/phase5/patch-expo-widgets-lifecycle.mjs` pins both the reviewed
upstream hash and patched hash for ten replaced native files plus one new
RoutineKind lifecycle store. It validates every payload and target before
staging, installs each reviewed file with a durable per-file rename and
rollback path, accepts a reviewed mixed state so an interrupted run can safely
finish, rejects unknown drift, supports non-writing check mode, and is run by
both the root postinstall and the EAS post-install check. The eleven renames are
not one package-wide atomic transaction; the mandatory follow-up hash check is
the build gate after any interrupted install.

The following hashes are the reviewed **upstream** bytes that established the
stock-library gaps. They are retained as installer input pins; they are not a
claim that the patched payload still has the stock behavior.

| Upstream source file            | Original SHA-256                                                   | Stock behavior that required replacement                                |
| ------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `ios/Widgets/AppIntent.swift`   | `f9c61057350a4f42cba5d90642688ea1abe182fec6c503702238d48e828f5fbd` | Whole-timeline read/replace could overwrite concurrent app publication. |
| `ios/WidgetObject.swift`        | `3bbbc29258eaa549d2074e17664f3804511053b9cb5396761c960b3cb5ee9d4e` | App publication also replaced the whole shared timeline value.          |
| `ios/WidgetsEvents.swift`       | `62e4229c1c6cfae5149007a61b5d3514205d7a59366b1be1d1612aa2e85c5194` | Process-local notification was not a durable extension-to-app queue.    |
| `ios/LiveActivityFactory.swift` | `b1bf7c1d8a4b1ec8932df6caa9e05a264ae99f21954284be42f3bb113b6915fb` | Initial content used `staleDate: nil`.                                  |
| `ios/LiveActivity.swift`        | `ad5a9c4665074b186ba00e4d6f43fe23c494401fb2e23d9e9032f0d06a803be7` | Update and end content used `staleDate: nil`.                           |

Any dependency, installer, payload, or lockfile change invalidates the source
finding and requires a new hash review.

## Implemented Native Source Candidate

- **Single native authority.** RoutineKind timeline state lives in an App
  Group SQLite database. UserDefaults is not the RoutineKind transaction
  authority; it remains only for generic/derived presentation compatibility.
  Cross-process access uses a permanent coordination file with bounded
  nonblocking `flock`, SQLite `BEGIN IMMEDIATE`, full synchronous writes,
  rollback journaling, secure deletion, and file protection.
- **ABA-resistant ownership.** A private opaque owner generation is paired with
  a rotating opaque authority nonce. Activation, publication, outbox reads,
  reconciliation, and cleanup use exact authority receipts rather than a
  reusable account identifier or a JavaScript-only generation check.
- **Atomic App Intent path.** The RoutineKind App Intent validates the complete
  stored snapshot, exact owner generation, snapshot nonce, revision, date,
  phase, and expiry. The interaction outbox row and optimistic revision are
  persisted transactionally before `perform()` returns. RoutineKind does not
  depend on process-local notification delivery or a UserDefaults timeline
  replacement for canonical reconciliation.
- **Deterministic expiry and rendering.** Publication accepts exactly a current
  entry plus a future stale entry bound to the same owner generation and
  snapshot nonce. Timeline reads return the generic stale state after the
  deadline, and provider/view paths sanitize against the SQLite authority. The
  current personalized deadline is capped by the five-minute health-processing
  status lease and reserves 30 seconds for reconciliation, so a newly verified
  snapshot is personalized for at most about four and a half minutes and may be
  shorter if publication begins later in the lease. A reviewed, purpose-limited
  longer local-display authorization is still required before this can behave
  like a persistent personalized home-screen widget.
- **Exact ordinary and final reconciliation.** The app bridge uses bounded,
  exact-key JSON contracts. Ordinary reconciliation is revision- and
  authority-bound, accepts the complete outbox token set or redacts, removes
  acknowledged rows transactionally, and cannot partially bless a transplanted
  or stale capability set. At a planned health-lease close, native quiescence
  acquires the same `flock` used by App Intent, validates the exact owner and
  authority, persists a durable random quiescence receipt, and captures the
  exact final outbox before releasing the lock. The only post-quiescence commit
  must match that receipt, authority, owner, snapshot, revision, and complete
  token set; it revokes the one-shot receipt before releasing the lock. An empty
  captured outbox has no reconciliation to preserve, so native code overwrites
  its structured receipt with the generic closing sentinel under that same lock
  before returning. Every ordinary store operation remains denied while either
  quiescence or the closed sentinel exists.
- **Owner-bound app coordination.** The private action registry supports a
  bounded multi-snapshot format. The lifecycle coordinator serializes owner
  activation, Activity recovery, outbox reconciliation, release, and privacy
  cleanup. The checked-in host slot is generation-bound and withholds
  publication for unresolved, failed, unavailable, or example-derived plan and
  cycle input; confirmed Free state remains an explicit disabled transition.
  Native `outbox_pending` publication and the typed stale-Activity result are
  treated as bounded retryable concurrency, not as privacy corruption that may
  purge an accepted action. Exhausted attempts leave the native outbox durable
  for a later foreground refresh. While the signed capability remains false,
  production behavior is clear-only rather than publication.
- **Unconditional privacy kill lane.** Native cleanup does not consult the
  publication or Live Activity start flags and does not decode historical,
  malformed, or oversized payload bytes. It first durably verifies the
  `privacy-closing-v1` sentinel and returns a closed-admission receipt, then the
  queued full purge rotates a closed authority tombstone, removes
  snapshots/outbox and derived presentation, reloads widget timelines, and
  ends/redacts every activity using the shared
  `LiveActivityAttributes` type, including legacy non-RoutineKind aliases that
  could otherwise retain old content. Source call sites cover health
  consent withdrawal, full local-private cleanup/account deletion, forced
  sign-out, and foreign or unclaimed credential activity. Health withdrawal
  starts native closure immediately after exact-owner destructive authority is
  established and before JavaScript/private/photo writer drains. Auth account
  boundaries start native admission closure and encrypted action-capability
  deletion before a replacement owner may publish. Cleanup failures retain the
  minimum owner/quarantine proofs needed for safe retry.
- **Synchronous close admission, asynchronous ActivityKit dismissal.** Privacy
  reduction first durably creates and verifies the exact
  `privacy-closing-v1` RoutineKind sentinel, so its synchronous bridge
  closed-admission receipt proves that later store reads, writes, intents,
  publication, reconciliation, and activity mutation authorization are denied
  even if an older JavaScript FIFO operation never settles. Before
  returning, native code also schedules an independent immediate redaction/end
  task for every recovered `LiveActivityAttributes` activity. That receipt does
  **not** prove ActivityKit has completed dismissal: iOS can continue presenting
  the last content until the scheduled task runs. The queued full purge awaits
  the same end operation, and exact device tests must measure the residual
  display interval while the app is foregrounded, backgrounded, and terminating.
- **RoutineKind Live Activity lifecycle.** The named RoutineKind activity has a
  strict bounded decoder, a finite `staleDate`, owner-authorized update and
  recovery, explicit immediate end, and fail-safe cleanup after process death
  or restart. Start requires the exact signed `RoutineKindWidgetDeepLink` before
  `Activity.request`. Start and update reauthorize after the ActivityKit
  operation and request an immediate generic end if authority changed during
  the call. The typed post-start stale handler rereads current JS instances and
  awaits their immediate end requests before the bounded retry. Global
  push-to-start token observation/emission is removed because those tokens are
  not owner-bound or revocable; per-activity push remains signed `false` and
  authority-gated. The patched factory rejects every non-RoutineKind start, and
  update/token APIs reject nonexact or inactive instances. End and privacy
  cleanup remain permissive so legacy aliases can be redacted and asked to
  dismiss.
- **Signed-binary kill switches.** The app and generated extension Info.plists
  declare lifecycle version `1` while interactive publication and Live Activity
  start remain literal `false`. JavaScript/OTA configuration alone cannot
  enable the release feature.

The installer provenance suite, static Swift source contract, TypeScript
bridge/contract/model tests, coordinator/host tests, cleanup tests, extension
contract, and privacy-manifest tests are source evidence only. They cannot
substitute for compilation or an actual native surface pass.

The current WidgetKit provider/render read path also synchronously acquires the
exclusive process-shared `flock` and opens the SQLite database read-write. Its
bounded lock retry and SQLite busy timeout protect correctness but can consume
extension execution time under contention. Instruments measurements on the
oldest supported and current physical iPhones, including simultaneous App
Intent/publication/cleanup pressure, remain mandatory before enabling the
signed flags.

## Remaining Enablement Gates

1. Keep the literal signed publication and Live Activity start flags false.
   Review and implement a purpose-limited local-display authorization with a
   suitable lifetime, or explicitly accept a generic widget after the current
   roughly five-minute health-status lease; bind that decision to privacy/legal
   review and exact user-facing disclosure.
2. On macOS/Xcode, install from the exact lockfile, reapply/check the reviewed
   patch, compile the app and extension, and inspect the generated native
   project for the expected deployment target, SQLite linkage, privacy
   manifest, Info.plist lifecycle keys, and absence of unreviewed capabilities.
3. After IOS-01 final identity and Apple account work close, build and inspect a
   signed `.app`, `.appex`, and archive whose bundle IDs, Team ID, App Group,
   provisioning profiles, entitlements, signatures, privacy manifests, and
   signed enablement flags all match the reviewed source and evidence index.
4. Use Instruments and extension diagnostics on supported physical iPhones to
   measure synchronous provider/render `flock` wait, read-write SQLite open,
   schema/read work, memory, timeout, and contention behavior against
   predeclared budgets.
5. On supported physical iPhones, pass every declared widget family;
   concurrent, repeated, unknown, stale, and expired interaction behavior;
   warm/cold/killed deep links; locked-state privacy; corrupt/oversized-state
   recovery; expiry, withdrawal, sign-out, switch, and deletion cleanup; and
   VoiceOver/Dynamic Type checks.
6. Prove the RoutineKind Live Activity start/update/stale/complete/end path on
   the exact signed build across app termination, device restart, lock state,
   disablement, withdrawal, and account transitions. Measure the interval from
   native admission closure to actual ActivityKit presentation removal; neither
   a close-admission receipt nor a scheduled end task proves dismissal.
7. Regenerate the final-brand deep-link allowlist and complete the artifact-
   bound lifecycle packet with current source/build/identity/device hashes and
   named review. Obtain the required privacy, legal, security, and release
   reviews without representing them as guaranteed Apple acceptance.

Until those gates have genuine artifact-bound evidence, IOS-02 remains
`in_progress`; feature 19, `widgets`, and `live_activities` remain required and
launch-blocked.
