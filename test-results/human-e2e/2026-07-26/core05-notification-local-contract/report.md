# CORE-05 local notification contract — development Expo-web observation

Date: 2026-07-26
Tester: Codex
Surface: Expo SDK 56 development web at `http://127.0.0.1:8290`
Start command: `npm --workspace apps/mobile run web -- --port 8290`
Expo CLI: 56.1.19
Host OS: Windows
Browser surface: Codex in-app browser; browser version, CSS viewport, and
device-pixel ratio were not retained. Screenshots are 1279 x 720 rasters and are
not CSS-viewport proof.
Fixture/configuration: local first-session state, notification authorization
unavailable in the Expo-web surface, placeholder Supabase URL/key, no live
account or external service, and no destructive action.
Source identity: exact notification, settings, contract, and documentation
snapshot represented by the Git commit containing this report; parent commit
`f0ccac28e24fa7800c7b4a353576647a14a68cf7`. Concurrent unrelated DB-agent
working-tree edits were excluded from the checkpoint commit and are not part of
this evidence claim.

## Verdict

Pass for the bounded development-web source observation described below.

This is not compact/supported-phone, native iOS, physical-iPhone,
OS-permission-sheet, native-scheduling, background/relaunch, timezone/DST,
accessibility, network-capture, signed-archive, App Review, privacy/legal, launch,
or revenue evidence.

## Human-simulated flow

1. Opened the notification onboarding route from a fresh local first-session
   state. The app correctly redirected through DOB, health-data consent, goals,
   all 12 quiz questions, product skip, and profile completion before allowing
   the notification step.
2. Observed the notification soft ask before any OS request. It displayed
   `Morning`, `7:30 AM`, `Evening`, `9:30 PM`, `Discreet`, `Use these times`, and
   `Not now`.
3. Activated `Not now` and continued through account skip. The notification
   purposes remained off.
4. Opened `/settings/notifications`. Browser authorization was unavailable and
   the route rendered an unavailable banner plus six effectively-off switches.
5. Activated Morning routine. The first run exposed a web-only
   `Linking.openSettings()` crash. The route was fixed, rebuilt, and replayed in
   a clean browser tab.
6. In the post-fix clean tab, Morning activation caused no overlay, dialog, or
   navigation. The unavailable banner remained and the switch remained
   `aria-checked="false"`. The clean tab log contained no runtime error.
7. Opened `/settings/timing`. Observed `Routine quiet hours`, scheduled
   routine/weekly-photo reminders moving to the window end, immediate
   event-triggered suggestions being skipped, and the explicit checkout-date
   billing exception.
8. Changed quiet-hours end from 7:00 AM to 10:00 PM to match the 10:00 PM start.
   The route rendered `Quiet hours are off because the start and end match.`

## Evidence inventory

| Artifact | Classification | Observation |
| --- | --- | --- |
| `onboarding-exact-times.jpg` | Pass | Exact 7:30 AM and 9:30 PM proposal appears before the permission action. |
| `settings-web-open-settings-crash-prefix.jpg` | Bug reproduction only | Pre-fix uncaught-error overlay; never use as passing settings evidence. |
| `settings-web-unavailable-all-off-postfix.jpg` | Pass | Post-fix browser-unavailable banner and effectively-off settings surface. |
| `timing-quiet-hours-scope.jpg` | Pass | Scheduled-shift/event-skip quiet-hours scope and checkout-date billing exception. |
| `timing-quiet-hours-off.jpg` | Pass | Equal start/end is explicitly described as quiet hours off. |
| `postfix-ui-snapshot-and-console.md` | Bounded transcript | Post-fix semantic snapshot, switch state, clean-tab error query, and expected development warnings. |

## Post-fix DOM and console facts

- Six notification switches were present and all six returned
  `aria-checked="false"` before the post-fix interaction.
- After activating Morning routine in a clean tab, it still returned
  `aria-checked="false"`.
- The clean tab emitted expected development warnings for placeholder Supabase
  configuration, limited Expo web notification support, and a deprecated React
  Native web prop. It emitted no `error` entry.
- No external service or destructive action was used.

## Automated checks at capture time

- Mobile TypeScript check: pass
- Mobile ESLint: pass
- CORE-05 mandatory source contract: 8/8 pass
- Focused notification/settings/health-write/analytics/app-settings tests after
  final hardening: 13 files, 157/157 pass
- Repository TypeScript: 3/3 workspace tasks pass
- Repository ESLint: 3/3 workspace tasks pass
- Repository tests: mobile 326 files / 4,043 tests and operator console 7 files /
  24 tests pass

Repository-wide checks are recorded in the containing commit/checkpoint rather
than represented by these browser screenshots.

## Open acceptance lanes

- supported compact iPhone viewports and text pressure;
- fresh iOS grant, denial, blocked recovery, Settings revocation/foreground
  return, provisional and ephemeral states where available;
- actual native AM/PM, weekly capture, event-triggered, and trial-reminder
  scheduling/cancellation inventory;
- simultaneous cap admission, native failure after reservation, process kill,
  relaunch, offline, timezone, DST, Focus, and Notification Summary behavior;
- VoiceOver, Dynamic Type, Reduce Motion, and touch-target inspection;
- physical iPhone, production configuration, network capture, signed archive,
  privacy label, counsel, and App Review evidence.
