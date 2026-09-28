# NATIVE-03 Notification Source Checkpoint — 2026-09-26

## Verdict

NATIVE-03 is **not complete**. The repository has a stronger local-notification
source candidate, but the active privacy/product contract deliberately keeps
remote push and token collection closed. No APNs key, Expo Push project binding,
server token registry, provider receipt handling, signed archive, or physical-
iPhone delivery evidence exists in this Windows checkpoint.

## Source state proven here

- All local notification purposes carry one versioned, exact-key data contract
  and one of four fixed category identifiers.
- Notification taps can select only Today, Progress, Shelf, or Subscription;
  payload-provided routes, URLs, IDs, extra fields, mismatched purposes, and
  custom actions are rejected.
- The response host mounts only inside the account/private-data/age/health
  gates, handles cold and warm responses, de-duplicates one response identifier,
  and clears a consumed cold response. Routing itself registers in the
  account-generation drain and runs only after a synchronous current-owner
  assertion; a recognized response fenced by a switch is consumed without
  navigation, and destructive cleanup independently clears Expo's retained
  last response before a new owner can publish.
- App-icon badges remain disabled, are cleared at startup, and are cleared again
  during account-boundary cleanup.
- Account sign-out/deletion cleanup now cancels scheduled notifications,
  dismisses delivered notifications, clears the retained response and badge,
  and remains fail-closed on an unproven native outcome.
- The billing reminder now uses the same account-generation lease and abort
  signal as health-purpose schedules. A boundary aborts the signal; the native
  coordinator compensates an already-committed exact identifier before
  releasing its global mutation fence.
- Native startup returns an explicit `ready`/`unavailable` result. Badge,
  category, handler, or Android-channel failure closes new delivery instead of
  allowing a partially configured schedule; account cleanup remains strict. A
  rejected or `false` badge-clear result intentionally caches `unavailable` for
  that process lifetime, so delivery stays closed until the next app restart
  retries the complete native bootstrap.
- APNs/Expo Push token collection remains literally absent, matching
  `docs/07-reminders-streaks-widgets.md` and `docs/phase-3/consent-matrix.md`.

## Remaining launch gates

1. Review and approve the exact remote-push purposes, recipient/processor,
   token retention/deletion, privacy-label, consent, preference, and incident
   contract before adding token collection.
2. Configure final-identity APNs and Expo/EAS credentials and implement an
   owner-bound token registry with install/account rotation, logout/deletion,
   invalid-token receipt cleanup, replay resistance, and least-privilege sends.
3. Prove local and remote category behavior, authorization changes, timezone and
   DST transitions, badge state, deep links, foreground/background/terminated
   delivery, relaunch, offline behavior, and account-boundary races on a signed
   archive and supported physical iPhones.
4. Capture accessibility, network/privacy, provider receipt, failure cleanup,
   and App Review evidence for the exact release candidate.

## Local evidence

- Notification feature tests: 193 passing.
- Notification/account-cleanup focused set: 321 passing.
- Mobile TypeScript typecheck: passing.
- Mobile lint: passing.

These results prove source behavior only. Expo web cannot prove native delivery,
APNs, Notification Center, badge, background/terminated routing, or an Apple-
signed binary.
