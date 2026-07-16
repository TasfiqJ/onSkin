# IOS-02 Widget Lifecycle Source Checkpoint

Date: 2026-07-16

Status: `in_progress` source preflight. Production extension generation,
interactive publication, and Live Activity start remain disabled.

## Decision

The checked-in JavaScript/TypeScript slice is useful only as fail-closed,
unmounted scaffolding. It does not satisfy the production interaction or Live
Activity lifecycle gates. OnSkin must not enable either path until a native
cross-process persistence primitive, unconditional privacy cleanup, a
deterministic stale/end implementation, signed-archive inspection, and the
physical-iPhone matrix all pass.

This is an engineering decision, not Apple approval, legal clearance, or a
claim that App Review will accept the eventual binary.

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
- Expo SDK 56 documents that widget code runs in an isolated runtime, an
  interactive `onPress` return value becomes new widget props, app interaction
  listeners fire only while the app process is alive, `updateSnapshot` creates
  a one-entry timeline, `getTimeline` returns past and future entries, and Live
  Activities may be recovered with `getInstances`. See
  [Expo Widgets SDK 56](https://docs.expo.dev/versions/v56.0.0/sdk/widgets/).

## Reviewed Dependency Snapshot

The source contract pins `expo-widgets` `56.0.23` and `@expo/ui` `56.0.22` by
package range, exact lockfile version, registry URL, and integrity. The
following installed `expo-widgets` files were inspected at that lock:

| Installed source                | SHA-256                                                            | Relevant observation                                                                                          |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `ios/Widgets/AppIntent.swift`   | `f9c61057350a4f42cba5d90642688ea1abe182fec6c503702238d48e828f5fbd` | Reads the shared timeline, evaluates the widget handler, then replaces the whole timeline value.              |
| `ios/WidgetObject.swift`        | `3bbbc29258eaa549d2074e17664f3804511053b9cb5396761c960b3cb5ee9d4e` | App-side timeline publication also replaces the whole timeline value.                                         |
| `ios/WidgetsEvents.swift`       | `62e4229c1c6cfae5149007a61b5d3514205d7a59366b1be1d1612aa2e85c5194` | Interaction notification uses process-local `NotificationCenter`; it is not a durable extension-to-app queue. |
| `ios/LiveActivityFactory.swift` | `b1bf7c1d8a4b1ec8932df6caa9e05a264ae99f21954284be42f3bb113b6915fb` | Initial ActivityKit content passes `staleDate: nil`.                                                          |
| `ios/LiveActivity.swift`        | `ad5a9c4665074b186ba00e4d6f43fe23c494401fb2e23d9e9032f0d06a803be7` | Update and end content also pass `staleDate: nil`.                                                            |

The hashes bind these findings to the installed reviewed artifact. Any
dependency update invalidates the finding and requires a new inspection.

## Race Analysis

With stock whole-value reads and replacements, a JavaScript-only reconciliation
loop cannot close both cross-process races:

1. The App Intent reads timeline A; the app publishes timeline B; the intent
   later writes its A-derived result and resurrects obsolete shared state.
2. The app reads timeline A; the intent publishes a pending capability; the app
   later replaces the timeline from A and loses the pending capability before
   canonical completion.

Retries, delayed rereads, or a multi-entry registry reduce some failure windows
but do not create compare-and-swap or append-only semantics. Consequently:

- `ROUTINE_WIDGET_INTERACTIVE_PUBLICATION_ENABLED` remains a literal `false`.
- `phase7Capabilities.nativeWidgets` remains a literal `false`.
- production config rejects `IOS_WIDGET_EXTENSION_BUILD_ENABLED=true`.
- stock Expo Live Activity start remains prohibited in production.

## Implemented Safe Slice

- `runtimeGate.ts` requires the exact boolean extension opt-in, iOS, and a
  non-production environment. This is defense in depth; OTA-readable Expo
  config is not the sole production boundary.
- `controllerCore.ts` is native-library-independent and unmounted. It strictly
  normalizes bounded timelines, deduplicates tokens, resolves every group
  before the first canonical write, writes only resolved current actions,
  requires exact acknowledgement before synchronous replacement, serializes
  callers, and invalidates stale generations.
- Unknown, stale, and expired capabilities never create canonical completions.
  Any completion or acknowledgement failure prevents replacement.
- The Phase 5 verifier and QA packet hash the implementation and tests and
  require separate archive, device, interaction/privacy, and Live Activity
  evidence flags. Those booleans are summaries only: strict completion also
  requires a schema-v2 evidence JSON bound to current HEAD, exact EAS build,
  final app/extension/App Group/Team IDs, physical iPhone/iOS, and named signoff.
  Three ZIP-magic raw signed artifacts, four canonical parsed entitlement/privacy
  reports, four canonical scenario reports, and typed scenario proofs are all
  SHA-256 checked. Every report repeats the source/build/identity/raw-artifact
  binding, device reports repeat the exact physical-device tuple, and duplicate
  paths or bytes are rejected. Strict packet generation also rejects unrelated
  dirty source instead of merely warning.

## Remaining Enablement Gates

1. Implement and review a native append-only App Group action outbox, or an
   equivalent versioned compare-and-swap protocol, that the App Intent commits
   before returning.
2. Bind token preparation and every interactive publication call site to the
   hard-disabled capability gate until that primitive passes.
3. Mount a generation-bound host that reconciles before publication and has an
   unconditional redaction/deletion lane for malformed or oversized bytes,
   expiry, health-consent withdrawal, sign-out, account transition, and
   deletion.
4. Replace the `staleDate: nil` Live Activity path with a deterministic stale
   deadline and explicit recovery/end behavior that works after process death.
5. Regenerate the exact deep-link allowlist after final brand and bundle
   identity clearance.
6. On macOS, inspect the signed `.app` and `.appex`, entitlements, App Group,
   extension privacy manifest, deployment target, and capabilities.
7. On supported physical iPhones, pass all declared widget families, concurrent
   and repeated interactions, warm/cold/killed deep links, lock-screen privacy,
   stale/end/restart behavior, accessibility, corrupt-state recovery, and every
   withdrawal/account-cleanup transition.

Until all seven gates have artifact-bound evidence, IOS-02 remains
`in_progress` and feature 19 remains launch-blocked.
