# Progress Note Persistence And Recovery E2E

Date: 2026-07-21 (America/Toronto)

Surface: Expo web through the Codex in-app Browser

Viewport: 390 x 845 observed (390 x 844 requested)

Result: Pass for the scoped web persistence and recovery flow

## Environment

- Development Expo web server on port 8322.
- `EXPO_PUBLIC_E2E_ENTITLEMENT=store_pro`
- `EXPO_PUBLIC_E2E_PROGRESS_NOTE_SEED=1`
- `EXPO_PUBLIC_E2E_PHOTO_NOTE_SAVE_FAILURE=once`
- `EXPO_PUBLIC_E2E_APP_LOCK_ENABLED=disabled`
- One metadata-only Progress photo was created through the real photo-metadata encryption/write/read path using the exact development-only web content-key harness. The production/native key path was not changed; the harness was enabled by the exact seed flag because SecureStore is unavailable on Expo web.

## Human-Simulated Flow

1. Opened Progress and traversed Timeline to the Jul 21 photo detail.
2. Rapidly entered the exact note `Retinol restarted after travel — calm, no score, July 21.`.
3. Verified the dirty editor exposed `Save note`.
4. Activated Save and forced one deterministic pre-write failure.
5. Verified the exact draft remained, the accessible alert read `We couldn't confirm this note was saved. Your text is still here.`, `Try save again` remained reachable at 47.9976 px high (approximately 48 CSS px), and horizontal overflow was zero.
6. Activated retry and verified `Saved on this device`, zero alerts, the exact draft, and zero horizontal overflow.
7. Performed a fresh direct load of the same route after the original tab closed during hard reload.
8. Waited for encrypted-store startup and verified the exact note restored with zero alerts, no dirty `Save note` action, and zero horizontal overflow.

No JavaScript dialog opened. The only console warnings were the expected development placeholders for missing Supabase URL/key and the known Expo notifications web-support warning.

## Finding And Fix

The initial run showed that moving focus to another Pressable did not reliably deliver Expo web `onBlur` or `onEndEditing`, so no save state appeared even though the textbox became inactive. The finding is recorded in `docs/e2e-bug-reports/2026-07-21-progress-note-web-blur-feedback.md`.

The corrected editor retains both best-effort editing callbacks and adds an explicit 48 px `Save note` action while dirty. All triggers use one leaf-owned single-flight coordinator that coalesces the newest draft, retains failed text, and requires an explicit retry after failure.

## Evidence Files

- `01-detail-before.png`: initial photo detail.
- `02-prefix-missing-feedback.png`: pre-fix retained draft with missing save feedback.
- `03-save-failure-draft-retained.png` and `04-save-failure-390x844.png`: intermediate recovery checks.
- `05-clean-save-failure-390x844.png`: final deterministic failure with retained draft and retry.
- `06-saved-on-device-390x844.png`: successful retry state.
- `07-persisted-after-fresh-load-390x844.png`: exact note restored from the encrypted store after fresh load.

## Remaining Gates

This web run proves the real store write/reload contract, deterministic failure recovery, accessibility role, touch geometry, and responsive layout at the supported phone viewport. It does not prove native iOS SecureStore/file behavior, keyboard/IME and focus behavior, VoiceOver announcement order, process-kill recovery, or production-Hermes React Profiler/frame/memory behavior. Those remain explicit device gates.
