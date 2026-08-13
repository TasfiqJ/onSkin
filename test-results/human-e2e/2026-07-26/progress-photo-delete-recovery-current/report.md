# Progress Photo-Deletion Recovery Human-Simulated E2E

## Summary

- Date: 2026-07-26 (America/Toronto)
- Codex task: PERF-P0-007 / OPT-010 photo-deletion recovery presentation
- App surface: actual Expo web `/progress` route in the Codex in-app browser
- Build/start command: `npm --workspace apps/mobile run start -- --web --port <port>`
- Requested viewports: 360 x 640 empty Progress; 390 x 844 populated Progress
- Browser-observed viewports: 360 x 641 and 390 x 845
- Captured PNG sizes: 360 x 639 and 390 x 843
- Overall verdict: Pass for the scoped fixture-driven web presentation and interaction

## Scope Boundary

The development-web fixtures prove presentation, accessibility semantics, layout, and the visible
retry interaction. They disable the live status query and do not prove an authenticated server
delete or outbox transition. Runtime outbox tests separately prove current-owner status/retry
selection, account-generation fences, and dead-row retry. The behavioral single-flight test proves
rapid duplicate retry activations join the same promise and that completion or failure permits a
later retry.

## Flows Executed

| Progress data | Deletion status | Result | Evidence |
| --- | --- | --- | --- |
| Empty | Saved local | Pass | `empty-saved-360x640.png` |
| Empty | Syncing | Pass | `empty-syncing-360x640.png` |
| Empty | Needs attention | Pass | `empty-attention-360x640.png` |
| Populated | Saved local | Pass | `populated-saved-390x844.png` |
| Populated | Syncing | Pass | `populated-syncing-390x844.png` |
| Populated | Needs attention | Pass | `populated-attention-390x844.png` |

Across the six scenarios:

- saved-local remained calm and non-alerting;
- syncing exposed exactly one progressbar named `Finishing deletion`;
- needs-attention exposed exactly one alert and one uniquely named retry action;
- the empty-state retry measured 278.28 x 55.99 CSS px and the populated-state retry measured
  308.37 x 55.99 CSS px;
- the empty attention retry was activated through its exact accessible name and opened no dialog;
- all visible controls measured at least 44 x 44 CSS px;
- there was no horizontal overflow, partial visible control, UUID, ISO timestamp, filename, raw
  fixture/storage/outbox error, or JavaScript dialog;
- copy remained aggregate and plural-neutral and disclosed that Progress images are not uploaded;
- the only current-origin warnings were the expected missing local Supabase placeholder
  configuration and Expo's unsupported web notification-listener warning.

## Bug Found And Fixed

The first 360 x 640 needs-attention run used the full-height first-run layout. Its primary
`Take my first photo` action ended at CSS y=641.81 in a 641 px browser viewport and was partly
outside the visible area. Empty Progress now uses its compact first-run layout below 700 px.
The exact rerun placed the action from y=483.84 to y=535.83 with no partial control. See
`bug-report.md`.

## Tests Added Or Updated

- `PhotoDeleteSyncStatus.test.ts`: owner, privacy, gate, semantic, and presentation contracts.
- `photoDeleteRetrySingleFlight.test.ts`: duplicate-activation join, completion reset, failure reset,
  and subsequent retry.
- `progressRoutes.test.ts`: empty/populated mount and compact empty-layout ownership.
- `queryKeys.test.ts`: owner-scoped photo-deletion status query key.
- Existing outbox tests: current-owner aggregate status, account-generation fencing, and retry.

Focused result at capture time: 5 files / 81 tests passed.

## Bugs Found

| ID | Severity | Result | Evidence |
| --- | --- | --- | --- |
| PHOTO-DELETE-RECOVERY-001 | Medium | Fixed and exact path reverified | `bug-report.md`, `empty-attention-360x640.png`, `metrics.json` |

## Remaining Risk

- The unreadable queue / `Check again` branch was not fault-injected in this browser matrix.
- Signed-out and authenticated legacy non-UUID hiding were not driven through the browser.
- The fixture retry cannot prove `retryPhotoDeleteOutbox` executed.
- Actual authenticated offline delete, reconnect, response loss, account switching, and long-lived
  terminal retry still require native and hosted verification.
- Supported-iOS VoiceOver, Dynamic Type, safe-area, process-kill, memory, backup, and protected-file
  behavior remain release-device evidence.
