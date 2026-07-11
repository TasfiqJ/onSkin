# Cycle Disruption And Reconciliation Human E2E

- Local test date: 2026-07-10 (America/Toronto; capture continued after 00:00 UTC)
- Surface: Expo web development build in the Codex in-app browser
- Viewports: 360 x 640 support floor and 390 x 844 modern phone
- Fixtures: Pro entitlement, open cadence-review gate, and one-shot cycle-config write failure
- Result: PASS for the local-first web contract

The run used the real Pro scheduler, Plan, Today, and tolerance surfaces with an
existing local shelf and profile. Failed cycle writes stayed on the source route,
showed one inline alert, opened no dialog, preserved the previous projection,
and succeeded on retry. Pending actions disabled the sheet backdrop and every
competing control. Pause survived a reload, exposed `Resume my routine`, and
returned to the normal Today projection immediately after resume.

Procedure recovery failed safely once, retried into day 1 of 7, and finished
early without leaving stale recovery state after reload. Gentle variant selection
failed safely, retried, and remained selected after reload. Start Today failed
inline, retried, and updated Today to cycling night 1 without a stale query-cache
frame. Irritation recovery failed before ramp cadence changed, then retried into
the irritation-specific recovery surface.

At 390 x 844, measured route controls were 48-112 px tall with zero horizontal
overflow. At 360 x 640, all four disruption choices were initially visible at
about 78 px tall. The added 96 px failure alert extended below the initial sheet
viewport but became fully visible through the sheet's intended 76 px scroll
range; retry remained reachable. Browser diagnostics contain only expected local
Supabase placeholder and Expo web notification warnings. The unexpected-log file
is empty and no JavaScript dialog opened.

The first human pass found the AM Today preview still describing a running cycle
while paused. The fix now renders `Tonight · Paused`, explains that the cycle
resumes when ready, and opens cycle management directly. An independent review
then found and closed reverse-order legacy overlap, irritation partial-save,
Start Today cache, in-flight query, local-day rollover, and pending-dismissal
risks before the final rerun.

## Flows Executed

| Flow | Branch | Result | Evidence |
| ---- | ------ | ------ | -------- |
| Disruption | Failed pause, retry, reload, resume | Pass | `02-*`, `03-*`, `04-*`, `13-*` |
| Procedure | Failed recovery start, retry, early finish, reload | Pass | `05-*`, `06-*`, `07-*` |
| Cycle settings | Failed variant save, retry, reload | Pass | `08-*`, `09-*` |
| Support floor | Failure scroll reachability and paused resume action | Pass | `10-*`, `11-*` |
| Today | Paused copy, direct management, immediate resumed projection | Pass after fix | `12-*` |
| Plan | Failed Start Today, retry, immediate night-one projection | Pass | `14-*`, `15-*` |
| Tolerance | Failed irritation recovery, retry, recovery handoff | Pass | `16-*`, `17-*` |

## Bugs Found And Fixed

- `docs/e2e-bug-reports/2026-07-10-today-am-paused-cycle-preview.md`
- Reverse-order legacy suspension overlap now preserves the newer dated state.
- Irritation recovery now writes recovery first and repeated retries are idempotent.
- Start Today now uses the query-aware mutation path with inline failure recovery.
- Cycle mutations cancel older reads; local-day query keys refresh at midnight and foreground.
- Pending sheets and active recovery Back controls can no longer dismiss in-flight writes.

## Automated Coverage

- `apps/mobile/src/features/scheduler/cycleStore.test.ts`
- `apps/mobile/src/features/scheduler/cycleWeekRoute.test.ts`
- `apps/mobile/src/features/routine/rampStore.test.ts`
- `apps/mobile/src/features/routine/generate.test.ts`
- `apps/mobile/src/features/subscription/proGatedRoutes.test.ts`

Focused verification passed 5 files and 76 tests. Mobile TypeScript and lint also
passed before the final live rerun. Repository-wide verification is recorded by
the source commit and launch packets generated after this evidence is registered.

## Evidence Notes

- Screenshots are present for initial disruption, failed pause, failed procedure,
  active and completed recovery, failed and persisted variant, support-floor
  failure/resume, and corrected Today pause copy.
- DOM snapshots cover every additional transition, including pending disabled
  state, Start Today, and irritation recovery.
- A few nonessential screenshot attempts timed out in the browser capture channel;
  the corresponding DOM state and successful interaction outcome are retained.

## Remaining External Proof

- Verify encrypted cycle/ramp persistence across real iOS and Android process death,
  background/foreground, timezone changes, and local-midnight rollover.
- Verify Dynamic Type, VoiceOver, TalkBack, native safe areas, and modal gestures on
  the supported release-device matrix.
- Keep the production cadence gate closed until named dermatologist and
  cosmetic-chemistry approval is recorded.
