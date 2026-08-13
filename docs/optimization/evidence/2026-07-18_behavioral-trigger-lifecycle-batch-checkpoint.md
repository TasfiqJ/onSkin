# Behavioral Trigger Lifecycle-Batch Checkpoint

Date: 2026-07-18 (America/Toronto)

Branch: `optimization`

Checkpoint parent: `311724c20d24fc89657ecd5b7cc975200e0d8f19`

Item: `OPT-109`

## Outcome

`OPT-109` is locally implemented. The enabled behavioral-notification path no
longer mounts Shelf, Ramp, or Progress query observers for the lifetime of the
app. A relevant background transition now opens one owner-generation operation,
dynamically imports the local evaluator, reads only the enabled private domains
in one shared batch, derives three content-free booleans, and attempts at most
one priority notification.

The lightweight notification-preference query remains the first gate. If all
three behavioral preferences are disabled, `BehaviouralTriggers` returns before
mounting `EnabledBehaviouralTriggers`, so it registers no AppState listener and
performs no Shelf, Ramp, completion, or snapshot-module work.

## Lifecycle And Privacy Contract

- Only the `background` AppState transition starts evaluation; `active` does
  not read private domains.
- Replenishment and Ramp share one exact local Shelf read.
- Ramp and completion history are read only when their categories are enabled.
- The three independent local sources begin together in one `Promise.all` batch.
- Every non-cancellable read is contained by the captured account-generation
  lease; a late account-A result cannot publish or send for account B.
- An unavailable, corrupt, unsupported, or stale-owner source rejects the whole
  optional evaluation. The path does not repair private bytes or reinterpret
  unreadable state as an empty successful snapshot.
- The snapshot contains only `promotional`, `ramp`, and `replenishment`
  booleans. No product, account, completion, route, or free-text value crosses
  the evaluator boundary.
- Priority remains replenishment, then ramp step-up, then promotional win-back.
  The existing per-generation single-flight coordinator and 60-second cooldown
  prevent duplicate lifecycle sends.

## Deferred Module Boundary

A production Expo web export completed with 83 routes and 12 emitted web
JavaScript bundles. The behavioral evaluator is a distinct deferred bundle:

```text
behaviouralSnapshot-d380627f46f5ab3f91eea2330d94d239.js  1,646 bytes
```

The root behavioral component contains no static Shelf, Ramp, Progress, or
snapshot-runtime import. This web artifact establishes the requested source and
bundler boundary; it is not treated as native Hermes startup, memory, or
execution-time evidence.

Machine-readable measurements are recorded in
`docs/optimization/reports/2026-07-18_behavioral-trigger-module-report.json`.

## Deterministic Verification

```text
npm.cmd --workspace apps/mobile test -- [behavioral notification matrix]
5 files / 60 tests PASS

npm.cmd --workspace apps/mobile test -- [lifecycle/source contract matrix]
5 files / 28 tests PASS

npm.cmd test
331 files / 3,974 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings

npx.cmd expo export --platform web --output-dir [checkpoint artifact directory]
83 routes / 12 web bundles PASS
```

The executable coverage proves the preference matrix, disabled zero-work path,
active-transition zero-read path, one background batch, exact one-read sharing,
one-send priority, single-flight/cooldown behavior, raw Shelf replenishment
equivalence, inactive-Ramp exclusion, and account-A late-result containment.

## Remaining Proof

- Supported-iOS disabled-preference trace showing zero AppState/domain work.
- Supported-iOS enabled trace showing one batch per accepted lifecycle event.
- Cold, warm, resume, memory, and energy distributions from signed builds.
- Permission denied/granted, DST, time-zone, reboot, update, notification tap,
  and actual local-delivery scenarios on a physical supported device.
- Native store-build confirmation that the deferred source boundary produces the
  intended Hermes startup and memory behavior.

No native latency, memory, energy, delivery, or startup claim is inferred from
the production web export or deterministic source tests.
