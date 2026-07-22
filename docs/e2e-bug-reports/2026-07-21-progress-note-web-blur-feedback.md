# E2E Bug Report: Progress note blur does not publish save feedback on Expo web

Severity: Medium

Surface: Expo web

Environment: Development bundle at 390 x 845 (requested 390 x 844), real photo-metadata store with the exact development-only Expo-web content-key harness, one-shot pre-write failure

Feature: Progress single-photo note persistence and recovery

Date: 2026-07-21

Tester: Codex

## Reproduction Steps

1. Open the seeded Progress timeline, switch to Timeline, and open the single stored photo.
2. Type `Retinol restarted after travel — calm, no score, July 21.` into Your note.
3. Move focus to Share photo, then cancel the share confirmation.

## Expected Result

The first development-only note write fails before store entry, the draft remains visible, and an accessible could-not-confirm alert plus a 48 px `Try save again` action appears.

## Actual Result

The textarea loses focus and keeps the draft, but no saving, saved, failure, or retry feedback is published. The page contains zero `role="alert"` elements.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-21/progress-note-persistence-current/02-prefix-missing-feedback.png`
- UI snapshot: the inactive textbox retains the full draft while no status or retry action is present.
- Geometry: 390 x 845 observed viewport, zero horizontal overflow.
- Logs: no browser warn/error entries at reproduction time.

## Frequency

- Always in the first 390 px Expo-web reproduction.

## Scope

- Affected route/screen: `/progress/[id]`
- Affected account or fixture: development-only real photo-store seed using the exact Expo-web content-key harness with `EXPO_PUBLIC_E2E_PHOTO_NOTE_SAVE_FAILURE=once`
- External service involved: None
- Destructive action involved: None

## Suspected Cause

Expo web ends text editing without consistently invoking the route's `onBlur` or `onEndEditing` save callback during the tested Pressable transition. The editor has no explicit save action, so the user cannot reliably request persistence when those events are absent even though DOM focus moves back to the body.

## Minimal Fix Recommendation

Keep both blur/end-editing hooks and expose a 48 px `Save note` action whenever the current draft differs from the confirmed persisted baseline. Route all three triggers through the same idempotent single-flight coordinator; duplicate event delivery remains safe because unchanged and in-flight requests are coalesced.

## Verification Flow After Fix

1. Repeat rapid typing, verify `Save note` appears, and activate it.
2. Verify the accessible failure alert, retained exact draft, and 48 px retry action.
3. Retry, verify `Saved on this device`, then fresh-load the same direct route and verify the exact note remains.

## Post-Fix Evidence

- The editor now exposes `Save note` whenever its draft differs from the last confirmed persisted value while retaining blur and end-editing as best-effort triggers.
- The clean 390 x 845 rerun retained the exact draft after the deterministic pre-write failure, published the expected accessible alert, and kept `Try save again` at 47.9976 px high (approximately 48 CSS px) with zero horizontal overflow.
- Retry published `Saved on this device`. A fresh direct load of the same route restored the exact note with no alert and no dirty `Save note` action.
- Screenshots: `05-clean-save-failure-390x844.png`, `06-saved-on-device-390x844.png`, and `07-persisted-after-fresh-load-390x844.png` in `test-results/human-e2e/2026-07-21/progress-note-persistence-current/`.
- Run report: `test-results/human-e2e/2026-07-21/progress-note-persistence-current/report.md`.

## Remaining Risk

- Native iOS keyboard/focus, VoiceOver announcement, process-kill recovery, and React Profiler evidence remain required outside Expo web.
