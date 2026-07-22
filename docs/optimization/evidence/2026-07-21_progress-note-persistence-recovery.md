# Progress Note Persistence And Recovery Checkpoint

Date: 2026-07-21 (America/Toronto)

Branch: `optimization`

Evidence class: focused tests and supported-phone Expo-web human-simulated E2E

Status: Progress note persistence/failure recovery is locally implemented and web-checked. OPT-115 remains `investigating` because native production-Hermes keystroke commits, frame/memory traces, keyboard/IME, VoiceOver, SecureStore, and process-kill evidence remain open.

## Baseline And Finding

`PhotoNoteEditor` already kept keystroke state below the full photo-detail image shell, but blur invoked a fire-and-forget mutation. It had no saving, saved, failed, or retry state; no coalescing contract for overlapping editing callbacks; and no human evidence that the encrypted note survived a fresh route load. During the first Expo-web run, the textbox lost focus without reliably invoking the React Native `onBlur` or `onEndEditing` callback on the tested Pressable transition. The exact draft stayed visible, but no write or failure feedback appeared.

## Implementation

- `photoNoteSaveCoordinator.ts` owns the draft, confirmed persisted baseline, and idle/saving/saved/error state entirely inside the editor leaf.
- Blur, end-editing, and an explicit dirty-state `Save note` action use the same single-flight request path.
- A second request during an active write coalesces to the newest explicitly requested draft. Duplicate delivery for the same draft performs no second write and cannot arm later unrequested typing for persistence.
- Failure stops automatic work, retains the exact draft, publishes an accessible alert, and leaves a 48 pt explicit retry.
- Success advances the persisted baseline only after `note.mutateAsync` resolves. The dirty action disappears only when draft and confirmed baseline match.
- The store's existing 262,144-UTF-16-code-unit plaintext ceiling is exported to the editor, keeping UI and codec bounds identical.
- Note store tests prove ciphertext exclusion, exact reload, byte-preserving pre-write failure, retry convergence, and exact-readback recovery when a committed write loses its acknowledgement.
- Owner-boundary coverage proves a started write drains before the generation boundary settles but cannot publish owner-A note text into owner B's query cache.
- A development-only real-store seed and Expo-web content-key harness are gated by `__DEV__`, `Platform.OS === 'web'`, and the exact `EXPO_PUBLIC_E2E_PROGRESS_NOTE_SEED=1` flag. Production and native key behavior is unchanged.

## Verification

| Check | Result |
| --- | --- |
| Progress focused matrix | Pass, 5 files / 158 tests |
| Mobile TypeScript | Pass |
| Targeted zero-warning ESLint | Pass |
| Repository TypeScript | Pass, 2 workspaces |
| Repository zero-warning lint | Pass, 2 workspaces |
| Repository tests | 2 files failed / 345 passed; 4 tests failed / 4,142 passed, all in unrelated user-owned notification/Shelf changes already present in the dirty worktree |
| Supported-phone Expo-web flow | Pass: deterministic failure, exact retained draft, retry, saved feedback, fresh-load exact restoration |
| Requested/observed viewport | 390 x 844 / 390 x 845 |
| Failure-state horizontal overflow | 0 px |
| Retry action height | 47.9976 px (approximately 48 CSS px) |
| JavaScript dialogs | 0 |

The exact note was `Retinol restarted after travel — calm, no score, July 21.`. The failure alert stated `We couldn't confirm this note was saved. Your text is still here.`. Retry reached `Saved on this device`; a fresh direct load restored the exact note with no alert and no dirty `Save note` action.

Raw screenshots, metrics, and the run report are in `test-results/human-e2e/2026-07-21/progress-note-persistence-current/`. The Expo-web callback finding and fix verification are recorded in `docs/e2e-bug-reports/2026-07-21-progress-note-web-blur-feedback.md`.

## Privacy And Scope

The evidence uses a deterministic development-only note and metadata-only local photo. No real photo, user note, account identifier, credential, secure key, ciphertext, local storage bytes, or provider payload is retained in the packet. The web key exists only for the explicitly gated development evidence path because Expo web cannot use the native SecureStore adapter; it is deleted by the same storage-clear operation.

This closes the decision-free local persistence/failure-recovery evidence gap. It does not close Progress query-cache note/metadata retention, encrypted thumbnails, photo v2/native handles, native performance, supported-iOS keyboard/accessibility, or OS lifecycle gates. No native or signed-artifact claim is made.
