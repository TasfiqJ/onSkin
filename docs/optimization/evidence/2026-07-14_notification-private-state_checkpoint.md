# Notification Private-State And Scheduling Checkpoint

Date: 2026-07-14 (America/Toronto)
Branch: `optimization`
Implementation SHA: `ff500ef13127482b6ebe575a940c86d7484da16e`
Evidence class: `command`, `decision`, and blocked `e2e`

This sanitized checkpoint covers notification preferences, the local sent ledger, streak milestones, fixed native schedule convergence, behavioral delivery ordering, and the notification Settings/onboarding recovery surfaces. It is not signed-device notification proof or a completed human-simulated E2E pass.

## Implemented Contract

- `onskin.notifPrefs.v1`, `onskin.notiflog.v1`, and `onskin.milestones.v1` now expose strict bounded typed reads, preserve malformed/future/unavailable bytes, use atomic same-key transforms, and reconcile exact commit-response loss.
- Genuine preference absence is all-off and cannot imply notification consent.
- Preference persistence, fixed-ID cancellation/rescheduling, and behavioral delivery share one owner-generation queue. A durable opt-out cannot be overtaken by later queued delivery.
- Native schedule convergence is root-owned outside the tabs tree, retries transient failures at bounded delays, and verifies fixed IDs before reusing an in-memory signature.
- Behavioral delivery reserves the local cap before native presentation, serializes concurrent decisions, selects at most one trigger per background evaluation, and detaches the optional owner-bound server mirror.
- Settings and onboarding retain navigation and desired intent across failures, expose accessible retries, render disabled quiet hours as off, support turning the window on/off atomically, and use truthful default-time copy.

## Commands And Results

| Command or action | Result |
| --- | --- |
| `npm --workspace apps/mobile run typecheck` | Pass |
| `npm --workspace apps/mobile run lint` | Pass, zero warnings |
| Focused notification/private-state Vitest matrix | Pass, 19 files / 268 tests, including final review regressions |
| `npm --workspace apps/mobile test` | Pass, 249 files / 2,978 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces |
| `npm test` | Pass, 249 files / 2,978 tests across the tested workspace |
| Expo web start plus `GET /settings/notifications` | Pass, HTTP 200; Metro bundled 2,460 web modules and 2,846 server modules |
| `git diff --check` | Pass |
| `npm run e2e:human:manifest:check` | Fail: existing generated manifest predates a broad set of already committed source/evidence changes |

Expected local-development warnings were limited to missing Sentry organization/project values, placeholder Supabase configuration, Expo Notifications' web-listener limitation, and the host `NO_COLOR`/`FORCE_COLOR` warning.

## Human-Simulated E2E Boundary

The Expo route server and bundle completed, and an earlier connection displayed the notification Settings title, Back control, and all-off absent-state switches. The required recovery interactions were not completed after the final code changes: the Codex in-app browser discovery API returned no available browser, and neither Android `adb` nor an emulator SDK was installed on the Windows host. The browser skill's troubleshooting contract prohibited substituting an unrelated controller. This checkpoint therefore records the notification recovery UI gate as `blocked-external`, not passed.

Required follow-up on an available target:

1. Run absent, persistent unavailable, corrupt, future-version, one-shot read, and one-shot write fixtures at supported phone sizes.
2. Exercise retry, Back, refresh/relaunch, quiet-hours on/off, and onboarding same-choice recovery using user-facing controls.
3. Capture screenshots, focus/accessibility observations, console/device logs, and exact byte-preservation evidence.
4. On supported native devices, test permission denial/revocation, fixed schedule IDs, time-zone/DST, reboot/update recovery, trial revocation, Android channels, notification taps, and real delivery.

## Open P2 Work

- Revalidate OS authorization before recurring or immediate scheduling and provide a truthful settings recovery path after denial/revocation.
- Replace device-local post-delivery mirroring with an approved server-authoritative reservation/outbox design for cross-device caps.
- Replace continuously mounted enabled Shelf/Ramp/Progress observers with one fresh owner-bound batched snapshot on the relevant lifecycle event.

No remaining P0/P1 finding was reported by the final independent reviews. These P2 items and native/browser proof keep the affected optimization rows at `investigating`.
