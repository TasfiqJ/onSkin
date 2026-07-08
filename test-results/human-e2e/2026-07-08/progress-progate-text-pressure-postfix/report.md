# Progress ProGate Text-Pressure Follow-Up

Date: 2026-07-08
Surface: Codex in-app browser, Expo web
Viewport: 320 x 568

## Scope

Verified the compact Progress photo paywall paths after moving compact `/progress*`
ProGate compliance controls into the header action band.

Routes:

- `/progress`
- `/progress/capture`
- `/progress/review`

## Result

Pass. Terms, Privacy, Restore, Maybe later, Start free trial, and Explore first
are visible, at least 48 px tall, unclipped, and not center-hit blocked on all
three routes.

## Notes

The pre-fix 118% text-pressure audit is in
`test-results/human-e2e/2026-07-08/text-scale-120-compact-audit/`. During the
post-fix rerun, the in-app browser blocked JavaScript URL text-scale mutation,
so this folder records the actual app-surface geometry after the source fix and
the source contract test locks the compact Progress header-compliance rule.
Native iOS/Android Dynamic Type remains a separate device QA gate.

## Evidence

- `progress.json` / `progress.png`
- `progress-capture.json` / `progress-capture.png`
- `progress-review.json` / `progress-review.png`
- `summary.json`
- `browser-warn-error-logs.json`
