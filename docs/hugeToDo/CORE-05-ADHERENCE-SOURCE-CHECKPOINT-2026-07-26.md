# CORE-05 Today Adherence Source Checkpoint - 2026-07-26

## Status

`CORE-05` is `in_progress`. This checkpoint closes bounded local-source
integrity defects in Today check-off, adherence qualification, streak display,
failure recovery, future-date handling, and long-lived routine clocks. It does
not mark CORE-05 complete and does not prove server synchronization,
authoritative cross-device forgiveness, native storage durability, notification
delivery or OS-prompt behavior, analytics publication, legal approval, archive
identity, App Review acceptance, launch readiness, or revenue.

`CORE-04` remains an upstream dependency. The current local encrypted
persistence candidate is source- and development-web-tested, but its physical
iPhone, archive-identical, process-death, backup, account lifecycle, and legal
acceptance gates remain open.

## Step Check-off Versus Adherence

Step taps remain append-only and idempotent in the local private completion
record. They no longer automatically become an adherence day.

The current completion envelope is schema version 2 and contains:

- `days`: the exact phase-scoped `AM:<product-id>` and `PM:<product-id>` step
  keys durably checked on each local date; and
- `completedDays`: explicit dates on which every PM or recovery step in the
  exact Today projection supplied to the mutation was checked.

AM-only and partial-PM rows therefore remain visible step progress without
earning a displayed night, a forgiving streak day, a cycle-length milestone,
or the seven-day review moment. The mutation that first proves all projected PM
steps inserts the date marker in the same serialized private transform as the
final step. Concurrent final-step writers converge on one marker.

Legacy unversioned and v1 step logs remain readable, but they produce no
`completedDays`: the app cannot reconstruct what routine was scheduled when a
historical row was tapped, so it does not invent a full night. The next explicit
mutation writes a strict v2 envelope. Current v2 records require the exact field
set, canonical dates, canonical phase-scoped keys, no duplicates, and a PM row
for every completed-day marker. Malformed and future-version bytes fail closed
and are not repaired during a read.

This is a local source candidate, not authoritative server proof. The unpublished
interactive widget path does not yet supply the full scheduled-PM context and
therefore cannot create an adherence marker. Server routine/step UUID mapping,
the durable queue feeder, original `completed_at`, and a routine-level
completion row remain open under `B-ROUTINE-PERSIST`.

The progress client now unions only explicit server routine-level rows
(`step_id IS NULL`); raw server step rows cannot create a displayed night. It
also no longer trusts `profiles.longest_streak`, because the current server
cache is still computed by the older strict algorithm. This honest demotion
prevents known punitive/fake server state from overriding the local candidate,
but cross-device longest-streak authority remains unavailable until the server
migration and parity suite land.

## Fail-closed Completion UI

Unreadable or unsupported completion state now rejects instead of becoming an
empty set. Today displays a named unavailable/retry state and disables check-off
controls while the record is loading, unreadable, or another mutation is in
flight. Streak and Welcome Back likewise render an unavailable/loading surface
instead of guessing zero adherence or a lapsed streak.

Today now awaits the private mutation before success haptics, analytics,
milestone/review evaluation, or query invalidation. A rejected operation stays
on Today, shows calm retry copy, and emits no success haptic from the route.
The underlying private-KV layer has modeled commit-ambiguous rollback controls,
but this checkpoint still lacks a rendered integration test that proves zero
route-side success effects for every commit-then-reject and rollback-failure
case on native storage.

## Date and Routine-phase Integrity

The timezone-tolerance write window still accepts tomorrow where required by
the server contract, but tomorrow's row is filtered from current, best, lapse,
weekly, and heat-map calculations through today. A future-only set cannot turn
a new user into a lapsed user or inflate a personal best.

The shared routine clock refreshes long-lived screens at 17:00 and local
midnight. Foregrounding refreshes immediately, covering suspension and local
timezone changes; Today also refreshes its visible clock each minute. Today
therefore changes AM to PM at 17:00 and changes date-scoped completion keys at
midnight without requiring unrelated query activity. Node/Vitest boundary
tests exist, but physical-device DST, live travel, suspension, and clock-change
evidence remains open.

## Claim-bounded Milestones

Milestone copy now describes only completed routine-night counts. The previous
claims that a full cycle was complete, progress photos might show a result, or
the work was “paying off” were not supported by the generic streak counter and
were removed. The remaining cycle-threshold marker says only that a cycle's
worth of qualifying routine nights was checked off; it does not claim a
specific skin or photo outcome.

## Local-only notification consent and scheduling

The current notification source now fails closed around the bounded local
reminder surface:

- every notification purpose defaults off while 7:30 AM and 9:30 PM remain
  proposed values;
- the onboarding soft ask visibly names those exact times before an OS request,
  persists the exact values shown, and enables only AM and PM routine reminders;
- iOS authorization keeps not-determined, denied, authorized, provisional, and
  ephemeral states distinct, preserves whether another request is possible, and
  is rechecked before each scheduling path;
- settings refresh authorization on foreground, display stored purposes
  effectively off when delivery is unavailable, and expose a native Settings
  recovery path only where that handoff exists. Each authorization read
  reconciles native schedules, so revocation cancels them and a later explicit
  OS grant rebuilds only purposes whose stored choices remain enabled;
- routine reminder, trial reminder, and event-triggered schedule operations
  serialize with consent/health admission; no later schedule request can bypass
  the current authorization check;
