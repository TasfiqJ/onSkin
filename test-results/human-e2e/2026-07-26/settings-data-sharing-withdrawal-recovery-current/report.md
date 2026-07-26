# Settings Data-Sharing Withdrawal Recovery

Date: 2026-07-26 (America/Toronto)

Surface: actual Expo web `/you`

Viewport: 390 x 844

## Result

Pass for the local failure, single-flight retry, relaunch, terminal acknowledgement, regrant, and stale-owner boundaries.

The development-web `fail_twice_then_succeed` fixture runs only for the exact `data_sharing` withdrawal. It retains a content-free attempt counter in same-tab session storage, performs hashing and account-generation fencing, and sends its third synthetic response through the production exact acknowledgement validator. The first two attempts throw one fixed sentinel; the third returns the exact zero-count data-sharing cleanup acknowledgement. Production, native, unknown-mode, and other-consent paths retain the normal backend guard and invocation.

## Failure, Retry, And Relaunch

The fresh route began with the accessible `Share data with partners for where-to-buy` switch off, zero withdrawal attempts, and zero consent starts. Its box was 52 x 48 px. Turning it on committed the local grant, checked the switch, and started one consent workflow without invoking the withdrawal fixture.

Turning it off:

- unchecked the switch immediately after the encrypted local `false` write;
- incremented the fixture counter to one;
- exposed exactly one `Choice not saved` alert;
- exposed one button named `Try saving data sharing choice again`, rendered as `Try again`;
- kept that action fully visible at 113.91 x 56 px;
- retained zero horizontal overflow and no dialog, page error, raw sentinel, storage key, backend code, or provider error.

Trying to turn sharing back on while the withdrawal was pending left the switch off and changed neither the attempt count nor consent-start count.

Two same-frame retry activations produced exactly one additional consent start and one fixture attempt. The counter moved from one to two, not three, and the pending alert remained.

Reloading the same tab retained counter two and the encrypted pending marker. It made no automatic withdrawal call, kept the switch off, and restored the same accessible alert and retry action. One retry then produced the exact validated third acknowledgement, cleared the pending marker and alert, left the switch off, and removed the retry action.

A final reload made no fourth call. The switch remained off and changeable with no alert. Turning it on succeeded locally, checked both data-sharing views, and left the withdrawal counter at three.

Exact counter sequence:

`0 -> 1 -> 2 -> 2 after reload -> 3 -> 3 after final reload`

## Account-Generation Boundary

A separate `hold_then_succeed` server proved the stale-owner boundary:

- the local revocation committed, the switch turned off and disabled, the pending alert appeared, and the fixture exposed one dev-only release hook;
- activating `Sign out` synchronously removed the You surface and entered the real account-isolation boundary;
- the synthetic account fixture deliberately failed its first protected-data clear, leaving the app locked behind the full-screen `Unavailable` recovery state;
- releasing the old withdrawal response after the owner boundary did not restore the You surface, render account-A `Choice not saved` feedback, clear the isolation gate, or create another attempt;
- the release hook deleted itself;
- activating the boundary `Try again` completed local isolation and rendered the signed-out Welcome surface with `Begin`;
- no account-A feedback, consent surface, or retry survived.

The focused persistence test also proves that late release cannot clear the durable pending marker or invoke the completion callback after the owner boundary.

## Accessibility And Geometry

Pending state:

- switch: `Share data with partners for where-to-buy`, unchecked, 52 x 48 px;
- alert: `Choice not saved` / `We couldn't save that choice. Please try again.`;
- retry: `Try saving data sharing choice again`, 113.91 x 56 px.

Account-isolation state:

- one alert titled `Unavailable`;
- one 334 x 58 px `Try again` recovery button;
- You surface absent.

All target controls were at least 44 px, fully visible, and center-hit-testable. Every sampled state had zero horizontal overflow. No JavaScript/native dialog or page error occurred.

## Logs

The only browser warnings were the expected local placeholder Supabase URL/key warnings and Expo web notification-listener warning. There were zero unexpected warning/error entries, dialogs, or page errors across both runs.

## Evidence Boundary

This is deterministic development-web proof of the actual local persistence, coordinator, React Query, retry, reload, exact-response validator, and account-generation paths. It does not prove the deployed endpoint wrote a caller-scoped false ledger row, deleted hosted commerce-click events, detached hosted order attribution, or survived a native process kill. Those remain staging and signed-device gates.

## Artifacts

- `01-initial-off-390x844.png`
- `02-failure-one-390x844.png`
- `03-failure-two-after-double-retry-390x844.png`
- `04-pending-after-reload-390x844.png`
- `05-withdrawal-confirmed-390x844.png`
- `06-final-reload-and-regrant-390x844.png`
- `07-held-before-signout-390x844.png`
- `08-account-boundary-before-late-release-390x844.png`
- `09-after-late-release-before-boundary-retry-390x844.png`
- `10-account-boundary-settled-390x844.png`
- `metrics.json`
- `accessibility-snapshots.txt`
- `browser-log.json`
- `command-transcript.txt`
