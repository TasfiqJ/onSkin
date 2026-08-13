# Notification permission recovery human-simulated E2E

Date: 2026-07-25
Surface: Expo web `/settings/notifications`
Result: PASS for deterministic web recovery; native delivery remains device QA

## Grant recovery — 390 x 844 requested, 390 x 845 observed

- Fixture: `EXPO_PUBLIC_E2E_NOTIFICATION_PERMISSION=undetermined_then_granted`.
- Morning reminder intent remained checked throughout.
- No browser/OS permission prompt occurred before the user pressed `Allow notifications`.
- First-viewport post-fix action geometry: top 855.57 px, bottom 911.56 px, height 55.99 px; the action was fully below the 845 px viewport rather than partially clipped.
- After scroll, `Allow notifications` measured 316.38 x 55.99 px and its center resolved to the same labelled control.
- Pressing the action cleared the recovery card.
- Reload preserved the checked Morning intent and the granted fixture state; no recovery alert returned.
- Document width was 390 px for a 390 px client width.
- No JavaScript dialog appeared.

## Unavailable → denied/settings recovery

- Fixtures: `EXPO_PUBLIC_E2E_NOTIFICATION_PERMISSION=unavailable_once_then_denied_no_retry` and `EXPO_PUBLIC_E2E_APP_SETTINGS_FAILURE=1`.
- The first authoritative read rendered `Notification access unavailable` with a user-pressed `Try again`.
- Retry transitioned to `Reminders paused by device settings` with `Open settings`.
- The forced Settings handoff failure stayed inline, content-free, and accessible; no dialog appeared.
- At 390 x 844, `Open settings` measured 316.38 x 55.99 px.
- At 320 x 568 requested, 320 x 569 observed, it measured 246.48 x 55.99 px, was center-hit-testable, and document/client width both measured 320 px.
- The Morning reminder intent remained checked through unavailable, denied, failure, and reload states.
- A final post-alert-structure rerun at 320 x 568 found exactly one accessible alert, retained the 246.48 x 55.99 px center-hit-testable action after scroll, and retained zero horizontal overflow and no JavaScript dialog.

## Browser logs

No current-origin application error was observed. Retained warnings were the expected local missing-Supabase placeholders and Expo web’s unsupported push-token listener warning. One earlier log file also records the deliberate Metro restart used to swap deterministic fixtures.

## Unchanged permission request

- Fixture: `EXPO_PUBLIC_E2E_NOTIFICATION_PERMISSION=undetermined`.
- At 390 x 844 requested (390 x 845 observed), the saved Morning reminder stayed checked.
- Pressing `Allow notifications` returned an unchanged undetermined response and rendered exactly one accessible `Needs attention` alert with content-free retry guidance.
- The action returned from `Working...` to `Allow notifications`, horizontal overflow remained zero, no JavaScript dialog opened, and no application error was logged.

## Evidence files

- `undetermined-first-viewport-postfix-390x844.png`
- `undetermined-allow-postfix-390x844.png`
- `final-granted-reload-current-390x844.png`
- `unavailable-retry-390x844.png`
- `denied-open-settings-390x844.png`
- `open-settings-inline-failure-390x844.png`
- `open-settings-inline-failure-320x568.png`
- `single-alert-inline-failure-320x568.png`
- `browser-logs-single-alert-final.json`
- `unchanged-request-inline-failure-390x844.png`
- `browser-logs-unchanged-request-final.json`
- `browser-logs-final.json`
- `browser-logs-unavailable.json`
- Expo web stdout/stderr logs for each fixture run

## Native boundary

Expo web proves the route state machine, explicit-action gate, focus-query refresh, preference-intent preservation, inline failure handling, accessibility names, geometry, and overflow. It does not prove iOS provisional/ephemeral delivery, Android 13 permission behavior, native Settings return, exact fixed-ID cancellation/rebuild, banner presentation, tap routing, reboot/app-update behavior, or device time-zone/DST behavior.
