# Request and Native Owner-Lifecycle Checkpoint

Date: 2026-07-14 (America/Toronto)
Branch: `optimization`
Implementation SHA: `bbc04e86dd89fa0b689b473bd523e743a4fb7ebe`
Evidence class: `command` and `decision`

This checkpoint covers the future Ask request/reservation primitive, safe notification read and mirror detachment, Apple deletion reauthorization, biometric stale-prompt quarantine, and native Apple/Google account authentication. The governing rule remains that pure or bounded reads may detach after owner invalidation, while an operation whose native or server mutation may have committed must remain fenced until its outcome is safe to reconcile.

## Implemented Contract

- The future grounded Ask path requires an explicit trial or uncapped operation identity. Its module-owned coordinator joins only the same operation plus opaque request fingerprint, rejects conflicting rapid work, keeps ambiguous quota reservation writes drain-held, reuses the captured owner lease for a bounded and abort-aware provider request, and permits only synchronous guarded publication. The shipped app still has no production cloud provider and refuses unexpected unreserved grounded answers.
- Notification inventory reads, queued-operation waits, optional Supabase delivery/preference mirrors, permission-prompt publication, and behavioral Shelf refetch publication detach from an invalidated account generation without poisoning account B. Native schedule, cancel, presentation, and global cleanup mutations remain fail-closed and drain-held because Expo cannot prove a never-settling mutation did not commit.
- Apple deletion reauthorization now detaches the native prompt from the account drain. A late authorization code cannot begin deletion, freeze vendors, or sign out after the initiating owner generation changes.
- Biometric invalidation quarantines the exact pending native attempt, still asks the native provider to cancel, and immediately reports subsequent requests as unavailable until that stale promise settles. Late success or failure cannot unlock or publish for the replacement owner.
- Apple/Google provider prompts are owned by one synchronous cross-provider coordinator. Native token helpers reassert request ownership after every native await, route publication is guarded at layout-cleanup time, and all explicit AuthProvider session mutations share one FIFO.
- The main Supabase client and provider commit use the exact same `processLock` name for the persisted auth slot. Public session fingerprint validation runs before the manual lock; the request is reasserted after the lock drains prior refresh/read work; only `linkIdentity` or `signInWithIdToken` then runs while the lock spans auth-js's internal session capture, save, subscriber notification, and response validation. Same-owner token refresh does not invalidate a valid prompt, while sign-out, identity conversion, or A-to-B replacement does.

## Commands And Results

| Command or action | Result |
| --- | --- |
| Ask provider/reservation focused Vitest matrix | Pass, 3 files / 51 tests |
| Notification safe-subset Vitest matrix | Pass, 4 files / 75 tests |
| Apple deletion reauthorization Vitest file | Pass, 1 file / 46 tests |
| App Lock/biometric Vitest matrix | Pass, 7 files / 100 tests |
| Native provider-auth focused Vitest matrix | Pass, 10 files / 72 tests |
| Broader auth, Supabase, and onboarding Vitest sweep | Pass, 23 files / 205 tests |
| `npm test` | Pass, 266 files / 3,335 tests |
| `npm run typecheck` | Pass, 2 workspaces |
| `npm run lint` | Pass, 2 workspaces, zero warnings |
| Scoped, staged, and committed `git diff --check` | Pass |

Adversarial Ask review initially found a missing request fingerprint and weaker injectable coordinator ownership; both were corrected before commit. Provider-auth review found that a final JavaScript assertion could not make auth-js's later internal session capture/save atomic. The final implementation added the shared exact auth-storage lock and executable delayed-refresh, delayed-capture, late-save, B-first, same-owner-refresh, blur, unmount, and owner-change cases. Fresh re-review found no remaining P0/P1 within the app's single-JavaScript-runtime and single-main-Supabase-client model. The notification safe subset also had no P0/P1; the deliberately unmodified native-mutation uncertainty is recorded below.

## Verification Boundary And Follow-Up

No physical-device Apple, Google, biometric, notification, protected-storage, or account-switch evidence is claimed. No new human-simulated UI pass is claimed for the account route. Provider credentials and native devices remain required for that proof.

The Supabase proof is process-local and depends on pinned auth-js `2.108.1` behavior and its exact `lock:${storageKey}` convention. Re-audit before an auth-js upgrade, especially if `linkIdentity` or `signInWithIdToken` begins acquiring the configured lock internally.

A truly never-settling provider SDK mutation intentionally quarantines auth work. A truly never-settling biometric prompt intentionally leaves biometrics unavailable for the process lifetime. Native notification schedule/cancel/presentation and `cancelAllScheduledNotificationsAsync` can still hold account isolation indefinitely; bounding them without an exact identifier, terminal native reconciliation, and cancel-plus-dismiss fence would permit a late account-A mutation to affect account B. These are open native verification/design gaps, not claimed successes.