- event-triggered suggestions atomically reserve capacity in the encrypted
  device ledger before native scheduling. A conservative reservation survives a
  native failure, so interruption cannot exceed the rolling seven-day device
  caps: three behavioural routine/replenishment attempts and one promotional
  attempt;
- the separately opted-in progress-photo reminder is described as weekly rather
  than as part of that event-triggered cap; and
- routine quiet-hours copy scopes itself to routine/optional reminders, names the
  checkout-date billing exception, and explicitly treats matching start/end
  values as off. It does not promise OS presentation.

The mobile client no longer reads or writes `notification_preferences` or
`notification_log`, and it produces no `notification_prompt_shown`,
`notification_prompt_granted`, or `notification_prompt_denied` events. Existing
database tables remain covered by withdrawal/export/residue controls, but are
not current collection authority. Remote synchronization, cross-device caps,
delivery/open measurement, and permission analytics remain closed pending
CAT-09 privacy, consent, retention, recipient, disclosure, and exact-build
review.

The retained development Expo-web observation shows the exact onboarding times,
skip behavior, all purposes effectively off when browser authorization is
unavailable, scoped quiet-hours copy, and the matching-time off state. It found
and fixed a web-only native-Settings handoff crash. The 1279 x 720 packet is not
compact, native, physical-iPhone, OS-permission, native-scheduling, or
archive-identical evidence.

## Mandatory Source Contract

`scripts/core05/adherence-source-contract.test.mjs` is a blocking command in
both `phase3:verify` and `launch:verify`. It binds:

1. strict schema-v2 decoding and non-inference from legacy rows;
2. full projected PM/recovery qualification and exactly-once day markers;
3. Today persistence-before-success ordering and unavailable/retry behavior;
4. future-row exclusion and live routine clock boundaries;
5. fail-closed Streak and Welcome Back routes;
6. outcome-neutral milestone copy;
7. exact-time, default-off, authorization-aware, local-only notification
   scheduling and atomic cap reservation;
8. completion-key cleanup and purpose-limited export registration; and
9. mandatory launch verification wiring.

Passing this structural contract and the focused Vitest suite proves only the
inspected source behavior in the test environment.

## Primary-source boundaries

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  require privacy practices and promotional-notification consent to match the
  app. They do not provide a pre-approval guarantee.
- [Apple notification guidance](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications)
  says authorization status can change and should be checked before scheduling.
  The bounded source now rechecks authorization and confirms proposed times.
  Native prompt, revocation, Settings-return, and delivery evidence remains an
  open CORE-05 gate.
- [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
  require disclosure of app and integrated-partner collection, linkage, and
  purposes. Local-only processing is treated differently from data sent off
  device; exact completion, streak, notification-log, and analytics flows must
  be mapped against the submitted build.
- [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
  treats express and implied objective health claims as requiring adequate
  prior substantiation. Removing unsupported outcome copy is a control, not a
  legal conclusion.
- [FTC consumer-health-information guidance](https://www.ftc.gov/business-guidance/resources/collecting-using-or-sharing-consumer-health-information-look-hipaa-ftc-act-health-breach)
  calls for truthful, prominent explanations of health-information practices.
- [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
  explains that covered unauthorized acquisitions can include unauthorized
  disclosures, not only intrusions. Applicability, safeguards, and a response
  runbook require counsel and organizational ownership.

## Remaining acceptance gates

CORE-05 cannot become `complete` until the accepted revision has retained
evidence for all of the following:

- a stable server routine/step identity bridge, durable queue feeder, original
  completion timestamp, offline kill/relaunch, 48-hour replay, 23505 replay,
  transient retry, remote-commit/client-throw retry, and cross-device continuity;
- a new authoritative server streak implementation that consumes only
  qualifying routine-level completions, auto-applies at most two free freezes,
  prevents client-fabricated freezes, recomputes on relevant insert/delete, and
  matches client fixtures across timezone/DST cases;
- replacement of the strict server cached streak fields with the reviewed
  parity implementation before the client trusts them again;
- neutral pre-activation weekly states instead of labeling days before the
  user's first eligible routine as missed;
- rendered/native tests for rapid taps, malformed/unavailable storage,
  commit-before-reject ambiguity, rollback failure, consent/account changes
  during writes, success invalidation, reload, and direct-entry loading/error/
  new/grace/lapsed Welcome Back states;
- supported-iPhone evidence for the exact-time soft ask, fresh grant, denial,
  provisional/ephemeral where available, Settings revocation/return, every
  schedule class, cancellation/opt-out, quiet-hour/DST/timezone/relaunch
  behavior, concurrent cap admission, process interruption after reservation,
  and the native scheduled-notification inventory;
- approved health-consent and privacy text covering completion history,
  adherence derivation, current device-local notification data, any future
  remote preference/log mirror, recipients, retention, deletion, withdrawal,
  and analytics;
- field-level exact-build App Privacy mapping and counsel determination for
  applicable privacy, consumer-health, breach-notification, and promotional
  communication requirements;
- production analytics transport, consent, payload, linkage, processor, and
  retention proof before analytics acceptance can pass; and
- supported physical-iPhone, Dynamic Type, VoiceOver, process-death, offline,
  foreground, DST/timezone, archive-identical privacy/network, and App Review
  evidence.

No source or test contract can guarantee Apple acceptance, legal compliance,
product-market fit, or revenue.
