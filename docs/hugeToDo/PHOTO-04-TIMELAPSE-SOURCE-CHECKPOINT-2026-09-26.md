# PHOTO-04 time-lapse source checkpoint — 2026-09-26

## Status

This is a bounded **source checkpoint**, not PHOTO-04 completion or release
evidence. Formal execution status remains unchanged. PHOTO-04 remains open
behind PHOTO-03 and still requires signed-build, physical-iPhone, lifecycle,
privacy, accessibility, performance, and human-simulated E2E evidence.

## Source boundary

The Progress time-lapse mounts only inside the shared photo-timeline unlock and
encrypted photo-read gate. It builds a finite copied sequence ordered oldest to
newest, renders frames through the existing memory-only sensitive `PhotoImage`
path, and starts each dwell only after that encrypted frame reports successful
native display. Stale display callbacks and failed frames cannot advance it.

Playback supports pause, manual previous/next, end-of-sequence stop, and
explicit replay. Backgrounding cancels active and pending autoplay; returning
to foreground never resumes without another user action. A live Reduce Motion
decision cancels autoplay and hides automatic play while preserving manual
frame navigation. The modal itself uses no transition animation.

The full-screen player exposes modal escape, an announced heading, focus entry
and restoration, adjustable previous/next actions, localized dates, explicit
button labels/states, large-text scrolling, and 48–56 pt controls. The player
adds no network, analytics, share, filesystem-write, or observability path and
keeps the local-only/no-score boundary visible.

## Automated evidence

- Aggregate mutation-tested AST/control-flow contract:
  `npm run photo04:source-contract:test`
- Focused mobile tests:
  `npm --workspace apps/mobile exec vitest run src/features/photos/timelapse.test.ts src/features/photos/timelapsePlayback.test.ts src/features/photos/PhotoTimelapse.test.ts src/features/photos/timelapseFocus.test.ts src/features/photos/progressRoutes.test.ts`

## Gates source cannot close

- Signed iOS archive and supported physical-iPhone encrypted-frame playback.
- Real background/foreground timer suspension and interruption behavior.
- VoiceOver focus entry/restoration, adjustable actions, escape, and labels.
- Extreme Dynamic Type, Reduce Motion, orientation, and supported-device layout.
- Network traffic and filesystem/cache inspection proving zero egress/residue.
- Large-library memory, latency, energy, and thermal measurements.
- Current human-simulated E2E evidence bound to the exact source and build.
